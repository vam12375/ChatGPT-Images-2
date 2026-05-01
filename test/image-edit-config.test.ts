import assert from "node:assert/strict";
import test from "node:test";

import { readImageEditBaseUrl } from "../src/lib/image-edit-config.ts";

test("Images API 编辑默认使用专用图片编辑上游", () => {
  const baseUrl = readImageEditBaseUrl("images", {
    OPENAI_BASE_URL: "https://broken-relay.example.com/v1"
  });

  assert.equal(baseUrl, "https://api.apiyi.com/v1");
});

test("Images API 编辑允许使用专用环境变量覆盖", () => {
  const baseUrl = readImageEditBaseUrl("images", {
    OPENAI_BASE_URL: "https://broken-relay.example.com/v1",
    OPENAI_IMAGE_EDIT_BASE_URL: "https://edit-relay.example.com/v1/"
  });

  assert.equal(baseUrl, "https://edit-relay.example.com/v1");
});

test("Responses API 编辑默认沿用通用上游并支持专用覆盖", () => {
  assert.equal(
    readImageEditBaseUrl("responses", {
      OPENAI_BASE_URL: "https://relay.example.com/v1/"
    }),
    "https://relay.example.com/v1"
  );
  assert.equal(
    readImageEditBaseUrl("responses", {
      OPENAI_BASE_URL: "https://relay.example.com/v1",
      OPENAI_RESPONSES_EDIT_BASE_URL: "https://responses-edit.example.com/v1"
    }),
    "https://responses-edit.example.com/v1"
  );
});

test("图片编辑上游写成相对路径时回退到默认地址", () => {
  assert.equal(
    readImageEditBaseUrl("images", {
      OPENAI_IMAGE_EDIT_BASE_URL: "/v1"
    }),
    "https://api.apiyi.com/v1"
  );
});
