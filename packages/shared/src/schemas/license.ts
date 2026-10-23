import { z } from 'zod'

export const licenseSlugSchema = z
	.string()
	.trim()
	.toLowerCase()
	.regex(/^[a-z0-9][a-z0-9.+-]{0,99}$/)

export const githubLicenseFields = {
	licenseKey: z.string().nullable().default(null),
	licenseName: z.string().nullable().default(null),
	licenseSpdxId: z.string().nullable().default(null),
	licenseSlug: licenseSlugSchema.nullable().default(null),
	licenseUrl: z.url().nullable().default(null),
	archived: z.boolean().nullable().default(null),
}

export const licenseCountSchema = z.object({
	slug: licenseSlugSchema,
	name: z.string(),
	identifier: z.string(),
	projectCount: z.number().int().positive(),
})
export const listLicensesOutputSchema = z.object({
	licenses: z.array(licenseCountSchema),
})
export const getLicenseInputSchema = z.object({
	params: z.object({ slug: licenseSlugSchema }),
})
export const getLicenseOutputSchema = z.object({ license: licenseCountSchema })
