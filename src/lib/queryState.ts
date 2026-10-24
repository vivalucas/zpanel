import { ApiError } from './api'

export function isAccessError(error: unknown) {
	return error instanceof ApiError && [401, 403, 1000, 1001, 1004, 1005, 1006].includes(error.code)
}
