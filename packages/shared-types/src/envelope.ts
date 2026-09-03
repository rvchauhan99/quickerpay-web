/** The standard response envelope from docs/04_API_CONTRACT.md section 3. */

export interface Pagination {
  page: number
  page_size: number
  total: number
  total_is_estimate: boolean
  has_next: boolean
}

export interface SuccessResponse<T> {
  success: true
  data: T
  request_id: string
}

export interface SuccessListResponse<T> {
  success: true
  data: T[]
  pagination: Pagination
  request_id: string
}

export interface ErrorResponse {
  success: false
  code: ApiErrorCode
  message: string
  details?: Record<string, unknown>
  request_id: string
}

export type ApiResponse<T> = SuccessResponse<T> | SuccessListResponse<T> | ErrorResponse

/**
 * Every error code the API may return. Adding a code here and to the API's
 * error map is one change, so a new failure mode can never ship unnamed.
 */
export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'FORBIDDEN_MENU',
  'FORBIDDEN_SCOPE',
  'SCOPE_EXCEEDS_GRANTOR',
  'NOT_FOUND',
  'TENANT_NOT_FOUND',
  'TENANT_MISMATCH',
  'TENANT_SUSPENDED',
  'TENANT_UNAVAILABLE',
  'TENANT_DB_UNAVAILABLE',
  'CONFLICT',
  'DUPLICATE_UTR',
  'IDEMPOTENCY_KEY_REUSED',
  'INVALID_STATE_TRANSITION',
  'NEGATIVE_MARGIN',
  'MISSING_RATE',
  'INSUFFICIENT_BALANCE',
  'LIMIT_EXCEEDED',
  'INACTIVE_BANKING',
  'TRANSFER_TYPE_MISMATCH',
  'MAKER_CHECKER_SAME_USER',
  'TOO_MANY_ATTEMPTS',
  'OTP_REQUIRED',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'INTERNAL_ERROR',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]
