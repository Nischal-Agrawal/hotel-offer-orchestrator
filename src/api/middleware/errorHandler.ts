import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../utils/logger.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const reqId = req.id || (req.headers['x-request-id'] as string) || 'unknown';

  if (err instanceof ZodError) {
    logger.warn({ reqId, issues: err.issues }, 'Validation error');
    res.status(400).json({
      error: 'Validation Error',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const errorObj = err instanceof Error ? err : new Error(String(err));
  const message = errorObj.message;

  logger.error({ reqId, err: errorObj, message }, 'Unhandled API error');

  if (message.includes('Both suppliers failed') || message.includes('ALL_SUPPLIERS_UNAVAILABLE')) {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'All upstream hotel suppliers are currently unavailable. Please try again shortly.',
    });
    return;
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: errorObj.message || 'An unexpected error occurred',
  });
}
