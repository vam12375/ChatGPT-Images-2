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
    count: 2
  });

  assert.equal(result.prompt, "一张极简茶饮产品海报");
  assert.equal(result.size, "1024x1024");
  assert.equal(result.quality, "medium");
  assert.equal(result.outputFormat, "webp");
  assert.equal(result.count, 2);
});

test("拒绝空 prompt，避免无意义请求消耗额度", () => {
  assert.throws(() => parseImageRequest({ prompt: "   " }), /请输入图片描述/);
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

test("支持 GPT-Image-2 文档中的 2K/4K 预设尺寸", () => {
  const horizontal = parseImageRequest({
    prompt: "横版 2K 电商海报",
    size: "2048x1152"
  });
  const vertical = parseImageRequest({
    prompt: "竖版 4K 手机壁纸",
    size: "2160x3840"
  });

  assert.equal(horizontal.size, "2048x1152");
  assert.equal(vertical.size, "2160x3840");
});

test("支持满足约束的自定义尺寸并自动归一化格式", () => {
  const result = parseImageRequest({
    prompt: "自定义尺寸样例",
    size: " 2304 X 1296 "
  });

  assert.equal(result.size, "2304x1296");
});

test("拒绝不满足 GPT-Image-2 尺寸约束的自定义尺寸", () => {
  assert.throws(
    () =>
      parseImageRequest({
        prompt: "非法尺寸样例",
        size: "2050x1152"
      }),
    /尺寸格式无效/
  );

  assert.throws(
    () =>
      parseImageRequest({
        prompt: "非法比例样例",
        size: "3840x1200"
      }),
    /尺寸格式无效/
  );
});

test("为 gpt-image-2 请求保留自定义尺寸与输出格式", () => {
  const result = buildOpenAIImageRequest(
    {
      prompt: "高分辨率品牌 KV",
      size: "2304x1296",
      quality: "high",
      outputFormat: "jpeg",
      count: 1
    },
    "gpt-image-2"
  );

  assert.deepEqual(result, {
    model: "gpt-image-2",
    prompt: "高分辨率品牌 KV",
    n: 1,
    size: "2304x1296",
    quality: "high",
    output_format: "jpeg"
  });
});
