export class RateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60_000;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    this.maybeCleanup(now);

    const timestamps = this.buckets.get(key) ?? [];
    const valid = timestamps.filter((ts) => now - ts < this.windowMs);

    if (valid.length >= this.maxRequests) {
      this.buckets.set(key, valid);
      return false;
    }

    valid.push(now);
    this.buckets.set(key, valid);
    return true;
  }

  private maybeCleanup(now: number): void {
    if (now - this.lastCleanup < this.cleanupIntervalMs) return;
    this.lastCleanup = now;

    for (const [key, timestamps] of this.buckets) {
      const valid = timestamps.filter((ts) => now - ts < this.windowMs);
      if (valid.length === 0) {
        this.buckets.delete(key);
      } else {
        this.buckets.set(key, valid);
      }
    }
  }
}
