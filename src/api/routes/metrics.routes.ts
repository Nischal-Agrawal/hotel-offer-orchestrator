import { Router, Request, Response } from 'express';
import { prometheusRegistry } from '../../utils/metrics.js';

export const metricsRouter = Router();

metricsRouter.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', prometheusRegistry.register.contentType);
    const metrics = await prometheusRegistry.register.metrics();
    res.status(200).send(metrics);
  } catch (err) {
    res.status(500).send((err as Error).message);
  }
});
