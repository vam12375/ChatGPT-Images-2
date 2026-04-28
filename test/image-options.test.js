import test from "node:test";
import assert from "node:assert/strict";

import { parseImageRequest } from "../src/lib/image-options.js";

test("保留合法图片生成参数并清理 prompt 空白", () => {
  const result = parseImageRequest({
    prompt: "  一张极简茶饮产品海报  ",
    size: "1024x1024",
    quality: "medium",
    outputFormat: "webp",
    count: 2
  });

  assert.equal(result.prompt, "一张极简茶饮产品海报");
  assert.equal(result.size, "1024x1024");
  assert.equal(result.quality, "medium");
  assert.equal(result.outputFormat, "webp");
  assert.equal(result.count, 2);
});

test("拒绝空 prompt，避免无意义请求消耗额度", () => {
  assert.throws(
    () => parseImageRequest({ prompt: "   " }),
    /请输入图片描述/
  );
});

test("对未提供的可选项使用安全默认值", () => {
  const result = parseImageRequest({
    prompt: "生成一张适合电商首图的茶叶礼盒照片"
  });

  assert.equal(result.size, "1024x1024");
  assert.equal(result.quality, "medium");
  assert.equal(result.outputFormat, "png");
  assert.equal(result.count, 1);
});
