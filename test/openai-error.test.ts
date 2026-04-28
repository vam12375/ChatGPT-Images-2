import assert from "node:assert/strict";
import test from "node:test";

import { formatOpenAIError } from "../src/lib/openai-error.ts";

test("将 OpenAI 账单硬上限错误转换成用户可理解的中文提示", () => {
  const result = formatOpenAIError({
    status: 400,
    message: "400 Billing hard limit has been reached."
  });

  assert.equal(result.status, 402);
  assert.match(result.message, /账单硬上限/);
  assert.match(result.message, /OpenAI 控制台/);
});

test("保留未知错误信息，避免吞掉真实服务端原因", () => {
  const result = formatOpenAIError(new Error("model is not available"));

  assert.equal(result.status, 502);
  assert.equal(result.message, "model is not available");
});
