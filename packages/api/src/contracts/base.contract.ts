import { oc } from '@orpc/contract'

export const orpcBaseContract = oc.errors({
	BAD_REQUEST: {
		message: `Bad Request. Usually due to missing parameters, or invalid parameters.`,
		status: 400,
	},
	UNAUTHORIZED: {
		message: `Unauthorized. Due to missing or invalid authentication.`,
		status: 401,
	},
	FORBIDDEN: {
		message: `Forbidden. You do not have permission to access this resource or to perform this action.`,
		status: 403,
	},
	NOT_FOUND: {
		message: `Not Found. The requested resource was not found.`,
		status: 404,
	},
	CONFLICT: {
		message: `Conflict. The request could not be completed due to a conflict with the current state of the resource.`,
		status: 409,
	},
	UNPROCESSABLE_CONTENT: {
		message: `Unprocessable Content. The request was well-formed but was unable to be followed due to semantic errors.`,
		status: 422,
	},
	TOO_MANY_REQUESTS: {
		message: `Too Many Requests. You have exceeded the rate limit. Try again later.`,
		status: 429,
	},
	INTERNAL_SERVER_ERROR: {
		message: `Internal Server Error. This is a problem with the server that you cannot fix.`,
		status: 500,
	},
})
