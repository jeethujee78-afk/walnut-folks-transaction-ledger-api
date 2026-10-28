import type { ErrorRequestHandler, RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError, Errors } from '../errors/AppError';
import { isDatabaseUnavailable, isPgError } from '../utils/dbErrors';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(Errors.routeNotFound(req.method, req.path));
};

type BodyParserError = { type?: string; status?: number };

function send(res: Parameters<ErrorRequestHandler>[2], status: number, code: string, message: string, details?: unknown) {
  res.status(status).json({ error: { code, message, ...(details !== undefined ? { details } : {}) } });
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return send(res, err.statusCode, err.code, err.message, err.details);
  }

  const parserError = err as BodyParserError;
  if (parserError?.type === 'entity.parse.failed') {
    return send(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  if (parserError?.type === 'entity.too.large') {
    return send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  // Everything below is unexpected. Log the detail server-side; never return it to the client.
  if (env.NODE_ENV !== 'test') console.error('Unhandled error:', err);

  if (isDatabaseUnavailable(err)) {
    return send(res, 503, 'DATABASE_UNAVAILABLE', 'The database is temporarily unavailable');
  }
  if (isPgError(err)) {
    return send(res, 500, 'DATABASE_ERROR', 'A database error occurred');
  }
  return send(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
};
