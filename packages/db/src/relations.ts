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
		user: {
			projects: r.many.project({
				from: r.user.id,
				to: r.project.submitterId,
			}),
		},

		project: {
			submitter: r.one.user({
				from: r.project.submitterId,
				to: r.user.id,
			}),

			githubRepo: r.one.githubRepo({
				from: r.project.id,
				to: r.githubRepo.projectId,
			}),
		},

		githubRepo: {
			project: r.one.project({
				from: r.githubRepo.projectId,
				to: r.project.id,
			}),
		},
	}
})
