export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Hotel Offer Orchestrator API',
    version: '1.0.0',
    description:
      'Production-grade distributed hotel offer aggregation engine with Temporal orchestration and Redis-side price range indexing.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local Server' }],
  paths: {
    '/api/hotels': {
      get: {
        summary: 'Search & Deduplicate Hotel Offers',
        description:
          'Aggregates offers from Supplier A and Supplier B, deduplicates best offers via Temporal, caches them, and applies Redis-side range filtering.',
        parameters: [
          {
            name: 'city',
            in: 'query',
            required: true,
            schema: { type: 'string', example: 'delhi' },
            description: 'Destination city (e.g. delhi, mumbai)',
          },
          {
            name: 'minPrice',
            in: 'query',
            required: false,
            schema: { type: 'number', minimum: 0, example: 5000 },
            description: 'Minimum price filter',
          },
          {
            name: 'maxPrice',
            in: 'query',
            required: false,
            schema: { type: 'number', minimum: 0, example: 6000 },
            description: 'Maximum price filter',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, example: 10 },
            description: 'Optional pagination limit (Redis-side)',
          },
          {
            name: 'offset',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 0, example: 0 },
            description: 'Optional pagination offset (Redis-side)',
          },
          {
            name: 'refresh',
            in: 'query',
            required: false,
            schema: { type: 'boolean', example: false },
            description: 'Force a fresh Temporal workflow execution, bypassing Redis cache',
          },
        ],
        responses: {
          '200': {
            description: 'Deduplicated hotel offers sorted by price',
            headers: {
              'X-Request-Id': { schema: { type: 'string' } },
              'X-Cache-Status': { schema: { type: 'string', enum: ['HIT', 'MISS'] } },
              'X-Workflow-Id': { schema: { type: 'string' } },
              'X-Degraded-Suppliers': { schema: { type: 'string' } },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', example: 'Holtin' },
                      price: { type: 'number', example: 5340 },
                      supplier: { type: 'string', example: 'Supplier B' },
                      commissionPct: { type: 'number', example: 20 },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation Error (e.g. minPrice > maxPrice)' },
          '503': { description: 'All upstream suppliers unavailable' },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Deep System Health Probe',
        description: 'Probes Redis, Temporal cluster, Supplier A, and Supplier B in parallel.',
        responses: {
          '200': { description: 'Healthy or Degraded (serviceable)' },
          '503': { description: 'Unhealthy (critical dependencies down)' },
        },
      },
    },
    '/metrics': {
      get: {
        summary: 'Prometheus Metrics',
        description: 'Exposes HTTP, Redis cache hit/miss, and Temporal latency metrics for scraping.',
        responses: {
          '200': { description: 'Prometheus text format' },
        },
      },
    },
    '/supplierA/hotels': {
      get: {
        summary: 'Mock Supplier A Endpoint',
        parameters: [{ name: 'city', in: 'query', required: false, schema: { type: 'string' } }],
        responses: { '200': { description: 'Supplier A listings' } },
      },
    },
    '/supplierB/hotels': {
      get: {
        summary: 'Mock Supplier B Endpoint',
        parameters: [{ name: 'city', in: 'query', required: false, schema: { type: 'string' } }],
        responses: { '200': { description: 'Supplier B listings' } },
      },
    },
    '/admin/suppliers/{supplier}/status': {
      post: {
        summary: 'Chaos & Fault Injection',
        description: 'Inject simulated outages or network latency into Supplier A or B.',
        parameters: [
          {
            name: 'supplier',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: ['supplierA', 'supplierB'] },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  healthy: { type: 'boolean', example: false },
                  latencyMs: { type: 'number', example: 500 },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Updated fault state' } },
      },
    },
    '/admin/suppliers/status': {
      get: {
        summary: 'Get Supplier Fault States',
        responses: { '200': { description: 'Current states of both suppliers' } },
      },
    },
  },
};
