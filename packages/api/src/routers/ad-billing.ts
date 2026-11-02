import { ORPCError } from '@orpc/server'
import { and, desc, eq, sql, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { adOrderView, requireAdAccess } from '@altstack/api/ad-access'
import {
	adEmailConfig,
	queueAdNotification,
} from '@altstack/api/ad-notifications'
import {
	confirmAdPayment,
	requestAdRenewal,
	reviewAdOrder,
	submitAdMaterials,
} from '@altstack/api/ad-orders'
import { claimClientIp, enforceClaimQuota } from '@altstack/api/ownership-otp'
import { publicProcedure, adminProcedure } from '@altstack/api/procedures'
import { isUniqueViolation } from '@altstack/api/queries/pg-error'
import {
	InvalidTempUploadError,
	TempUploadMissingError,
} from '@altstack/api/storage'

import { adCampaign, adOrder, adPayment, adUpload } from '@altstack/db/schemas'

import { AD_PLANS } from '@altstack/shared/schemas/ad-billing'

import {
	requestImageUpload,
	removeImageUpload,
	changeImageUpload,
	LOGO_KIND,
	SCREENSHOT_KIND,
} from './upload'

async function mapped<T>(action: () => Promise<T>): Promise<T> {
	try {
		return await action()
	} catch (error) {
		if (error instanceof ORPCError) throw error
		if (isUniqueViolation(error)) {
			throw new ORPCError('CONFLICT', {
				message: 'This payment reference is already recorded.',
			})
		}
		if (
			error instanceof InvalidTempUploadError ||
			error instanceof TempUploadMissingError
		) {
			throw new ORPCError('UPLOAD_EXPIRED')
		}
		throw new ORPCError('INTERNAL_SERVER_ERROR', {
			message:
				'Unable to save this order. Check its current status and try again.',
		})
	}
}
const ready = () => {
	if (!adEmailConfig()) {
		throw new ORPCError('SERVICE_UNAVAILABLE', {
			message:
				'Advertising orders are temporarily unavailable. Please try again later.',
		})
	}
}
const uploadHandlers = (kind: 'logo' | 'banner') => {
	const procedure = publicProcedure.adBilling.upload[kind]
	return {
		request: procedure.request.handler(async ({ input, context: { db } }) =>
			mapped(async () => {
				const order = await requireAdAccess(db, input.body)
				if (order.status === 'rejected') throw new ORPCError('FORBIDDEN')
				await enforceClaimQuota(db, `ad-upload:${order.id}`, 30)
				const upload = await requestImageUpload(
					{ ...input.body, filename: `${randomUUID()}-${input.body.filename}` },
					kind === 'logo' ? LOGO_KIND : SCREENSHOT_KIND
				)
				await db
					.insert(adUpload)
					.values({ key: upload.key, orderId: order.id, kind })
				return upload
			})
		),
		remove: procedure.remove.handler(
			async ({ input, context: { db }, errors }) =>
				mapped(async () => {
					await requireAdAccess(db, input.body)
					return db.transaction(async (tx) => {
						const [owned] = await tx
							.select()
							.from(adUpload)
							.where(
								and(
									eq(adUpload.key, input.body.key),
									eq(adUpload.orderId, input.body.id),
									eq(adUpload.kind, kind)
								)
							)
							.for('update')
						if (!owned) throw new ORPCError('NOT_FOUND')
						await removeImageUpload(owned.key, errors)
						await tx.delete(adUpload).where(eq(adUpload.key, owned.key))
						return { success: true as const }
					})
				})
		),
		change: procedure.change.handler(
			async ({ input, context: { db }, errors }) =>
				mapped(async () => {
					await requireAdAccess(db, input.body)
					return db.transaction(async (tx) => {
						// Lock in a consistent order for simultaneous replacements.
						const owned = await tx
							.select()
							.from(adUpload)
							.where(
								and(
									eq(adUpload.orderId, input.body.id),
									eq(adUpload.kind, kind)
								)
							)
							.orderBy(adUpload.key)
							.for('update')
						if (
							![input.body.oldKey, input.body.newKey].every((key) =>
								owned.some((row) => row.key === key)
							)
						) {
							throw new ORPCError('NOT_FOUND')
						}
						await changeImageUpload(
							input.body.oldKey,
							input.body.newKey,
							errors
						)
						if (input.body.oldKey !== input.body.newKey) {
							await tx
								.delete(adUpload)
								.where(eq(adUpload.key, input.body.oldKey))
						}
						return { success: true as const }
					})
				})
		),
	}
}
export const adBillingRouter = {
	config: publicProcedure.adBilling.config.handler(() => {
		return {
			available: !!adEmailConfig(),
			contactEmail: adEmailConfig()?.contactEmail ?? null,
		}
	}),
	create: publicProcedure.adBilling.create.handler(
		async ({ input, context: { db, requestHeaders } }) =>
			mapped(async () => {
				ready()
				const email = input.body.email.toLowerCase()
				await enforceClaimQuota(
					db,
					`ad-order-ip:${claimClientIp(requestHeaders)}`,
					10
				)
				await enforceClaimQuota(db, `ad-order-email:${email}`, 3)
				await db.transaction(async (tx) => {
					await tx.execute(
						sql`select pg_advisory_xact_lock(hashtext(${`ad-order:${email}:${input.body.plan}`}))`
					)
					const [existing] = await tx
						.select()
						.from(adOrder)
						.where(
							and(
								eq(adOrder.email, email),
								eq(adOrder.plan, input.body.plan),
								eq(adOrder.status, 'pending_payment')
							)
						)
						.limit(1)
					if (existing) return
					const [order] = await tx
						.insert(adOrder)
						.values({
							email,
							plan: input.body.plan,
							amount: AD_PLANS[input.body.plan].amount,
						})
						.returning()
					await queueAdNotification(
						tx,
						order!.id,
						'ordered',
						`ordered:${order!.id}`
					)
				})
				// Management credentials are delivered only to the supplied mailbox.
				return { success: true as const }
			})
	),
	get: publicProcedure.adBilling.get.handler(
		async ({ input, context: { db } }) =>
			adOrderView(await requireAdAccess(db, input.body, false))
	),
	submit: publicProcedure.adBilling.submit.handler(
		async ({ input, context: { db } }) =>
			mapped(async () => {
				await requireAdAccess(db, input.body)
				await enforceClaimQuota(db, `ad-materials:${input.body.id}`, 10)
				return adOrderView(
					await submitAdMaterials(
						db,
						input.body.id,
						input.body.expectedVersion,
						input.body.material
					)
				)
			})
	),
	requestRenewal: publicProcedure.adBilling.requestRenewal.handler(
		async ({ input, context: { db } }) =>
			mapped(async () => {
				await requireAdAccess(db, input.body)
				return adOrderView(await requestAdRenewal(db, input.body.id))
			})
	),
	requestAccess: publicProcedure.adBilling.requestAccess.handler(
		async ({ input, context: { db, requestHeaders } }) =>
			mapped(async () => {
				ready()
				const email = input.body.email.toLowerCase()
				await enforceClaimQuota(
					db,
					`ad-access-ip:${claimClientIp(requestHeaders)}`,
					10
				)
				await enforceClaimQuota(db, `ad-access-email:${email}`, 3)
				const orders = await db
					.select({ id: adOrder.id })
					.from(adOrder)
					.where(eq(adOrder.email, email))
					.orderBy(desc(adOrder.createdAt))
					.limit(10)
				await db.transaction(async (tx) => {
					for (const order of orders) {
						await queueAdNotification(
							tx,
							order.id,
							'access',
							`access:${order.id}:${randomUUID()}`
						)
					}
				})
				return { success: true as const }
			})
	),
	upload: { logo: uploadHandlers('logo'), banner: uploadHandlers('banner') },
}
export const adminAdBillingRouter = {
	setStatus: adminProcedure.admin.adBilling.setStatus.handler(
		async ({ input, context: { db } }) =>
			mapped(() =>
				db.transaction(async (tx) => {
					const [order] = await tx
						.select()
						.from(adOrder)
						.where(eq(adOrder.id, input.body.id))
						.for('update')
					if (
						!order ||
						order.version !== input.body.expectedVersion ||
						!order.campaignId
					) {
						throw new ORPCError('CONFLICT')
					}
					await tx
						.update(adCampaign)
						.set({
							status: input.body.status,
							version: sql`${adCampaign.version}+1`,
							updatedAt: new Date(),
						})
						.where(eq(adCampaign.id, order.campaignId))
					const [saved] = await tx
						.update(adOrder)
						.set({ version: sql`${adOrder.version}+1`, updatedAt: new Date() })
						.where(eq(adOrder.id, order.id))
						.returning()
					return adOrderView(saved!)
				})
			)
	),
	list: adminProcedure.admin.adBilling.list.handler(
		async ({ context: { db } }) => {
			const orders = await db
				.select()
				.from(adOrder)
				.orderBy(desc(adOrder.createdAt))
			if (orders.length === 0) return []
			const payments = await db
				.select()
				.from(adPayment)
				.where(
					inArray(
						adPayment.orderId,
						orders.map((order) => order.id)
					)
				)
				.orderBy(desc(adPayment.createdAt))
			return orders.map((order) => {
				return {
					...adOrderView(order),
					payments: payments.filter((payment) => payment.orderId === order.id),
				}
			})
		}
	),
	confirmPayment: adminProcedure.admin.adBilling.confirmPayment.handler(
		async ({ input, context: { db, auth } }) =>
			mapped(async () =>
				adOrderView(await confirmAdPayment(db, input.body, auth.user.id))
			)
	),
	review: adminProcedure.admin.adBilling.review.handler(
		async ({ input, context: { db } }) =>
			mapped(async () => adOrderView(await reviewAdOrder(db, input.body)))
	),
}
