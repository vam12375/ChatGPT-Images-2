import assert from "node:assert/strict";
import test from "node:test";

import {
  parseImageEditFields,
  validateImageEditFiles
} from "../src/lib/image-edit-options.ts";

test("解析图片编辑字段并使用安全默认值", () => {
  const fields = parseImageEditFields({
    prompt: "  把天空改成粉色晚霞  ",
    size: "1536x1024",
    quality: "high",
    output_format: "webp",
    background: "opaque"
  });

  assert.equal(fields.prompt, "把天空改成粉色晚霞");
  assert.equal(fields.size, "1536x1024");
  assert.equal(fields.quality, "high");
  assert.equal(fields.outputFormat, "webp");
  assert.equal(fields.background, "opaque");
});

test("拒绝空编辑提示词", () => {
  assert.throws(
    () => parseImageEditFields({ prompt: "   " }),
    /请输入图片编辑指令/
  );
});

test("校验参考图数量和格式", () => {
  const image = new File(["x"], "photo.png", { type: "image/png" });

  assert.doesNotThrow(() => validateImageEditFiles([image], null));
  assert.throws(
    () => validateImageEditFiles([], null),
    /请先选择要编辑的图片/
  );
  assert.throws(
    () =>
      validateImageEditFiles(
        [new File(["x"], "bad.gif", { type: "image/gif" })],
        null
      ),
    /仅支持 PNG、JPEG、WebP/
  );
});

test("拒绝不受编辑接口支持的透明背景", () => {
  assert.throws(
    () =>
      parseImageEditFields({
        prompt: "替换背景",
        background: "transparent"
      }),
    /图片编辑暂不支持透明背景/
  );
});

