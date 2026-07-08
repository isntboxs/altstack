import { implement } from '@orpc/server'
import { evlog } from 'evlog/orpc'

import type { ORPCContext } from '@cort/api/context'
import { orpcContracts } from '@cort/api/contracts'

export const o = implement(orpcContracts).$context<ORPCContext>().use(evlog())

export const publicProcedure = o
