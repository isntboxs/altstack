import { createAccessControl } from 'better-auth/plugins/access'
import {
	defaultStatements,
	adminAc,
	userAc,
} from 'better-auth/plugins/admin/access'

import { ROLES_MAP } from '@altstack/shared'

const statements = {
	...defaultStatements,
	project: ['update', 'review-claim'],
} as const

export const ac = createAccessControl(statements)

export const roles = {
	[ROLES_MAP.ADMIN]: ac.newRole({ ...adminAc.statements }),
	[ROLES_MAP.USER]: ac.newRole({ ...userAc.statements }),
	[ROLES_MAP.OWNER]: ac.newRole({
		...userAc.statements,
		project: ['update', 'review-claim'],
	}),
	[ROLES_MAP.MAINTAINER]: ac.newRole({
		...userAc.statements,
		project: ['update', 'review-claim'],
	}),
}
