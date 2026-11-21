import { createApp } from './api/app.js';
import { env } from './config/env.js';
import { redisService } from './services/redis.service.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  await redisService.connect();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`Hotel Offer Orchestrator API listening on port ${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await redisService.disconnect();
      logger.info('Redis disconnected. Exiting process.');
      process.exit(0);
    });

    // Force shutdown if cleanup takes too long
    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcefully terminating.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start API server');
  process.exit(1);
});
