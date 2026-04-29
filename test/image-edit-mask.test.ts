import assert from "node:assert/strict";
import test from "node:test";

import { readMaskAlpha } from "../src/lib/image-edit-mask.ts";

test("涂抹区域导出为透明像素，未涂抹区域导出为不透明像素", () => {
  assert.equal(readMaskAlpha(255), 0);
  assert.equal(readMaskAlpha(1), 0);
  assert.equal(readMaskAlpha(0), 255);
});

