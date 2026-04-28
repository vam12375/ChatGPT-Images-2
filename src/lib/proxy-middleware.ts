/**
 * 反向代理中间件：负责缓存、轻量日志和统计，保持 API 路由本身足够薄。
 */
import crypto from "node:crypto";

import type { ImageRequestOptions } from "@/lib/image-options";

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

export type RequestLogEntry = {
  timestamp: string;
  prompt: string;
  size: string;
  status: "pending";
};

export class ProxyMiddleware {
  private readonly cache: Map<string, CacheEntry<unknown>>;
  private readonly requestLog: RequestLogEntry[];
  maxCacheAge: number;

  constructor() {
    this.cache = new Map<string, CacheEntry<unknown>>();
    this.requestLog = [];
    this.maxCacheAge = 1000 * 60 * 60;
  }

  generateCacheKey(prompt: string, size: string, model: string): string {
    const data = `${prompt}-${size}-${model}`;
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
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
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

  getCacheStats(): { cacheSize: number; requestLogSize: number } {
    return {
      cacheSize: this.cache.size,
      requestLogSize: this.requestLog.length
    };
  }
}

export const proxyMiddleware = new ProxyMiddleware();
