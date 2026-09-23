import { oc } from '@orpc/contract'

import { ORPC_ERRORS } from '@altstack/shared/constants/orpc-errors'

export const baseContract = oc.errors(ORPC_ERRORS)
