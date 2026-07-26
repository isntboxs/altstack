import { implement } from '@orpc/server'

import type { ORPCContext } from '@altstack/api/context'
import { contracts } from '@altstack/api/contracts'

export const o = implement(contracts).$context<ORPCContext>()
