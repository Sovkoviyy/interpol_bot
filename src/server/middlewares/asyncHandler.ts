import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler to automatically catch errors and pass them to the Express error handler.
 * Eliminates the need for try/catch in every route.
 */
export const asyncHandler = (
  fn: (req: Request | any, res: Response | any, next: NextFunction) => Promise<any>
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
