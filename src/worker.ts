import { Worker, NativeConnection } from '@temporalio/worker';
import { env } from './config/env.js';
import { TASK_QUEUE } from './temporal/constants.js';
import * as activities from './temporal/activities.js';
import { redisService } from './services/redis.service.js';
import { logger } from './utils/logger.js';
import { fileURLToPath } from 'url';
import path from 'path';

async function runWorker() {
  logger.info('Initializing Temporal Worker...');
  await redisService.connect();

  const connection = await NativeConnection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const workflowsPath = path.resolve(__dirname, './temporal/workflows.js');

  const worker = await Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: env.TEMPORAL_TASK_QUEUE || TASK_QUEUE,
    workflowsPath,
    activities,
  });

  logger.info(
    {
      address: env.TEMPORAL_ADDRESS,
      namespace: env.TEMPORAL_NAMESPACE,
      taskQueue: env.TEMPORAL_TASK_QUEUE || TASK_QUEUE,
    },
    'Temporal Worker started successfully. Polling for workflow tasks...'
  );

  await worker.run();
}

runWorker().catch((err) => {
  logger.fatal({ err }, 'Temporal Worker failed to run');
  process.exit(1);
});
