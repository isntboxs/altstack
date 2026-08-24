import { defineRelations } from 'drizzle-orm'

import * as schemas from '@altstack/db/schemas'

export const relations = defineRelations(schemas, (r) => {
	return {
		user: {
			sessions: r.many.session(),
			accounts: r.many.account(),
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

		project: {
			githubRepository: r.one.githubRepository({
				from: r.project.id,
				to: r.githubRepository.projectId,
			}),
		},

		githubRepository: {
			project: r.one.project({
				from: r.githubRepository.projectId,
				to: r.project.id,
			}),
		},
	}
})
