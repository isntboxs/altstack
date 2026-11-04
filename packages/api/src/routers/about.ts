import { and, eq } from 'drizzle-orm'

import { adminProcedure, publicProcedure } from '@altstack/api/procedures'

import type { Database } from '@altstack/db'
import { aboutPage } from '@altstack/db/schemas'

import { defaultAboutPage } from '@altstack/shared/schemas'

const fields = {
	title: aboutPage.title,
	description: aboutPage.description,
	content: aboutPage.content,
	version: aboutPage.version,
	updatedAt: aboutPage.updatedAt,
}

async function getAbout(database: Pick<Database, 'select'>) {
	const [page] = await database
		.select(fields)
		.from(aboutPage)
		.where(eq(aboutPage.id, 'about'))
	return page ?? { ...defaultAboutPage }
}

export const aboutRouter = {
	get: publicProcedure.about.get.handler(({ context: { db } }) => getAbout(db)),
}

export const adminAboutRouter = {
	get: adminProcedure.admin.about.get.handler(({ context: { db } }) =>
		getAbout(db)
	),
	update: adminProcedure.admin.about.update.handler(
		async ({ context: { db }, input, errors }) => {
			const { expectedVersion, ...body } = input.body
			const values = {
				...body,
				version: expectedVersion + 1,
				updatedAt: new Date(),
			}
			const [page] =
				expectedVersion === 0
					? await db
							.insert(aboutPage)
							.values({ id: 'about', ...values })
							.onConflictDoNothing()
							.returning(fields)
					: await db
							.update(aboutPage)
							.set(values)
							.where(
								and(
									eq(aboutPage.id, 'about'),
									eq(aboutPage.version, expectedVersion)
								)
							)
							.returning(fields)
			if (!page) {
				throw errors.CONFLICT({
					message:
						'This page changed. Reload the latest version before saving.',
				})
			}
			return page
		}
	),
}
