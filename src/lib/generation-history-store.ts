import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  GenerationUsage,
  StoredGeneratedImage,
  StoredGenerationSession
} from "@/lib/generation-history-types";
import type { ImageOutputFormat, ImageSize } from "@/lib/image-options";

const HISTORY_LIMIT = 12;
const HISTORY_DIR = path.join(process.cwd(), ".local");
const HISTORY_FILE = path.join(HISTORY_DIR, "generation-history.json");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

  return { id, dataUrl };
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

export async function readGenerationHistory(): Promise<StoredGenerationSession[]> {
  try {
    const content = await fs.readFile(HISTORY_FILE, "utf8");
    return normalizeHistory(JSON.parse(content));
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function writeGenerationHistory(
  input: unknown
): Promise<StoredGenerationSession[]> {
  const sessions = normalizeHistory(input);
  const tempFile = `${HISTORY_FILE}.tmp`;

  await fs.mkdir(HISTORY_DIR, { recursive: true });
  await fs.writeFile(tempFile, `${JSON.stringify(sessions, null, 2)}\n`, "utf8");
  await fs.rename(tempFile, HISTORY_FILE);

  return sessions;
}
