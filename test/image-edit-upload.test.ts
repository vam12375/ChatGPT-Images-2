import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveCompactEditImageSize,
  shouldCompactEditImage
} from "../src/lib/image-edit-upload.ts";

test("编辑上传图片超过体积阈值时需要压缩", () => {
  assert.equal(shouldCompactEditImage(700 * 1024), true);
  assert.equal(shouldCompactEditImage(480 * 1024), false);
});

test("编辑上传图片会等比限制最长边且不会放大小图", () => {
  assert.deepEqual(resolveCompactEditImageSize(1536, 1024), {
    width: 1024,
    height: 683
  });
  assert.deepEqual(resolveCompactEditImageSize(768, 512), {
    width: 768,
    height: 512
  });
});
