import assert from "node:assert/strict";
import test from "node:test";

import { appendAspectRatioInstruction } from "../src/lib/aspect-ratio-prompt.ts";

test("选择比例时把官网同款比例指令追加到提示词末尾", () => {
  const result = appendAspectRatioInstruction("一张茶饮海报", "3:4");

  assert.equal(result, "一张茶饮海报\n\nMake the aspect ratio 3:4");
});

test("再次选择比例时替换旧比例指令，避免提示词重复堆叠", () => {
  const result = appendAspectRatioInstruction(
    "一张茶饮海报\n\nMake the aspect ratio 3:4",
    "16:9"
  );

  assert.equal(result, "一张茶饮海报\n\nMake the aspect ratio 16:9");
});

test("空提示词选择比例时只保留比例指令", () => {
  const result = appendAspectRatioInstruction("   ", "9:16");

  assert.equal(result, "Make the aspect ratio 9:16");
});
