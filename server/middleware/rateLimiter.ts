import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток входа
  message: {
    error: 'Too many login attempts, please try again later',
    retryAfter: 15 * 60 // секунды
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // не считать успешные попытки
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 100, // максимум 100 запросов в минуту
  message: {
    error: 'Too many API requests, please slow down',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});