import { z } from 'zod'

export const aboutBodySchema = z.strictObject({
	title: z.string().trim().min(1).max(200),
	description: z.string().trim().min(1).max(500),
	content: z.string().trim().min(1).max(100_000),
})

export const aboutPageSchema = aboutBodySchema.extend({
	version: z.number().int().nonnegative(),
	updatedAt: z.date().nullable(),
})

export const aboutUpdateSchema = aboutBodySchema.extend({
	expectedVersion: z.number().int().nonnegative().max(2_147_483_646),
})

export type AboutBody = z.infer<typeof aboutBodySchema>
export type AboutPage = z.infer<typeof aboutPageSchema>

export const defaultAboutPage: AboutPage = {
	title: 'About AltStack',
	description:
		'Discover open-source software you can explore, compare, and use.',
	content: `## What is AltStack?

AltStack is a directory of open-source projects and developer tools. You can explore projects by category, tag, and license, or search for a tool that fits what you want to build.

## Explore beyond the project name

Project listings bring together descriptions, repository links, license details, and GitHub activity. Collections group projects around a topic so you can explore related tools in one place.

Use these details as a starting point. Before choosing a project, read its documentation and license, and check whether its requirements fit your work.

## Help keep the directory useful

You can [submit a project](/submit) for review, report problems with a listing, or request ownership of a project you maintain. Signed-in users can also bookmark projects to return to later.

AltStack itself is [open source on GitHub](https://github.com/isntboxs/altstack). You can report a bug, suggest an improvement, or contribute to the code.

## Start exploring

[Browse projects](/), explore [categories](/categories), or find a curated starting point in [collections](/collections).`,
	version: 0,
	updatedAt: null,
}
