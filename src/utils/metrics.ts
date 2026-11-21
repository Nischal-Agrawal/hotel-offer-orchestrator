import client from 'prom-client';

// Collect default Node.js and runtime metrics
client.collectDefaultMetrics({ prefix: 'hotel_' });

export const httpRequestsTotal = new client.Counter({
  name: 'hotel_http_requests_total',
  help: 'Total HTTP requests count partitioned by method, route, and status code',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDuration = new client.Histogram({
  name: 'hotel_http_request_duration_seconds',
  help: 'Histogram of HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const cacheHitsTotal = new client.Counter({
  name: 'hotel_cache_hits_total',
  help: 'Total Redis cache hits partitioned by city',
  labelNames: ['city'],
});

export const cacheMissesTotal = new client.Counter({
  name: 'hotel_cache_misses_total',
  help: 'Total Redis cache misses partitioned by city',
  labelNames: ['city'],
});

export const supplierFetchDuration = new client.Histogram({
  name: 'hotel_supplier_fetch_duration_seconds',
  help: 'Histogram of upstream supplier response latency in seconds',
  labelNames: ['supplier', 'status'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
});

export const temporalWorkflowDuration = new client.Histogram({
  name: 'hotel_temporal_workflow_duration_seconds',
  help: 'Histogram of Temporal workflow execution duration in seconds',
  labelNames: ['city'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
});

export { client as prometheusRegistry };
