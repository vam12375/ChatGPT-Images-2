import assert from "node:assert/strict";
import test from "node:test";

import { formatDownloadFilename } from "../src/lib/download-filename.ts";

test("按 ChatGPT Image 中文日期格式生成下载文件名", () => {
  const filename = formatDownloadFilename(
    new Date("2026-04-28T10:55:25"),
    0,
    "png"
  );

  assert.equal(filename, "ChatGPT Image 2026年4月28日 10_55_25.png");
});

test("多图下载时在扩展名前追加序号", () => {
  const filename = formatDownloadFilename(
    new Date("2026-04-28T10:55:25"),
    1,
    "webp"
  );

  assert.equal(filename, "ChatGPT Image 2026年4月28日 10_55_25_2.webp");
});
