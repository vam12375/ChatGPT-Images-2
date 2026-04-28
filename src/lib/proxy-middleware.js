/**
 * 反向代理中间件
 * 处理请求转发、错误重试、缓存等
 */

import crypto from "crypto";

export class ProxyMiddleware {
  constructor() {
    this.cache = new Map(); // 简单的内存缓存
    this.requestLog = []; // 请求日志
    this.maxCacheAge = 1000 * 60 * 60; // 1小时缓存
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(prompt, size, model) {
    const data = `${prompt}-${size}-${model}`;
    return crypto.createHash("md5").update(data).digest("hex");
  }

  /**
   * 从缓存获取
   */
  getFromCache(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.maxCacheAge) {
      return cached.data;
    }
    
    // 清理过期缓存
    if (cached) {
      this.cache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * 存入缓存
   */
  setCache(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 记录请求
   */
  logRequest(options) {
    this.requestLog.push({
      timestamp: new Date().toISOString(),
      prompt: options.prompt.substring(0, 50),
      size: options.size,
      status: "pending"
    });

    // 只保留最近100条日志
    if (this.requestLog.length > 100) {
      this.requestLog.shift();
    }
  }

  /**
   * 获取请求日志
   */
  getRequestLog() {
    return this.requestLog;
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      requestLogSize: this.requestLog.length
    };
  }
}

export const proxyMiddleware = new ProxyMiddleware();
