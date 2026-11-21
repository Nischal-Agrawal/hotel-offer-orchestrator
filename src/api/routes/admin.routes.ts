import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supplierState } from '../../suppliers/supplierState.js';

export const adminRouter = Router();

const statusBodySchema = z.object({
  healthy: z.boolean().optional(),
  latencyMs: z.number().nonnegative().optional(),
});

adminRouter.post('/suppliers/:supplier/status', (req: Request, res: Response) => {
  const supplierParam = req.params.supplier;
  if (supplierParam !== 'supplierA' && supplierParam !== 'supplierB') {
    res.status(400).json({ error: "Invalid supplier identifier. Expected 'supplierA' or 'supplierB'" });
    return;
  }

  const body = statusBodySchema.parse(req.body);
  const updated = supplierState.setStatus(supplierParam, body);
  res.status(200).json({
    supplier: supplierParam,
    ...updated,
  });
});

adminRouter.get('/suppliers/status', (_req: Request, res: Response) => {
  res.status(200).json(supplierState.getAllStatus());
});
