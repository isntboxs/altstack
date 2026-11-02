import { ORPCError } from '@orpc/server'
import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import type { db } from '@altstack/db'
import { adCampaign, adOrder, adPayment, adUpload } from '@altstack/db/schemas'

import { AD_PLANS, nextAdMonth } from '@altstack/shared/schemas/ad-billing'
import type { AdCreative } from '@altstack/shared/schemas/ad-billing'

import { queueAdNotification } from './ad-notifications'
import { deleteFinalKeysBestEffort, promoteTempImageToAd } from './storage'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
async function lockedOrder(
	tx: Transaction,
	id: string,
	expectedVersion?: number
) {
	const [order] = await tx
		.select()
		.from(adOrder)
		.where(eq(adOrder.id, id))
		.for('update')
	if (!order) throw new ORPCError('NOT_FOUND')
	if (expectedVersion !== undefined && order.version !== expectedVersion) {
		throw new ORPCError('CONFLICT', {
			message: 'This order changed. Reload it before trying again.',
		})
	}
	return order
}
const bump = { version: sql`${adOrder.version}+1` }

export async function confirmAdPayment(
	database: typeof db,
	input: {
		id: string
		expectedVersion: number
		kind: 'initial' | 'renewal'
		reference: string
	},
	adminId: string,
	now = new Date()
) {
	return database.transaction(async (tx) => {
		const order = await lockedOrder(tx, input.id, input.expectedVersion)
		if (
			input.kind === 'initial' &&
			(order.paidAt || order.status !== 'pending_payment')
		) {
			throw new ORPCError('CONFLICT', {
				message: 'Initial payment is already recorded or this order is closed.',
			})
		}
		if (
			input.kind === 'renewal' &&
			(!order.paidAt ||
				!order.campaignId ||
				!order.paidThrough ||
				!order.renewalRequestedAt ||
				order.status === 'rejected')
		) {
			throw new ORPCError('CONFLICT', {
				message: 'This order has no pending renewal.',
			})
		}
		let paidThrough = order.paidThrough
		if (input.kind === 'renewal') {
			paidThrough = nextAdMonth(
				new Date(Math.max(order.paidThrough!.getTime(), now.getTime()))
			)
			await tx
				.update(adCampaign)
				.set({
					endsAt: paidThrough,
					updatedAt: now,
					version: sql`${adCampaign.version}+1`,
				})
				.where(eq(adCampaign.id, order.campaignId!))
		}
		await tx.insert(adPayment).values({
			orderId: order.id,
			kind: input.kind,
			amount: order.amount,
			reference: input.reference,
			confirmedBy: adminId,
			createdAt: now,
		})
		const [saved] = await tx
			.update(adOrder)
			.set({
				...bump,
				paidAt: order.paidAt ?? now,
				status: input.kind === 'initial' ? 'awaiting_materials' : order.status,
				paidThrough,
				renewalRequestedAt: null,
				updatedAt: now,
			})
			.where(eq(adOrder.id, order.id))
			.returning()
		await queueAdNotification(
			tx,
			order.id,
			input.kind === 'initial' ? 'paid' : 'renewed',
			`payment:${order.id}:${saved!.version}`
		)
		return saved!
	})
}

export async function requestAdRenewal(database: typeof db, id: string) {
	return database.transaction(async (tx) => {
		const order = await lockedOrder(tx, id)
		if (!order.paidAt || !order.campaignId || order.status === 'rejected') {
			throw new ORPCError('CONFLICT', {
				message: 'Only an approved campaign can be renewed.',
			})
		}
		if (order.renewalRequestedAt) return order
		const [saved] = await tx
			.update(adOrder)
			.set({ ...bump, renewalRequestedAt: new Date(), updatedAt: new Date() })
			.where(eq(adOrder.id, id))
			.returning()
		await queueAdNotification(
			tx,
			id,
			'renewal_requested',
			`renewal-request:${id}:${saved!.version}`
		)
		return saved!
	})
}

export async function submitAdMaterials(
	database: typeof db,
	id: string,
	expectedVersion: number,
	material: AdCreative
) {
	const promoted: Array<string> = [],
		temporary: Array<string> = [],
		stale: Array<string> = []
	try {
		const saved = await database.transaction(async (tx) => {
			const order = await lockedOrder(tx, id, expectedVersion)
			if (!order.paidAt || order.status === 'rejected') {
				throw new ORPCError('FORBIDDEN')
			}
			const assets = { logo: material.logo, banner: material.banner }
			for (const kind of ['logo', 'banner'] as const) {
				const key = material[kind]
				if (
					kind === 'banner' &&
					order.plan === 'core' &&
					key === material.logo
				) {
					assets.banner = assets.logo
					continue
				}
				if (key.startsWith('tmp/')) {
					const [upload] = await tx
						.select()
						.from(adUpload)
						.where(
							and(
								eq(adUpload.key, key),
								eq(adUpload.orderId, id),
								eq(adUpload.kind, kind)
							)
						)
						.for('update')
					if (!upload) {
						throw new ORPCError('BAD_REQUEST', {
							message: 'This upload does not belong to this order.',
						})
					}
					assets[kind] = await promoteTempImageToAd(key, id, kind)
					promoted.push(assets[kind])
					temporary.push(key)
					await tx.delete(adUpload).where(eq(adUpload.key, key))
				} else if (key !== order.material?.[kind]) {
					throw new ORPCError('BAD_REQUEST', {
						message: 'Choose an upload belonging to this order.',
					})
				}
			}
			const [live] = order.campaignId
				? await tx
						.select()
						.from(adCampaign)
						.where(eq(adCampaign.id, order.campaignId))
				: []
			const retained = new Set([
				assets.logo,
				assets.banner,
				live?.logo,
				live?.banner,
			])
			for (const key of [order.material?.logo, order.material?.banner]) {
				if (key && !retained.has(key)) stale.push(key)
			}
			const [row] = await tx
				.update(adOrder)
				.set({
					...bump,
					material: { ...material, ...assets },
					status: 'in_review',
					feedback: null,
					updatedAt: new Date(),
				})
				.where(eq(adOrder.id, id))
				.returning()
			await queueAdNotification(
				tx,
				id,
				'submitted',
				`submitted:${id}:${row!.version}`
			)
			return row!
		})
		await deleteFinalKeysBestEffort([...new Set([...stale, ...temporary])])
		return saved
	} catch (error) {
		await deleteFinalKeysBestEffort(promoted)
		throw error
	}
}

export async function reviewAdOrder(
	database: typeof db,
	input: {
		id: string
		expectedVersion: number
		decision: 'approve' | 'revise' | 'reject'
		reason: string
		ctaText: string
		buttonColor: string
	},
	now = new Date()
) {
	const stale: Array<string> = []
	const result = await database.transaction(async (tx) => {
		const order = await lockedOrder(tx, input.id, input.expectedVersion)
		if (!order.paidAt || !order.material || order.status !== 'in_review') {
			throw new ORPCError('CONFLICT', {
				message: 'Only paid orders with submitted materials can be reviewed.',
			})
		}
		if (input.decision !== 'approve' && !input.reason) {
			throw new ORPCError('BAD_REQUEST', {
				message: 'Provide feedback for the advertiser.',
			})
		}
		let values: Partial<typeof adOrder.$inferInsert> = {
			feedback: input.reason || null,
			updatedAt: now,
		}
		if (input.decision === 'approve') {
			const startsAt = order.startsAt ?? now,
				paidThrough = order.paidThrough ?? nextAdMonth(startsAt)
			const campaignId = order.campaignId ?? randomUUID()
			const [live] = order.campaignId
				? await tx
						.select()
						.from(adCampaign)
						.where(eq(adCampaign.id, order.campaignId))
						.for('update')
				: []
			const campaign = {
				...order.material,
				ctaText: input.ctaText,
				buttonColor: input.buttonColor,
				tier: AD_PLANS[order.plan].tier,
				status: live?.status ?? ('active' as const),
				startMonth: startsAt.toISOString().slice(0, 7),
				months: 1,
				startsAt,
				endsAt: paidThrough,
				updatedAt: now,
			}
			if (live) {
				await tx
					.update(adCampaign)
					.set({ ...campaign, version: sql`${adCampaign.version}+1` })
					.where(eq(adCampaign.id, campaignId))
				for (const key of [live.logo, live.banner]) {
					if (key !== campaign.logo && key !== campaign.banner) stale.push(key)
				}
			} else await tx.insert(adCampaign).values({ ...campaign, id: campaignId })
			values = {
				...values,
				status: 'approved',
				campaignId,
				startsAt,
				paidThrough,
			}
		} else if (input.decision === 'reject' && order.campaignId) {
			const [live] = await tx
				.select()
				.from(adCampaign)
				.where(eq(adCampaign.id, order.campaignId))
			for (const key of [order.material.logo, order.material.banner]) {
				if (key !== live!.logo && key !== live!.banner) stale.push(key)
			}
			values = {
				...values,
				status: 'approved',
				material: {
					name: live!.name,
					description: live!.description,
					websiteUrl: live!.websiteUrl,
					logo: live!.logo,
					banner: live!.banner,
				},
			}
		} else {
			values = {
				...values,
				status: input.decision === 'revise' ? 'changes_requested' : 'rejected',
			}
		}
		const [saved] = await tx
			.update(adOrder)
			.set({ ...values, ...bump })
			.where(eq(adOrder.id, order.id))
			.returning()
		const message =
			input.decision === 'reject' && order.campaignId
				? 'The proposed revision was declined. Your previously approved artwork remains in place. ' +
					input.reason
				: input.reason
		await queueAdNotification(
			tx,
			order.id,
			input.decision === 'approve'
				? 'approved'
				: input.decision === 'revise'
					? 'revision'
					: 'rejected',
			`review:${order.id}:${saved!.version}`,
			message
		)
		return saved!
	})
	await deleteFinalKeysBestEffort([...new Set(stale)])
	return result
}
