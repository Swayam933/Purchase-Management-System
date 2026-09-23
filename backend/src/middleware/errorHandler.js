import { AppError } from '../utils/AppError.js';
import { config } from '../config/env.js';

/**
 * Single exit point for every failure (assignment section 14).
 *
 * - AppError  -> its own status/code/message/details are returned verbatim.
 * - JSON body parse failure -> 400 with a clear message.
 * - anything else -> logged server side, answered with a generic 500 so
 *   stack traces, SQL text and other internals are never exposed.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
export const errorHandler = (error, req, res, next) => {
  if (error instanceof AppError) {
    return res.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }

  // express.json() surfaces malformed payloads as a SyntaxError with `body`.
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      success: false,
      error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON' },
    });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, error);

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong while processing the request',
      ...(config.env === 'development' ? { debug: error?.message } : {}),
    },
  });
};
