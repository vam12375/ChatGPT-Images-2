import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createGenerationHistoryStore } from "../src/lib/generation-history-store.ts";
import type { StoredGenerationSession } from "../src/lib/generation-history-types.ts";

async function createTempHistoryDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "chatgpt-images-history-"));
}

function createSession(dataUrl: string): StoredGenerationSession {
  return {
    id: "session-1",
    title: "茶饮海报",
    prompt: "生成一张茶饮海报",
    size: "1024x1024",
    sizeLabel: "Square 1:1",
    sizeValue: "1024 x 1024",
    qualityLabel: "平衡",
    apiMode: "images",
    outputFormat: "png",
    count: 1,
    images: [{ id: "image-1", dataUrl }],
    model: "gpt-image-2",
    usage: null,
    createdAt: "09:30"
  };
}

test("写入历史时把 base64 图片落到本地文件，避免历史 JSON 膨胀", async () => {
  const rootDir = await createTempHistoryDir();
  const store = createGenerationHistoryStore(rootDir);
  const pngDataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

  const sessions = await store.writeGenerationHistory([createSession(pngDataUrl)]);
  const storedContent = await fs.readFile(store.historyFile, "utf8");
  const imageFile = await store.readStoredImageFile("session-1", "image-1");

  assert.equal(storedContent.includes("iVBORw0KGgo"), false);
  assert.match(sessions[0].images[0].dataUrl, /^\/api\/generation-history\/image\?/);
  assert.equal(imageFile.mimeType, "image/png");
  assert.equal(imageFile.bytes.length > 0, true);
});

test("读取旧历史时会顺手瘦身，兼容已存在的 base64 记录", async () => {
  const rootDir = await createTempHistoryDir();
  const store = createGenerationHistoryStore(rootDir);
  const legacySession = createSession(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
  );

  await fs.mkdir(rootDir, { recursive: true });
  await fs.writeFile(
    store.historyFile,
    `${JSON.stringify([legacySession], null, 2)}\n`,
    "utf8"
  );

  const sessions = await store.readGenerationHistory();
  const compactedContent = await fs.readFile(store.historyFile, "utf8");

  assert.match(sessions[0].images[0].dataUrl, /^\/api\/generation-history\/image\?/);
  assert.equal(compactedContent.includes("iVBORw0KGgo"), false);
});
