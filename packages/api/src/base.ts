import { implement } from '@orpc/server'
import type { EvlogOrpcContext } from 'evlog/orpc'
import { evlog } from 'evlog/orpc'

import type { ORPCContext } from '@altstack/api/context'
import { contracts } from '@altstack/api/contracts'

export const o = implement(contracts)
	.$context<ORPCContext & EvlogOrpcContext>()
	.use(evlog())
