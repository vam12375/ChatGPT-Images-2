/**
 * 反向代理配置：集中管理多 API Key 轮转，避免调用处重复处理环境变量。
 */
export class ProxyConfig {
  apiKeys: string[];
  currentKeyIndex: number;
  private readonly requestCount: Map<number, number>;

  constructor(apiKeys?: string[]) {
    this.apiKeys = apiKeys ?? this.parseApiKeys();
    this.currentKeyIndex = 0;
    this.requestCount = new Map<number, number>();
  }

  private parseApiKeys(): string[] {
    const keyString = process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY;
    if (!keyString) {
      return [];
    }

    return keyString
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
  }

  /**
   * 获取下一个可用 API Key，保持简单轮询以满足当前负载均衡需求。
   */
  getNextApiKey(): string {
    if (this.apiKeys.length === 0) {
      throw new Error("缺少 OPENAI_API_KEY 或 OPENAI_API_KEYS 配置");
    }

    const key = this.apiKeys[this.currentKeyIndex];
    this.recordRequest(this.currentKeyIndex);
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  getRequestStats(keyIndex: number): number {
    return this.requestCount.get(keyIndex) || 0;
  }

  recordRequest(keyIndex: number): void {
    const current = this.requestCount.get(keyIndex) || 0;
    this.requestCount.set(keyIndex, current + 1);
  }

  getStats(): {
    totalKeys: number;
    requests: Record<string, number>;
    currentKeyIndex: number;
  } {
    return {
      totalKeys: this.apiKeys.length,
      requests: Object.fromEntries(this.requestCount),
      currentKeyIndex: this.currentKeyIndex
    };
  }
}

export const proxyConfig = new ProxyConfig();
