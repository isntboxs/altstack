import { defineRelations, defineRelationsPart } from 'drizzle-orm'

import * as schemas from '@altstack/db/schemas'

export const authRelations = defineRelationsPart(
	{
		user: schemas.user,
		session: schemas.session,
		account: schemas.account,
		verification: schemas.verification,
	},
	(r) => {
		return {
			user: {
				sessions: r.many.session({
					from: r.user.id,
					to: r.session.userId,
				}),
				accounts: r.many.account({
					from: r.user.id,
					to: r.account.userId,
				}),
			},
			session: {
				user: r.one.user({
					from: r.session.userId,
					to: r.user.id,
				}),
			},
			account: {
				user: r.one.user({
					from: r.account.userId,
					to: r.user.id,
				}),
			},
		}
	}
)

export const relations = defineRelations(schemas, (r) => {
	return {
		project: {
			githubRepository: r.one.githubRepository({
				from: r.project.id,
				to: r.githubRepository.projectId,
				optional: false,
			}),
			projectCategories: r.many.projectCategory({
				from: r.project.id,
				to: r.projectCategory.projectId,
			}),
		},

		githubRepository: {
			project: r.one.project({
				from: r.githubRepository.projectId,
				to: r.project.id,
			}),
		},

		category: {
			projectCategories: r.many.projectCategory({
				from: r.category.id,
				to: r.projectCategory.categoryId,
			}),
		},

		projectCategory: {
			project: r.one.project({
				from: r.projectCategory.projectId,
				to: r.project.id,
			}),
			category: r.one.category({
				from: r.projectCategory.categoryId,
				to: r.category.id,
			}),
		},
	}
})
