import assert from "node:assert/strict";
import test from "node:test";

import {
  createImageEditProxyRequest,
  normalizeImageEditResponse
} from "../src/lib/image-edit-proxy.ts";

test("图片编辑代理请求使用 image[] 和可选 mask 字段", async () => {
  const source = new File(["image"], "source.png", { type: "image/png" });
  const mask = new File(["mask"], "mask.png", { type: "image/png" });
  const request = createImageEditProxyRequest({
    apiKey: "sk-test",
    baseUrl: "https://api.apiyi.com/v1",
    fields: {
      prompt: "替换天空",
      size: "1024x1024",
      quality: "high",
      outputFormat: "png",
      background: "auto"
    },
    images: [source],
    mask
  });

  assert.equal(request.url, "https://api.apiyi.com/v1/images/edits");
  assert.equal(request.init.method, "POST");
  assert.equal(
    (request.init.headers as Record<string, string>).Authorization,
    "Bearer sk-test"
  );

  const formData = request.init.body as FormData;
  assert.equal(formData.get("model"), "gpt-image-2");
  assert.equal(formData.get("prompt"), "替换天空");
  assert.equal(formData.getAll("image[]").length, 1);
  assert.equal(formData.get("mask"), mask);
});

test("图片编辑响应归一化为 data URL", () => {
  const result = normalizeImageEditResponse(
    {
      created: 1,
      data: [{ b64_json: "YWJj" }],
      usage: { total_tokens: 3, input_tokens: 1, output_tokens: 2 }
    },
    "png"
  );

  assert.equal(result.images[0].dataUrl, "data:image/png;base64,YWJj");
  assert.equal(result.usage?.total_tokens, 3);
});

