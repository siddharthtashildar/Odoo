import { redis } from "../lib/redis";

export interface CacheResult<T> {
  data: T;
  source: "redis" | "database";
  cached: boolean;
}

export const CacheService = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get<T>(key);
      if (!data) return null;
      return data;
    } catch (err) {
      console.warn(`[Redis Cache] GET error for key ${key}:`, err);
      return null;
    }
  },

  async set<T>(key: string, data: T, ttlSeconds = 300): Promise<void> {
    try {
      await redis.set(key, data, { ex: ttlSeconds });
    } catch (err) {
      console.warn(`[Redis Cache] SET error for key ${key}:`, err);
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (err) {
      console.warn(`[Redis Cache] DEL error for key ${key}:`, err);
    }
  },

  async clearAll(): Promise<void> {
    try {
      await redis.del("payroll:dashboard:analytics");
    } catch (err) {
      console.warn("[Redis Cache] ClearAll error:", err);
    }
  },

  async getOrSet<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<CacheResult<T>> {
    const cachedData = await this.get<T>(key);
    if (cachedData !== null) {
      return {
        data: cachedData,
        source: "redis",
        cached: true,
      };
    }

    const freshData = await fn();
    await this.set(key, freshData, ttlSeconds);
    return {
      data: freshData,
      source: "database",
      cached: false,
    };
  },
};

export const cacheService = CacheService;
