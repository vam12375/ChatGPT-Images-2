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
    operation: "generate",
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

test("读取旧历史时为普通生图补齐默认操作类型", async () => {
  const rootDir = await createTempHistoryDir();
  const store = createGenerationHistoryStore(rootDir);
  const legacySession = createSession("/api/generation-history/image?sessionId=1&imageId=1");

  await fs.mkdir(rootDir, { recursive: true });
  await fs.writeFile(
    store.historyFile,
    `${JSON.stringify([legacySession], null, 2)}\n`,
    "utf8"
  );

  const sessions = await store.readGenerationHistory();

  assert.equal(sessions[0].operation, "generate");
});

test("白名单远程图片 URL 会安全拉取并落到本地文件", async () => {
  const rootDir = await createTempHistoryDir();
  let fetchedUrl = "";
  let fetchedRedirect: RequestRedirect | undefined;
  const store = createGenerationHistoryStore(rootDir, {
    allowedRemoteImageHosts: ["images.example.com"],
    fetchRemoteImage: (async (input, init) => {
      fetchedUrl = String(input);
      fetchedRedirect = init?.redirect;

      return new Response(new Uint8Array([1, 2, 3]), {
        headers: {
          "content-length": "3",
          "content-type": "image/webp"
        }
      });
    }) as typeof fetch,
    lookupRemoteImageHost: async () => ["203.0.113.10"]
  });

  const sessions = await store.writeGenerationHistory([
    createSession("https://images.example.com/result.webp")
  ]);
  const imageFile = await store.readStoredImageFile("session-1", "image-1");

  assert.equal(fetchedUrl, "https://images.example.com/result.webp");
  assert.equal(fetchedRedirect, "error");
  assert.match(sessions[0].images[0].dataUrl, /^\/api\/generation-history\/image\?/);
  assert.equal(imageFile.mimeType, "image/webp");
  assert.deepEqual([...imageFile.bytes], [1, 2, 3]);
});

test("未配置远程图片白名单时保留原 URL 且不发起拉取", async () => {
  const rootDir = await createTempHistoryDir();
  let wasFetched = false;
  const store = createGenerationHistoryStore(rootDir, {
    fetchRemoteImage: (async () => {
      wasFetched = true;
      return new Response(new Uint8Array([1]), {
        headers: { "content-type": "image/png" }
      });
    }) as typeof fetch,
    lookupRemoteImageHost: async () => ["203.0.113.10"]
  });

  const sessions = await store.writeGenerationHistory([
    createSession("https://images.example.com/result.png")
  ]);

  assert.equal(wasFetched, false);
  assert.equal(
    sessions[0].images[0].dataUrl,
    "https://images.example.com/result.png"
  );
});

test("远程图片域名解析到私网地址时保留原 URL", async () => {
  const rootDir = await createTempHistoryDir();
  let wasFetched = false;
  const store = createGenerationHistoryStore(rootDir, {
    allowedRemoteImageHosts: ["images.example.com"],
    fetchRemoteImage: (async () => {
      wasFetched = true;
      return new Response(new Uint8Array([1]), {
        headers: { "content-type": "image/png" }
      });
    }) as typeof fetch,
    lookupRemoteImageHost: async () => ["127.0.0.1"]
  });

  const sessions = await store.writeGenerationHistory([
    createSession("https://images.example.com/result.png")
  ]);

  assert.equal(wasFetched, false);
  assert.equal(
    sessions[0].images[0].dataUrl,
    "https://images.example.com/result.png"
  );
});

test("远程图片超过体积限制时保留原 URL", async () => {
  const rootDir = await createTempHistoryDir();
  const store = createGenerationHistoryStore(rootDir, {
    allowedRemoteImageHosts: ["images.example.com"],
    fetchRemoteImage: (async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: {
          "content-length": "3",
          "content-type": "image/png"
        }
      })) as typeof fetch,
    lookupRemoteImageHost: async () => ["203.0.113.10"],
    maxRemoteImageBytes: 2
  });

  const sessions = await store.writeGenerationHistory([
    createSession("https://images.example.com/result.png")
  ]);

  assert.equal(
    sessions[0].images[0].dataUrl,
    "https://images.example.com/result.png"
  );
});
