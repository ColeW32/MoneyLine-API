import { nanoid } from 'nanoid'

/**
 * Standard API response envelope.
 */
export function success(data, meta = {}) {
  return {
    success: true,
    data,
    meta: {
      ...meta,
      requestId: `ml_req_${nanoid(12)}`,
    },
    error: null,
  }
}

export function error(message, statusCode = 400, details = null) {
  return {
    success: false,
    data: null,
    meta: {
      requestId: `ml_req_${nanoid(12)}`,
    },
    error: {
      message,
      statusCode,
      ...(details && { details }),
    },
  }
}
