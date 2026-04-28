import assert from "node:assert/strict";
import test from "node:test";

import {
  clampImageViewerZoom,
  createGenerationTitle
} from "../src/lib/generation-history.ts";

test("从提示词生成最近记录标题并清理多余空白", () => {
  assert.equal(createGenerationTitle("  高级茶饮   品牌海报  "), "高级茶饮 品牌海报");
});

test("提示词过长时生成短标题，避免最近记录挤压布局", () => {
  assert.equal(
    createGenerationTitle("生成一张高端商业摄影风格茶饮海报", 10),
    "生成一张高端商业摄影..."
  );
});

test("图片查看器缩放限制在可用范围内", () => {
  assert.equal(clampImageViewerZoom(0.1), 0.5);
  assert.equal(clampImageViewerZoom(1.5), 1.5);
  assert.equal(clampImageViewerZoom(4), 2.5);
  assert.equal(clampImageViewerZoom(Number.NaN), 1);
});
