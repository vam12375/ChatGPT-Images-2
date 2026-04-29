import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  GenerationUsage,
  StoredGeneratedImage,
  StoredGenerationSession
} from "@/lib/generation-history-types";
import type {
  GenerationApiMode,
  ImageOutputFormat,
  ImageSize
} from "@/lib/image-options";

const HISTORY_LIMIT = 12;
const HISTORY_DIR = path.join(process.cwd(), ".local");
const HISTORY_FILE = path.join(HISTORY_DIR, "generation-history.json");
const IMAGE_DIR_NAME = "generated-images";

type ParsedDataUrl = {
  bytes: Buffer;
  extension: string;
  mimeType: string;
};

export type StoredImageFile = {
  bytes: Buffer;
  mimeType: string;
};

export type GenerationHistoryStore = {
  historyFile: string;
  readGenerationHistory(): Promise<StoredGenerationSession[]>;
  writeGenerationHistory(input: unknown): Promise<StoredGenerationSession[]>;
  readStoredImageFile(
    sessionId: string,
    imageId: string
  ): Promise<StoredImageFile>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readApiMode(value: unknown): GenerationApiMode {
  return value === "responses" ? "responses" : "images";
}

function readUsage(value: unknown): GenerationUsage | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    total_tokens:
      typeof value.total_tokens === "number" ? value.total_tokens : undefined,
    input_tokens:
      typeof value.input_tokens === "number" ? value.input_tokens : undefined,
    output_tokens:
      typeof value.output_tokens === "number" ? value.output_tokens : undefined
  };
}

function readImage(value: unknown): StoredGeneratedImage | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const dataUrl = readString(value.dataUrl);

  if (!id || !dataUrl) {
    return null;
  }

  return {
    id,
    dataUrl,
    mimeType: readString(value.mimeType) || undefined
  };
}

function isStoredImage(
  image: StoredGeneratedImage | null
): image is StoredGeneratedImage {
  return image !== null;
}

function readSession(value: unknown): StoredGenerationSession | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const prompt = readString(value.prompt);
  const size = readString(value.size);
  const images = Array.isArray(value.images)
    ? value.images.map(readImage).filter(isStoredImage)
    : [];

  if (!id || !prompt || !size) {
    return null;
  }

  return {
    id,
    title: readString(value.title) || "未命名图片",
    prompt,
    size: size as ImageSize,
    sizeLabel: readString(value.sizeLabel),
    sizeValue: readString(value.sizeValue),
    qualityLabel: readString(value.qualityLabel),
    apiMode: readApiMode(value.apiMode),
    outputFormat: (readString(value.outputFormat) || "png") as ImageOutputFormat,
    count: Math.max(1, readNumber(value.count) || images.length || 1),
    images,
    model: readString(value.model),
    usage: readUsage(value.usage),
    createdAt: readString(value.createdAt)
  };
}

function isStoredSession(
  session: StoredGenerationSession | null
): session is StoredGenerationSession {
  return session !== null;
}

function normalizeHistory(input: unknown): StoredGenerationSession[] {
  const sessions = Array.isArray(input) ? input : [];

  // 本地历史只承担恢复最近记录的职责，过滤坏数据并限制数量即可。
  return sessions
    .map(readSession)
    .filter(isStoredSession)
    .slice(0, HISTORY_LIMIT);
}

function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "image";
}

function parseImageDataUrl(dataUrl: string): ParsedDataUrl | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([\s\S]+)$/i);

  if (!match) {
    return null;
  }

  const mimeExtension = match[1].toLowerCase();
  const extension = mimeExtension === "jpg" ? "jpeg" : mimeExtension;
  const bytes = Buffer.from(match[2].replace(/\s+/g, ""), "base64");

  if (bytes.length === 0) {
    return null;
  }

  return {
    bytes,
    extension,
    mimeType: `image/${extension}`
  };
}

function createImageUrl(sessionId: string, imageId: string): string {
  const query = new URLSearchParams({ sessionId, imageId });
  return `/api/generation-history/image?${query.toString()}`;
}

function createImagePath(
  rootDir: string,
  sessionId: string,
  imageId: string,
  extension: string
): string {
  return path.join(
    rootDir,
    IMAGE_DIR_NAME,
    sanitizePathPart(sessionId),
    `${sanitizePathPart(imageId)}.${extension}`
  );
}

async function persistImageDataUrl(
  rootDir: string,
  sessionId: string,
  image: StoredGeneratedImage
): Promise<StoredGeneratedImage> {
  const parsed = parseImageDataUrl(image.dataUrl);
  if (!parsed) {
    return image;
  }

  const imagePath = createImagePath(
    rootDir,
    sessionId,
    image.id,
    parsed.extension
  );

  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.writeFile(imagePath, parsed.bytes);

  return {
    id: image.id,
    dataUrl: createImageUrl(sessionId, image.id),
    mimeType: parsed.mimeType
  };
}

async function compactSessionImages(
  rootDir: string,
  session: StoredGenerationSession
): Promise<{ changed: boolean; session: StoredGenerationSession }> {
  let changed = false;
  const images: StoredGeneratedImage[] = [];

  for (const image of session.images) {
    const compactedImage = await persistImageDataUrl(rootDir, session.id, image);
    changed ||= compactedImage.dataUrl !== image.dataUrl;
    images.push(compactedImage);
  }

  return {
    changed,
    session: {
      ...session,
      images
    }
  };
}

async function compactSessions(
  rootDir: string,
  sessions: StoredGenerationSession[]
): Promise<{ changed: boolean; sessions: StoredGenerationSession[] }> {
  let changed = false;
  const compactedSessions: StoredGenerationSession[] = [];

  for (const session of sessions) {
    const compacted = await compactSessionImages(rootDir, session);
    changed ||= compacted.changed;
    compactedSessions.push(compacted.session);
  }

  return {
    changed,
    sessions: compactedSessions
  };
}

async function writeHistoryFile(
  historyFile: string,
  sessions: StoredGenerationSession[]
): Promise<void> {
  const tempFile = `${historyFile}.tmp`;

  await fs.mkdir(path.dirname(historyFile), { recursive: true });
  await fs.writeFile(tempFile, `${JSON.stringify(sessions, null, 2)}\n`, "utf8");
  await fs.rename(tempFile, historyFile);
}

function readStoredImageMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".jpeg" || extension === ".jpg") {
    return "image/jpeg";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  return "image/png";
}

async function findStoredImagePath(
  rootDir: string,
  sessionId: string,
  imageId: string
): Promise<string> {
  const safeSessionId = sanitizePathPart(sessionId);
  const safeImageId = sanitizePathPart(imageId);
  const imageDir = path.join(rootDir, IMAGE_DIR_NAME, safeSessionId);
  const extensions = ["png", "jpeg", "jpg", "webp"];

  for (const extension of extensions) {
    const imagePath = path.join(imageDir, `${safeImageId}.${extension}`);

    try {
      await fs.access(imagePath);
      return imagePath;
    } catch {
      // 找不到当前扩展名时继续尝试其它图片格式。
    }
  }

  throw new Error("图片文件不存在");
}

export function createGenerationHistoryStore(
  rootDir = HISTORY_DIR
): GenerationHistoryStore {
  const historyFile = path.join(rootDir, "generation-history.json");

  return {
    historyFile,

    async readGenerationHistory(): Promise<StoredGenerationSession[]> {
      try {
        const content = await fs.readFile(historyFile, "utf8");
        const sessions = normalizeHistory(JSON.parse(content));
        const compacted = await compactSessions(rootDir, sessions);

        if (compacted.changed) {
          await writeHistoryFile(historyFile, compacted.sessions);
        }

        return compacted.sessions;
      } catch (error) {
        if (isRecord(error) && error.code === "ENOENT") {
          return [];
        }

        throw error;
      }
    },

    async writeGenerationHistory(
      input: unknown
    ): Promise<StoredGenerationSession[]> {
      const sessions = normalizeHistory(input);
      const compacted = await compactSessions(rootDir, sessions);

      await writeHistoryFile(historyFile, compacted.sessions);

      return compacted.sessions;
    },

    async readStoredImageFile(
      sessionId: string,
      imageId: string
    ): Promise<StoredImageFile> {
      const imagePath = await findStoredImagePath(rootDir, sessionId, imageId);

      return {
        bytes: await fs.readFile(imagePath),
        mimeType: readStoredImageMimeType(imagePath)
      };
    }
  };
}

const defaultStore = createGenerationHistoryStore();

export const readGenerationHistory = defaultStore.readGenerationHistory;
export const writeGenerationHistory = defaultStore.writeGenerationHistory;
export const readStoredImageFile = defaultStore.readStoredImageFile;
