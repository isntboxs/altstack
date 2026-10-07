import { oc } from '@orpc/contract'
import { openapi } from '@orpc/openapi'

import { ORPC_ERRORS } from '@altstack/shared/constants/orpc-errors'

export const baseContract = oc.errors(ORPC_ERRORS)

// Override the document's cookie requirement on every public operation.
export const publicContract = baseContract.meta(
	openapi({
		spec: (operation) => {
			return { ...operation, security: [] }
		},
	})
)
