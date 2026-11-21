export interface SupplierHotelOffer {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
}

export interface HotelOffer {
  name: string;
  price: number;
  supplier: string;
  commissionPct: number;
}

export interface CacheMeta {
  cachedAt: number;
  count: number;
  degradedSuppliers: string[];
}

export interface PriceFilterOptions {
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  offset?: number;
}

export interface WorkflowInput {
  city: string;
}

export interface WorkflowResult {
  city: string;
  offers: HotelOffer[];
  degradedSuppliers: string[];
}

export interface SupplierFaultState {
  healthy: boolean;
  latencyMs: number;
}

export interface DependencyHealth {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptimeSeconds: number;
  dependencies: {
    redis: DependencyHealth;
    temporal: DependencyHealth;
    supplierA: DependencyHealth;
    supplierB: DependencyHealth;
  };
}
