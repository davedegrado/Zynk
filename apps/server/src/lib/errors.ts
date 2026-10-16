import type { ApiErrorCode, FeatureId } from '@zynk/shared';

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  validation_failed: 400,
  unauthorized: 401,
  invalid_credentials: 401,
  forbidden: 403,
  account_suspended: 403,
  not_friends: 403,
  blocked: 403,
  feature_locked: 403,
  not_found: 404,
  conflict: 409,
  username_taken: 409,
  payload_too_large: 413,
  unknown_item: 422,
  rate_limited: 429,
  cooldown: 429,
  purchases_unavailable: 503,
  internal: 500,
};

export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly extra: { retryAfterMs?: number; feature?: FeatureId; fields?: Record<string, string> } = {},
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export const notFound = (what = 'Not found') => new ApiError('not_found', what);
