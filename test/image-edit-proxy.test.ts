import assert from "node:assert/strict";
import test from "node:test";

import {
  createImageEditProxyRequest,
  createResponsesImageEditProxyRequest,
  normalizeResponsesImageEditResponse,
  normalizeImageEditResponse,
  sendImageEditRequest
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
      background: "auto",
      apiMode: "images"
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

test("图片编辑上游连接失败时返回包含目标地址的错误", async () => {
  const originalFetch = globalThis.fetch;
  const source = new File(["image"], "source.png", { type: "image/png" });

  globalThis.fetch = (() => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        sendImageEditRequest({
          apiKey: "sk-test",
          baseUrl: "https://edit-relay.example.com/v1",
          fields: {
            prompt: "整体编辑",
            size: "1024x1024",
            quality: "high",
            outputFormat: "png",
            background: "auto",
            apiMode: "images"
          },
          images: [source],
          mask: null
        }),
      /连接上游图片编辑接口失败.*https:\/\/edit-relay\.example\.com\/v1\/images\/edits.*fetch failed/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("Responses API 图片编辑请求使用 input_image 和 image_generation 工具", async () => {
  const source = new File(["image"], "source.png", { type: "image/png" });
  const mask = new File(["mask"], "mask.png", { type: "image/png" });
  const request = await createResponsesImageEditProxyRequest({
    apiKey: "sk-test",
    baseUrl: "https://api.openai.com/v1",
    imageModel: "gpt-image-2",
    responsesModel: "gpt-5.5",
    fields: {
      prompt: "替换天空",
      size: "1024x1024",
      quality: "high",
      outputFormat: "png",
      background: "auto",
      apiMode: "responses"
    },
    images: [source],
    mask
  });

  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.init.method, "POST");
  assert.equal(
    (request.init.headers as Record<string, string>).Authorization,
    "Bearer sk-test"
  );
  assert.equal(
    (request.init.headers as Record<string, string>)["Content-Type"],
    "application/json"
  );

  const body = JSON.parse(request.init.body as string);
  assert.equal(body.model, "gpt-5.5");
  assert.equal(body.input[0].content[0].text, "替换天空");
  assert.match(body.input[0].content[1].image_url, /^data:image\/png;base64,/);
  assert.equal(body.tools[0].type, "image_generation");
  assert.equal(body.tools[0].model, "gpt-image-2");
  assert.equal(body.tools[0].action, "edit");
  assert.equal(body.tools[0].size, "1024x1024");
  assert.equal(body.tools[0].quality, "high");
  assert.equal(body.tools[0].output_format, "png");
  assert.match(body.tools[0].input_image_mask.image_url, /^data:image\/png;base64,/);
  assert.equal(body.tool_choice, "required");
});

test("Responses API 图片编辑响应归一化为 data URL", () => {
  const result = normalizeResponsesImageEditResponse(
    {
      created_at: 2,
      model: "gpt-5.5",
      output: [{ id: "ig_1", type: "image_generation_call", result: "YWJj" }],
      usage: { total_tokens: 4, input_tokens: 2, output_tokens: 2 }
    },
    "webp"
  );

  assert.equal(result.images[0].id, "ig_1-0");
  assert.equal(result.images[0].dataUrl, "data:image/webp;base64,YWJj");
  assert.equal(result.model, "gpt-5.5");
  assert.equal(result.usage?.total_tokens, 4);
});

