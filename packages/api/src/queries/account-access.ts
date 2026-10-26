import { ORPCError } from '@orpc/server'
import { and, eq, sql } from 'drizzle-orm'

import type { db } from '@altstack/db'
import { user } from '@altstack/db/schemas'

import { roleSchema } from '@altstack/shared/schemas/role'

export const activeAccount = sql<boolean>`(${user.banned} is not true or (${user.banExpires} is not null and ${user.banExpires} <= now()))`

// Use after locking the project. Ban/role changes lock user rows and therefore
// cannot complete in the middle of an authorized project write.
export async function requireActiveAccount(
	database: Pick<typeof db, 'select'>,
	userId: string,
	lock = false
) {
	const query = database
		.select({ id: user.id, role: user.role })
		.from(user)
		.where(and(eq(user.id, userId), activeAccount))
	const [account] = lock ? await query.for('share') : await query
	if (!account) throw new ORPCError('UNAUTHORIZED')
	return { ...account, role: roleSchema.parse(account.role) }
}
