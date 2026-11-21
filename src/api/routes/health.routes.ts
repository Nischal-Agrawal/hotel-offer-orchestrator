import { Router, Request, Response } from 'express';
import { redisService } from '../../services/redis.service.js';
import { temporalService } from '../../services/temporal.service.js';
import { supplierState } from '../../suppliers/supplierState.js';
import { HealthCheckResponse, DependencyHealth } from '../../domain/types.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  const startA = Date.now();
  const stateA = supplierState.getStatus('supplierA');
  const supplierAHealth: DependencyHealth = stateA.healthy
    ? { status: 'up', latencyMs: Date.now() - startA + stateA.latencyMs }
    : { status: 'down', latencyMs: Date.now() - startA, error: 'Supplier A simulated outage' };

  const startB = Date.now();
  const stateB = supplierState.getStatus('supplierB');
  const supplierBHealth: DependencyHealth = stateB.healthy
    ? { status: 'up', latencyMs: Date.now() - startB + stateB.latencyMs }
    : { status: 'down', latencyMs: Date.now() - startB, error: 'Supplier B simulated outage' };

  const [redisHealth, temporalHealth] = await Promise.all([
    redisService.checkHealth(),
    temporalService.checkHealth(),
  ]);

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  const criticalDown =
    redisHealth.status === 'down' ||
    temporalHealth.status === 'down' ||
    (supplierAHealth.status === 'down' && supplierBHealth.status === 'down');

  if (criticalDown) {
    status = 'unhealthy';
  } else if (supplierAHealth.status === 'down' || supplierBHealth.status === 'down') {
    status = 'degraded';
  }

  const responseBody: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    dependencies: {
      redis: redisHealth,
      temporal: temporalHealth,
      supplierA: supplierAHealth,
      supplierB: supplierBHealth,
    },
  };

  const statusCode = status === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(responseBody);
});
