import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export const errorHandler = (
  err: any, 
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id
  });

  // Validation errors
  if (err.name === 'ValidationError' || err.code === 'INVALID_INPUT') {
    return res.status(400).json({
      message: 'Validation failed',
      details: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // Authentication errors
  if (err.name === 'UnauthorizedError' || err.code === 'UNAUTHORIZED') {
    return res.status(401).json({
      message: 'Authentication required'
    });
  }

  // Permission errors
  if (err.name === 'ForbiddenError' || err.code === 'FORBIDDEN') {
    return res.status(403).json({
      message: 'Access denied'
    });
  }

  // Database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      message: 'Service temporarily unavailable'
    });
  }

  // Default server error
  res.status(500).json({
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err.message 
    })
  });
};