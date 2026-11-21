import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { redisService } from '../../services/redis.service.js';
import { temporalService } from '../../services/temporal.service.js';
import { singleflight } from '../../utils/singleflight.js';
import { cacheHitsTotal, cacheMissesTotal, httpRequestsTotal } from '../../utils/metrics.js';

export const hotelsRouter = Router();

const getHotelsQuerySchema = z
  .object({
    city: z
      .string({ required_error: "Query parameter 'city' is required" })
      .trim()
      .min(1, "Query parameter 'city' cannot be empty"),
    minPrice: z.coerce
      .number()
      .nonnegative("Parameter 'minPrice' must be greater than or equal to 0")
      .optional(),
    maxPrice: z.coerce
      .number()
      .nonnegative("Parameter 'maxPrice' must be greater than or equal to 0")
      .optional(),
    limit: z.coerce
      .number()
      .int()
      .positive("Parameter 'limit' must be a positive integer")
      .optional(),
    offset: z.coerce
      .number()
      .int()
      .nonnegative("Parameter 'offset' must be a non-negative integer")
      .optional(),
    refresh: z
      .string()
      .optional()
      .transform((val) => val === 'true' || val === '1'),
  })
  .refine(
    (data) => {
      if (data.minPrice !== undefined && data.maxPrice !== undefined) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    {
      message: "'minPrice' must be less than or equal to 'maxPrice'",
      path: ['minPrice'],
    }
  );

hotelsRouter.get('/api/hotels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = getHotelsQuerySchema.parse(req.query);
    const city = query.city.toLowerCase();
    const isRefreshRequested = query.refresh === true;

    let cacheStatus: 'HIT' | 'MISS' = 'MISS';
    let workflowId: string | undefined;
    let degradedSuppliers: string[] = [];

    // Check Redis cache metadata if not explicitly refreshed
    const existingMeta = isRefreshRequested ? null : await redisService.getCacheMeta(city);

    if (existingMeta) {
      cacheStatus = 'HIT';
      cacheHitsTotal.inc({ city });
      degradedSuppliers = existingMeta.degradedSuppliers || [];
    } else {
      cacheStatus = 'MISS';
      cacheMissesTotal.inc({ city });

      // Coalesce duplicate concurrent workflow triggers (Singleflight pattern)
      const execution = (await singleflight.do(`hotel-workflow-${city}`, () =>
        temporalService.executeHotelSearchWorkflow(city)
      )) as { workflowId: string; result: { degradedSuppliers?: string[] } };

      workflowId = execution.workflowId;
      degradedSuppliers = execution.result.degradedSuppliers || [];
    }

    // Retrieve the results filtered inside Redis via Sorted Set + Hash + Lua script
    const finalOffers = await redisService.getFilteredOffers(city, {
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      limit: query.limit,
      offset: query.offset,
    });

    // Set observability headers
    res.setHeader('X-Cache-Status', cacheStatus);
    if (workflowId) {
      res.setHeader('X-Workflow-Id', workflowId);
    }
    if (degradedSuppliers.length > 0) {
      res.setHeader('X-Degraded-Suppliers', degradedSuppliers.join(', '));
    }

    httpRequestsTotal.inc({ method: 'GET', route: '/api/hotels', status_code: '200' });

    // Return the strict JSON array format
    res.status(200).json(finalOffers);
  } catch (err) {
    httpRequestsTotal.inc({ method: 'GET', route: '/api/hotels', status_code: '500' });
    next(err);
  }
});
