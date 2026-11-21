/**
 * Singleflight coalesces duplicate concurrent calls into a single in-flight promise.
 * Prevents Cache Stampede / Thundering Herd when cache expires.
 */
export class SingleflightGroup<T> {
  private inFlight = new Map<string, Promise<T>>();

  public async do(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  public getInFlightCount(): number {
    return this.inFlight.size;
  }
}

export const singleflight = new SingleflightGroup<unknown>();
