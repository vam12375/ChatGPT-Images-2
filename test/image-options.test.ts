import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOpenAIImageRequest,
  parseImageRequest
} from "../src/lib/image-options.ts";

test("保留合法图片生成参数并清理 prompt 空白", () => {
  const result = parseImageRequest({
    prompt: "  一张极简茶饮产品海报  ",
    size: "1024x1024",
    quality: "medium",
    outputFormat: "webp",
    count: 2,
    apiMode: "responses"
  });

  assert.equal(result.prompt, "一张极简茶饮产品海报");
  assert.equal(result.size, "1024x1024");
  assert.equal(result.quality, "medium");
  assert.equal(result.outputFormat, "webp");
  assert.equal(result.count, 2);
  assert.equal(result.apiMode, "responses");
});

test("拒绝空 prompt，避免无意义请求消耗额度", () => {
  assert.throws(() => parseImageRequest({ prompt: "   " }), /请输入图片描述/);
});

test("对未提供的可选项使用安全默认值", () => {
  const result = parseImageRequest({
    prompt: "生成一张适合电商首图的茶叶礼盒照片"
  });

  assert.equal(result.size, "1024x1024");
  assert.equal(result.quality, "high");
  assert.equal(result.outputFormat, "png");
  assert.equal(result.count, 1);
  assert.equal(result.apiMode, "images");
});

test("只接受图片模型稳定支持的标准尺寸", () => {
  const portrait = parseImageRequest({
    prompt: "竖版产品海报",
    size: "1024x1536"
  });
  const landscape = parseImageRequest({
    prompt: "横版产品海报",
    size: "1536x1024"
  });

  assert.equal(portrait.size, "1024x1536");
  assert.equal(landscape.size, "1536x1024");
});

test("拒绝容易被模型端自动归一化的非标准尺寸", () => {
  assert.throws(
    () =>
      parseImageRequest({
        prompt: "16:9 横版海报",
        size: "2048x1152"
      }),
    /当前仅支持/
  );

  assert.throws(
    () =>
      parseImageRequest({
        prompt: "自定义尺寸样例",
        size: "2304x1296"
      }),
    /当前仅支持/
  );
});

test("为图片生成请求保留标准尺寸与输出格式", () => {
  const result = buildOpenAIImageRequest(
    {
      apiMode: "images",
      prompt: "横版品牌 KV",
      size: "1536x1024",
      quality: "high",
      outputFormat: "jpeg",
      count: 1
    },
    "gpt-image-2"
  );

  assert.deepEqual(result, {
    model: "gpt-image-2",
    prompt: "横版品牌 KV",
    n: 1,
    size: "1536x1024",
    quality: "high",
    output_format: "jpeg"
  });
});
