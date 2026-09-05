/**
 * High-performance Cache Service for Payroll Dashboard, Department Analytics, and KPIs
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

export const CacheService = {
  get<T>(key: string): T | null {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    return entry.data as T;
  },

  set<T>(key: string, data: T, ttlSeconds = 120): void {
    memoryCache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  del(key: string): void {
    memoryCache.delete(key);
  },

  clear(): void {
    memoryCache.clear();
  },

  clearAll(): void {
    memoryCache.clear();
  },

  async getOrSet<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached) return cached;
    const fresh = await fn();
    this.set(key, fresh, ttlSeconds);
    return fresh;
  },
};

export const cacheService = CacheService;
