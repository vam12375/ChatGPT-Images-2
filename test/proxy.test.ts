/**
 * 反向代理基础测试：覆盖 Key 轮转、缓存和内存日志的核心行为。
 */
import assert from "node:assert";
import { test } from "node:test";

import { validateAdminRequest } from "../src/lib/admin-auth.ts";
import { ProxyConfig } from "../src/lib/proxy-config.ts";
import {
  callOpenAIWithRetry,
  shouldRetryOpenAIError
} from "../src/lib/openai-retry.ts";
import {
  ProxyMiddleware,
  readProxyCacheConfig
} from "../src/lib/proxy-middleware.ts";
import { createMemoryRateLimiter, readClientIdentifier } from "../src/lib/rate-limit.ts";

test("ProxyConfig - 密钥轮转", () => {
  const config = new ProxyConfig(["key1", "key2", "key3"]);

  assert.strictEqual(config.apiKeys.length, 3);
  assert.strictEqual(config.getNextApiKey(), "key1");
  assert.strictEqual(config.getNextApiKey(), "key2");
  assert.strictEqual(config.getNextApiKey(), "key3");
  assert.strictEqual(config.getNextApiKey(), "key1");
});

test("ProxyConfig - 单个密钥", () => {
  const config = new ProxyConfig(["single-key"]);

  assert.strictEqual(config.apiKeys.length, 1);
  assert.strictEqual(config.getNextApiKey(), "single-key");
});

test("ProxyMiddleware - 缓存键生成", () => {
  const middleware = new ProxyMiddleware();
  const options = {
    apiMode: "images" as const,
    prompt: "描述",
    size: "1024x1024" as const,
    quality: "medium" as const,
    outputFormat: "png" as const,
    count: 1
  };

  const key1 = middleware.generateCacheKey(options, "dall-e-3");
  const key2 = middleware.generateCacheKey({ ...options }, "dall-e-3");
  const key3 = middleware.generateCacheKey(
    { ...options, apiMode: "responses" as const },
    "gpt-4.1-mini"
  );

  assert.strictEqual(key1, key2, "相同输入应生成相同缓存键");
  assert.notStrictEqual(key1, key3, "不同接口模式应生成不同缓存键");
});

test("ProxyMiddleware - 缓存存取", () => {
  const middleware = new ProxyMiddleware();
  const cacheKey = "test-key";
  const data = { images: ["img1", "img2"] };

  assert.strictEqual(middleware.getFromCache(cacheKey), null);

  middleware.setCache(cacheKey, data);

  const cached = middleware.getFromCache(cacheKey);
  assert.deepStrictEqual(cached, data);
});

test("ProxyMiddleware - 缓存过期", async () => {
  const middleware = new ProxyMiddleware();
  middleware.maxCacheAge = 100;

  const cacheKey = "expire-test";
  const data = { images: ["img1"] };

  middleware.setCache(cacheKey, data);
  assert.deepStrictEqual(middleware.getFromCache(cacheKey), data);

  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.strictEqual(middleware.getFromCache(cacheKey), null);
});

test("ProxyMiddleware - 缓存容量限制", () => {
  const middleware = new ProxyMiddleware({ maxCacheEntries: 2 });

  middleware.setCache("one", { value: 1 });
  middleware.setCache("two", { value: 2 });
  middleware.setCache("three", { value: 3 });

  assert.strictEqual(middleware.getCacheStats().cacheSize, 2);
  assert.strictEqual(middleware.getFromCache("one"), null);
  assert.deepStrictEqual(middleware.getFromCache("two"), { value: 2 });
  assert.deepStrictEqual(middleware.getFromCache("three"), { value: 3 });
});

test("ProxyMiddleware - 从环境变量读取缓存 TTL 和容量", () => {
  const config = readProxyCacheConfig({
    PROXY_CACHE_DURATION: "2",
    PROXY_CACHE_MAX_ENTRIES: "7"
  });

  assert.strictEqual(config.maxCacheAge, 2000);
  assert.strictEqual(config.maxCacheEntries, 7);
});

test("ProxyMiddleware - 请求日志", () => {
  const middleware = new ProxyMiddleware();

  const options = {
    prompt: "长描述文本".repeat(20),
    size: "1024x1024" as const
  };

  const entryId = middleware.logRequest(options);

  const logs = middleware.getRequestLog();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].id, entryId);
  assert.strictEqual(logs[0].prompt, options.prompt.substring(0, 50));
  assert.strictEqual(logs[0].size, "1024x1024");
  assert.strictEqual(logs[0].status, "pending");
});

test("ProxyMiddleware - 请求日志可记录结果状态和耗时", () => {
  const middleware = new ProxyMiddleware();
  const entryId = middleware.logRequest({
    prompt: "描述",
    size: "1024x1024"
  });

  middleware.completeRequest(entryId, "success", { durationMs: 42 });

  const logs = middleware.getRequestLog();
  assert.strictEqual(logs[0].status, "success");
  assert.strictEqual(logs[0].durationMs, 42);
});

test("ProxyMiddleware - 日志数量限制", () => {
  const middleware = new ProxyMiddleware();

  for (let i = 0; i < 101; i += 1) {
    middleware.logRequest({ prompt: `描述${i}`, size: "1024x1024" });
  }

  const logs = middleware.getRequestLog();
  assert.strictEqual(logs.length, 100);
  assert.strictEqual(logs[0].prompt, "描述1");
  assert.strictEqual(logs[99].prompt, "描述100");
});

test("RateLimiter - 超过窗口内请求上限时拒绝访问", () => {
  let now = 1000;
  const limiter = createMemoryRateLimiter({
    maxRequests: 2,
    windowMs: 1000,
    now: () => now
  });

  assert.strictEqual(limiter.check("local").allowed, true);
  assert.strictEqual(limiter.check("local").allowed, true);
  assert.strictEqual(limiter.check("local").allowed, false);

  now = 2100;
  assert.strictEqual(limiter.check("local").allowed, true);
});

test("RateLimiter - 优先读取代理转发的客户端地址", () => {
  const request = new Request("http://localhost/api/images/generate", {
    headers: {
      "x-forwarded-for": "203.0.113.10, 10.0.0.2"
    }
  });

  assert.strictEqual(readClientIdentifier(request), "203.0.113.10");
});

test("AdminAuth - 监控接口必须提供正确 token", () => {
  const unsafe = validateAdminRequest(
    new Request("http://localhost/api/proxy/stats", {
      headers: { authorization: "Bearer change-me" }
    }),
    "change-me"
  );
  const missing = validateAdminRequest(
    new Request("http://localhost/api/proxy/stats"),
    "secret"
  );
  const wrong = validateAdminRequest(
    new Request("http://localhost/api/proxy/stats", {
      headers: { authorization: "Bearer bad" }
    }),
    "secret"
  );
  const ok = validateAdminRequest(
    new Request("http://localhost/api/proxy/stats", {
      headers: { authorization: "Bearer secret" }
    }),
    "secret"
  );

  assert.strictEqual(unsafe?.status, 403);
  assert.strictEqual(missing?.status, 401);
  assert.strictEqual(wrong?.status, 403);
  assert.strictEqual(ok, null);
});

test("OpenAI 重试策略只重试限流和服务端错误", () => {
  assert.strictEqual(shouldRetryOpenAIError({ status: 429 }), true);
  assert.strictEqual(shouldRetryOpenAIError({ status: 500 }), true);
  assert.strictEqual(shouldRetryOpenAIError({ status: 503 }), true);
  assert.strictEqual(shouldRetryOpenAIError({ status: 400 }), false);
  assert.strictEqual(shouldRetryOpenAIError({ status: 401 }), false);
  assert.strictEqual(shouldRetryOpenAIError({ status: 404 }), false);
});

test("OpenAI 调用遇到不可重试错误时不会重复请求", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      callOpenAIWithRetry(
        async () => {
          attempts += 1;
          throw { status: 400, message: "bad request" };
        },
        { onRetry: () => undefined, wait: async () => undefined }
      ),
    (error: unknown) =>
      Boolean(
        error &&
          typeof error === "object" &&
          (error as { status?: number }).status === 400
      )
  );

  assert.strictEqual(attempts, 1);
});

test("OpenAI 调用遇到 5xx 时会按策略重试", async () => {
  let attempts = 0;

  const result = await callOpenAIWithRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw { status: 500, message: "server error" };
      }

      return "ok";
    },
    { onRetry: () => undefined, wait: async () => undefined }
  );

  assert.strictEqual(result, "ok");
  assert.strictEqual(attempts, 3);
});
