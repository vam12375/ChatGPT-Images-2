/**
 * 反向代理集成测试
 */

import { test } from "node:test";
import assert from "node:assert";
import { ProxyConfig } from "../src/lib/proxy-config.js";
import { ProxyMiddleware } from "../src/lib/proxy-middleware.js";

test("ProxyConfig - 密钥轮转", () => {
  // 模拟环境变量
  process.env.OPENAI_API_KEYS = "key1,key2,key3";

  const config = new ProxyConfig();

  assert.strictEqual(config.apiKeys.length, 3);
  assert.strictEqual(config.getNextApiKey(), "key1");
  assert.strictEqual(config.getNextApiKey(), "key2");
  assert.strictEqual(config.getNextApiKey(), "key3");
  assert.strictEqual(config.getNextApiKey(), "key1"); // 循环回到第一个
});

test("ProxyConfig - 单个密钥", () => {
  process.env.OPENAI_API_KEY = "single-key";
  delete process.env.OPENAI_API_KEYS;

  const config = new ProxyConfig();

  assert.strictEqual(config.apiKeys.length, 1);
  assert.strictEqual(config.getNextApiKey(), "single-key");
});

test("ProxyMiddleware - 缓存键生成", () => {
  const middleware = new ProxyMiddleware();

  const key1 = middleware.generateCacheKey("描述", "1024x1024", "dall-e-3");
  const key2 = middleware.generateCacheKey("描述", "1024x1024", "dall-e-3");
  const key3 = middleware.generateCacheKey("不同描述", "1024x1024", "dall-e-3");

  assert.strictEqual(key1, key2, "相同输入应生成相同缓存键");
  assert.notStrictEqual(key1, key3, "不同输入应生成不同缓存键");
});

test("ProxyMiddleware - 缓存存取", () => {
  const middleware = new ProxyMiddleware();
  const cacheKey = "test-key";
  const data = { images: ["img1", "img2"] };

  // 验证缓存为空
  assert.strictEqual(middleware.getFromCache(cacheKey), null);

  // 存入缓存
  middleware.setCache(cacheKey, data);

  // 验证缓存已存储
  const cached = middleware.getFromCache(cacheKey);
  assert.deepStrictEqual(cached, data);
});

test("ProxyMiddleware - 缓存过期", async () => {
  const middleware = new ProxyMiddleware();
  middleware.maxCacheAge = 100; // 100ms 过期

  const cacheKey = "expire-test";
  const data = { images: ["img1"] };

  middleware.setCache(cacheKey, data);
  assert.deepStrictEqual(middleware.getFromCache(cacheKey), data);

  // 等待缓存过期
  await new Promise(resolve => setTimeout(resolve, 150));

  // 验证缓存已过期
  assert.strictEqual(middleware.getFromCache(cacheKey), null);
});

test("ProxyMiddleware - 请求日志", () => {
  const middleware = new ProxyMiddleware();

  const options = {
    prompt: "长描述文本".repeat(20),
    size: "1024x1024"
  };

  middleware.logRequest(options);

  const logs = middleware.getRequestLog();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].prompt, options.prompt.substring(0, 50));
  assert.strictEqual(logs[0].size, "1024x1024");
});

test("ProxyMiddleware - 日志数量限制", () => {
  const middleware = new ProxyMiddleware();

  // 添加101条日志
  for (let i = 0; i < 101; i++) {
    middleware.logRequest({ prompt: `描述${i}`, size: "1024x1024" });
  }

  // 验证只保留最近100条
  const logs = middleware.getRequestLog();
  assert.strictEqual(logs.length, 100);
  assert.strictEqual(logs[0].prompt, "描述1"); // 第一条应该被删除
  assert.strictEqual(logs[99].prompt, "描述100"); // 最后一条
});

console.log("✅ 所有反向代理测试通过！");
