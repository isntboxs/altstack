import { publicProcedure } from '@altstack/api/procedures'
import { listPublicLicenses } from '@altstack/api/queries/license'

export const licenseRouter = {
	list: publicProcedure.license.list.handler(async ({ context }) => {
		return {
			licenses: await listPublicLicenses(context.db),
		}
	}),
	getBySlug: publicProcedure.license.getBySlug.handler(
		async ({ context, input, errors }) => {
			const [license] = await listPublicLicenses(context.db, input.params.slug)
			if (!license) throw errors.NOT_FOUND()
			return { license }
		}
	),
}
