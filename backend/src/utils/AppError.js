/**
 * Operational error carrying the HTTP status, a machine readable code and
 * optional field level details. Anything thrown that is *not* an AppError is
 * treated as an unexpected failure and reported as a generic 500 so internal
 * details never leak to the client (assignment section 14).
 */
export class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, AppError);
  }
}

/** 400 - malformed request or failed field validation. */
export const badRequest = (message, details = null) =>
  new AppError(message, { status: 400, code: 'VALIDATION_ERROR', details });

/** 404 - the referenced record does not exist. */
export const notFound = (message) => new AppError(message, { status: 404, code: 'NOT_FOUND' });

/**
 * 409 - the request is well formed but conflicts with the current business
 * state (insufficient stock, inactive item, duplicate order id, delete blocked
 * by history).
 */
export const conflict = (message, details = null) =>
  new AppError(message, { status: 409, code: 'CONFLICT', details });

/** 405 - the operation is deliberately not supported (e.g. deleting a purchase). */
export const methodNotAllowed = (message) =>
  new AppError(message, { status: 405, code: 'METHOD_NOT_ALLOWED' });
