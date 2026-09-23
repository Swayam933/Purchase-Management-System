/**
 * Wraps an async route handler so rejected promises reach the central error
 * middleware instead of hanging the request.
 */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
