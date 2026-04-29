/**
 * 反向代理中间件：负责缓存、轻量日志和统计，保持 API 路由本身足够薄。
 */
import crypto from "node:crypto";

import type { ImageRequestOptions } from "@/lib/image-options";

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

export type ProxyCacheConfig = {
  maxCacheAge: number;
  maxCacheEntries: number;
};

export type RequestLogEntry = {
  timestamp: string;
  prompt: string;
  size: string;
  status: "pending";
};

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : fallback;
}

export function readProxyCacheConfig(
  env: Record<string, string | undefined> = process.env
): ProxyCacheConfig {
  return {
    maxCacheAge: readPositiveInteger(env.PROXY_CACHE_DURATION, 3600) * 1000,
    maxCacheEntries: readPositiveInteger(env.PROXY_CACHE_MAX_ENTRIES, 50)
  };
}

export class ProxyMiddleware {
  private readonly cache: Map<string, CacheEntry<unknown>>;
  private readonly requestLog: RequestLogEntry[];
  maxCacheAge: number;
  maxCacheEntries: number;

  constructor(config: Partial<ProxyCacheConfig> = {}) {
    const defaultConfig = readProxyCacheConfig();

    this.cache = new Map<string, CacheEntry<unknown>>();
    this.requestLog = [];
    this.maxCacheAge = config.maxCacheAge ?? defaultConfig.maxCacheAge;
    this.maxCacheEntries =
      config.maxCacheEntries ?? defaultConfig.maxCacheEntries;
  }

  generateCacheKey(
    options: Pick<
      ImageRequestOptions,
      "apiMode" | "prompt" | "size" | "quality" | "outputFormat" | "count"
    >,
    model: string
  ): string {
    const data = JSON.stringify({
      apiMode: options.apiMode,
      prompt: options.prompt,
      size: options.size,
      quality: options.quality,
      outputFormat: options.outputFormat,
      count: options.count,
      model
    });

    return crypto.createHash("md5").update(data).digest("hex");
  }

  getFromCache<T>(cacheKey: string): T | null {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.maxCacheAge) {
      return cached.data as T;
    }

    // 读取时顺手清理过期缓存，避免长期运行时缓存无限增长。
    if (cached) {
      this.cache.delete(cacheKey);
    }

    return null;
  }

  setCache<T>(cacheKey: string, data: T): void {
    this.deleteExpiredCache();

    if (this.cache.has(cacheKey)) {
      this.cache.delete(cacheKey);
    }

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    this.trimCache();
  }

  logRequest(options: Pick<ImageRequestOptions, "prompt" | "size">): void {
    this.requestLog.push({
      timestamp: new Date().toISOString(),
      prompt: options.prompt.substring(0, 50),
      size: options.size,
      status: "pending"
    });

    // 仅保留最近 100 条日志，足够诊断且不引入持久化复杂度。
    if (this.requestLog.length > 100) {
      this.requestLog.shift();
    }
  }

  getRequestLog(): RequestLogEntry[] {
    return this.requestLog;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): {
    cacheSize: number;
    maxCacheEntries: number;
    maxCacheAge: number;
    requestLogSize: number;
  } {
    this.deleteExpiredCache();

    return {
      cacheSize: this.cache.size,
      maxCacheEntries: this.maxCacheEntries,
      maxCacheAge: this.maxCacheAge,
      requestLogSize: this.requestLog.length
    };
  }

  private deleteExpiredCache(): void {
    const currentTime = Date.now();

    for (const [cacheKey, cached] of this.cache) {
      if (currentTime - cached.timestamp >= this.maxCacheAge) {
        this.cache.delete(cacheKey);
      }
    }
  }

  private trimCache(): void {
    while (this.cache.size > this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) {
        return;
      }

      this.cache.delete(oldestKey);
    }
  }
}

export const proxyMiddleware = new ProxyMiddleware();
