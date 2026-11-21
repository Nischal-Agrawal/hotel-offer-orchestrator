import express, { Express } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { pinoHttp } from 'pino-http';
import { logger } from '../utils/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { hotelsRouter } from './routes/hotels.routes.js';
import { suppliersRouter } from './routes/suppliers.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { metricsRouter } from './routes/metrics.routes.js';
import { openApiSpec } from './docs/swagger.js';

export function createApp(): Express {
  const app = express();

  // Security headers (relaxed CSP allows Swagger UI assets to load without inline script issues)
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());
  app.use(requestIdMiddleware);

  // Serve static UI assets from public directory
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  // Rate Limiter for public API endpoints
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again in 1 minute.' },
  });
  app.use('/api', apiLimiter);

  // Structured request logging with correlation IDs
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id || (req.headers['x-request-id'] as string) || '',
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );

  // Interactive Swagger UI documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openApiSpec);
  });

  // Observability & metrics
  app.use(metricsRouter);

  // Application routes
  app.use(suppliersRouter);
  app.use('/admin', adminRouter);
  app.use(healthRouter);
  app.use(hotelsRouter);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}
