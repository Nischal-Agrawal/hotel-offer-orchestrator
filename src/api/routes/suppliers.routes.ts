import { Router, Request, Response } from 'express';
import { SUPPLIER_A_HOTELS, SUPPLIER_B_HOTELS } from '../../suppliers/mockData.js';
import { supplierState } from '../../suppliers/supplierState.js';

export const suppliersRouter = Router();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Supplier A mock endpoint
suppliersRouter.get('/supplierA/hotels', async (req: Request, res: Response) => {
  const state = supplierState.getStatus('supplierA');

  if (state.latencyMs > 0) {
    await sleep(state.latencyMs);
  }

  if (!state.healthy) {
    res.status(503).json({ error: 'Supplier temporarily unavailable' });
    return;
  }

  const city = typeof req.query.city === 'string' ? req.query.city.trim().toLowerCase() : undefined;
  if (city) {
    const filtered = SUPPLIER_A_HOTELS.filter((h) => h.city.toLowerCase() === city);
    res.status(200).json(filtered);
    return;
  }

  res.status(200).json(SUPPLIER_A_HOTELS);
});

// Supplier A health check
suppliersRouter.get('/supplierA/health', async (_req: Request, res: Response) => {
  const state = supplierState.getStatus('supplierA');
  if (state.healthy) {
    res.status(200).json({ status: 'up' });
  } else {
    res.status(503).json({ status: 'down', error: 'Supplier A in simulated outage' });
  }
});

// Supplier B mock endpoint
suppliersRouter.get('/supplierB/hotels', async (req: Request, res: Response) => {
  const state = supplierState.getStatus('supplierB');

  if (state.latencyMs > 0) {
    await sleep(state.latencyMs);
  }

  if (!state.healthy) {
    res.status(503).json({ error: 'Supplier temporarily unavailable' });
    return;
  }

  const city = typeof req.query.city === 'string' ? req.query.city.trim().toLowerCase() : undefined;
  if (city) {
    const filtered = SUPPLIER_B_HOTELS.filter((h) => h.city.toLowerCase() === city);
    res.status(200).json(filtered);
    return;
  }

  res.status(200).json(SUPPLIER_B_HOTELS);
});

// Supplier B health check
suppliersRouter.get('/supplierB/health', async (_req: Request, res: Response) => {
  const state = supplierState.getStatus('supplierB');
  if (state.healthy) {
    res.status(200).json({ status: 'up' });
  } else {
    res.status(503).json({ status: 'down', error: 'Supplier B in simulated outage' });
  }
});
