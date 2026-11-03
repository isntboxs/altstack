import { COMMON_ERROR_STATUS_MAP } from '@orpc/openapi'

import { ORPC_ERRORS } from '@altstack/shared/constants/orpc-errors'

export const ERROR_STATUS_MAP: Record<string, number> = {
	...COMMON_ERROR_STATUS_MAP,
	...Object.fromEntries(
		Object.entries(ORPC_ERRORS).map(([code, error]) => [code, error.status])
	),
}
