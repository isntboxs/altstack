import { and, asc, eq, gt, lte, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { adminProcedure, publicProcedure } from '@altstack/api/procedures'
import {
	deleteFinalKeysBestEffort,
	promoteTempImageToAd,
	InvalidTempUploadError,
	TempUploadMissingError,
} from '@altstack/api/storage'

import type { db as database } from '@altstack/db'
import { adCampaign } from '@altstack/db/schemas'

import { campaignPeriod } from '@altstack/shared/schemas/ads'
import type { AdBody } from '@altstack/shared/schemas/ads'

export const adsRouter = {
	list: publicProcedure.ads.list.handler(async ({ context: { db } }) => {
		const serverNow = new Date()
		const campaigns = await db
			.select()
			.from(adCampaign)
			.where(
				and(
					eq(adCampaign.status, 'active'),
					lte(adCampaign.startsAt, serverNow),
					gt(adCampaign.endsAt, serverNow)
				)
			)
			.orderBy(asc(adCampaign.createdAt), asc(adCampaign.id))
		return { campaigns, serverNow }
	}),
}
async function save(
	db: typeof database,
	body: AdBody,
	id: string,
	expectedVersion?: number
) {
	const promoted: Array<string> = [],
		stale: Array<string> = [],
		temporary: Array<string> = []
	try {
		const result = await db.transaction(async (tx) => {
			const [current] = expectedVersion
				? await tx
						.select()
						.from(adCampaign)
						.where(eq(adCampaign.id, id))
						.for('update')
				: []
			if (expectedVersion && !current) throw new Error('AD_NOT_FOUND')
			if (current && current.version !== expectedVersion) {
				throw new Error('AD_CONFLICT')
			}
			const assets = { logo: body.logo, banner: body.banner }
			for (const kind of ['logo', 'banner'] as const) {
				const key = body[kind]
				if (key.startsWith('tmp/')) {
					assets[kind] = await promoteTempImageToAd(key, id, kind)
					promoted.push(assets[kind])
					temporary.push(key)
					if (current) stale.push(current[kind])
				} else if (!current || key !== current[kind]) {
					throw new Error('AD_ASSET')
				}
			}
			const values = {
				...body,
				...assets,
				...campaignPeriod(body.startMonth, body.months),
				updatedAt: new Date(),
			}
			const [row] = current
				? await tx
						.update(adCampaign)
						.set({ ...values, version: sql`${adCampaign.version} + 1` })
						.where(eq(adCampaign.id, id))
						.returning()
				: await tx
						.insert(adCampaign)
						.values({ ...values, id })
						.returning()
			if (!row) throw new Error('AD_WRITE')
			return row
		})
		await deleteFinalKeysBestEffort([...stale, ...temporary])
		return result
	} catch (error) {
		await deleteFinalKeysBestEffort(promoted)
		throw error
	}
}
function mappedError(error: unknown) {
	if (
		error instanceof TempUploadMissingError ||
		error instanceof InvalidTempUploadError
	) {
		return 'UPLOAD_EXPIRED'
	}
	if (error instanceof Error) {
		if (error.message === 'AD_CONFLICT') return 'CONFLICT'
		if (error.message === 'AD_NOT_FOUND') return 'NOT_FOUND'
		if (error.message === 'AD_ASSET') return 'BAD_REQUEST'
	}
	return 'INTERNAL_SERVER_ERROR'
}
export const adminAdsRouter = {
	list: adminProcedure.admin.ads.list.handler(({ context: { db } }) =>
		db
			.select()
			.from(adCampaign)
			.orderBy(asc(adCampaign.name), asc(adCampaign.id))
	),
	create: adminProcedure.admin.ads.create.handler(
		async ({ context: { db }, input, errors }) => {
			try {
				return await save(db, input.body, randomUUID())
			} catch (error) {
				throw errors[mappedError(error)]()
			}
		}
	),
	update: adminProcedure.admin.ads.update.handler(
		async ({ context: { db }, input, errors }) => {
			const { expectedVersion, ...body } = input.body
			try {
				return await save(db, body, input.params.id, expectedVersion)
			} catch (error) {
				throw errors[mappedError(error)]()
			}
		}
	),
	delete: adminProcedure.admin.ads.delete.handler(
		async ({ context: { db }, input, errors }) => {
			const [row] = await db
				.delete(adCampaign)
				.where(
					and(
						eq(adCampaign.id, input.params.id),
						eq(adCampaign.version, input.body.expectedVersion)
					)
				)
				.returning()
			if (!row) {
				throw errors.CONFLICT({
					message: 'Campaign changed or was deleted. Reload before continuing.',
				})
			}
			await deleteFinalKeysBestEffort([row.logo, row.banner])
			return { success: true as const }
		}
	),
}
