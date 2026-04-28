/**
 * 反向代理配置
 * 支持多个OpenAI API密钥轮转，提高稳定性
 */

export class ProxyConfig {
  constructor() {
    // 从环境变量读取多个密钥，用逗号分隔
    this.apiKeys = this.parseApiKeys();
    this.currentKeyIndex = 0;
    this.requestCount = new Map(); // 跟踪每个密钥的请求数
  }

  parseApiKeys() {
    const keyString = process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY;
    if (!keyString) {
      throw new Error("缺少 OPENAI_API_KEY 或 OPENAI_API_KEYS 配置");
    }
    
    return keyString.split(",").map(k => k.trim()).filter(Boolean);
  }

  /**
   * 获取下一个可用的API密钥（负载均衡）
   */
  getNextApiKey() {
    if (this.apiKeys.length === 0) {
      throw new Error("没有可用的API密钥");
    }

    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  /**
   * 获取当前密钥的请求计数
   */
  getRequestStats(keyIndex) {
    return this.requestCount.get(keyIndex) || 0;
  }

  /**
   * 记录请求
   */
  recordRequest(keyIndex) {
    const current = this.requestCount.get(keyIndex) || 0;
    this.requestCount.set(keyIndex, current + 1);
  }

  /**
   * 获取代理统计信息
   */
  getStats() {
    return {
      totalKeys: this.apiKeys.length,
      requests: Object.fromEntries(this.requestCount),
      currentKeyIndex: this.currentKeyIndex
    };
  }
}

export const proxyConfig = new ProxyConfig();
