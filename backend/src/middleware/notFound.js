import { AppError } from '../utils/AppError.js';

/** Catch-all for unmatched API routes. */
export const notFoundHandler = (req, _res, next) => {
  next(
    new AppError(`Route not found: ${req.method} ${req.originalUrl}`, {
      status: 404,
      code: 'ROUTE_NOT_FOUND',
    }),
  );
};
