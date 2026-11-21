import { SupplierFaultState } from '../domain/types.js';

class SupplierStateManager {
  private stateA: SupplierFaultState = { healthy: true, latencyMs: 0 };
  private stateB: SupplierFaultState = { healthy: true, latencyMs: 0 };

  public getStatus(supplier: 'supplierA' | 'supplierB'): SupplierFaultState {
    return supplier === 'supplierA' ? { ...this.stateA } : { ...this.stateB };
  }

  public setStatus(supplier: 'supplierA' | 'supplierB', updates: Partial<SupplierFaultState>): SupplierFaultState {
    if (supplier === 'supplierA') {
      this.stateA = { ...this.stateA, ...updates };
      return { ...this.stateA };
    } else {
      this.stateB = { ...this.stateB, ...updates };
      return { ...this.stateB };
    }
  }

  public getAllStatus() {
    return {
      supplierA: { ...this.stateA },
      supplierB: { ...this.stateB },
    };
  }

  public reset() {
    this.stateA = { healthy: true, latencyMs: 0 };
    this.stateB = { healthy: true, latencyMs: 0 };
  }
}

export const supplierState = new SupplierStateManager();
