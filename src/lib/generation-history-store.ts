import { promises as fs } from "node:fs";
import { lookup as lookupDns } from "node:dns/promises";
import { isIP } from "node:net";
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
const DEFAULT_REMOTE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const remoteImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

type ParsedDataUrl = {
  bytes: Buffer;
  mimeType: string;
};

type RemoteImageLookup = (hostname: string) => Promise<string[]>;
type RemoteImageFetch = typeof fetch;

export type StoredImageFile = {
  bytes: Buffer;
  mimeType: string;
};

export type GenerationHistoryStoreOptions = {
  allowedRemoteImageHosts?: string[];
  fetchRemoteImage?: RemoteImageFetch;
  lookupRemoteImageHost?: RemoteImageLookup;
  maxRemoteImageBytes?: number;
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

function readOperation(value: unknown): StoredGenerationSession["operation"] {
  return value === "edit" ? "edit" : "generate";
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
    operation: readOperation(value.operation),
    sourceImageId: readString(value.sourceImageId) || undefined,
    referenceImageCount:
      readNumber(value.referenceImageCount) > 0
        ? readNumber(value.referenceImageCount)
        : undefined,
    usedMask: typeof value.usedMask === "boolean" ? value.usedMask : undefined,
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

function readAllowedRemoteImageHosts(
  env: Record<string, string | undefined> = process.env
): string[] {
  return normalizeAllowedRemoteImageHosts(
    (env.OPENAI_IMAGE_PERSIST_ALLOWED_HOSTS || "").split(",")
  );
}

function normalizeAllowedRemoteImageHosts(hosts: string[]): string[] {
  return hosts
    .map((host) => host.trim().toLowerCase().replace(/\.+$/, ""))
    .filter(Boolean);
}

function readPositiveInteger(
  value: number | string | undefined,
  fallback: number
): number {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : fallback;
}

function readRemoteImageMaxBytes(
  env: Record<string, string | undefined> = process.env
): number {
  return readPositiveInteger(
    env.OPENAI_IMAGE_PERSIST_MAX_BYTES,
    DEFAULT_REMOTE_IMAGE_MAX_BYTES
  );
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
    mimeType: `image/${extension}`
  };
}

function createImageUrl(sessionId: string, imageId: string): string {
  const query = new URLSearchParams({ sessionId, imageId });
  return `/api/generation-history/image?${query.toString()}`;
}

function extensionFromMimeType(mimeType: string): "jpeg" | "png" | "webp" {
  if (mimeType === "image/jpeg") {
    return "jpeg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
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

async function persistImageBytes(
  rootDir: string,
  sessionId: string,
  imageId: string,
  bytes: Buffer,
  mimeType: string
): Promise<StoredGeneratedImage> {
  const imagePath = createImagePath(
    rootDir,
    sessionId,
    imageId,
    extensionFromMimeType(mimeType)
  );

  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.writeFile(imagePath, bytes);

  return {
    id: imageId,
    dataUrl: createImageUrl(sessionId, imageId),
    mimeType
  };
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

  return persistImageBytes(
    rootDir,
    sessionId,
    image.id,
    parsed.bytes,
    parsed.mimeType
  );
}

function parseIpv4Address(value: string): number[] | null {
  if (isIP(value) !== 4) {
    return null;
  }

  return value.split(".").map((part) => Number(part));
}

function isPrivateIpv4(value: string): boolean {
  const parts = parseIpv4Address(value);
  if (!parts) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isPrivateIpv6(value: string): boolean {
  const normalized = value.toLowerCase();
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4[1]);
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isPrivateIpAddress(value: string): boolean {
  const version = isIP(value);

  if (version === 4) {
    return isPrivateIpv4(value);
  }

  if (version === 6) {
    return isPrivateIpv6(value);
  }

  return false;
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.+$/, "");
}

async function defaultLookupRemoteImageHost(hostname: string): Promise<string[]> {
  const records = await lookupDns(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

async function isSafeRemoteImageUrl(
  imageUrl: URL,
  allowedHosts: string[],
  lookupRemoteImageHost: RemoteImageLookup
): Promise<boolean> {
  if (imageUrl.protocol !== "https:" || imageUrl.username || imageUrl.password) {
    return false;
  }

  const hostname = normalizeHostname(imageUrl.hostname);
  if (!allowedHosts.includes(hostname)) {
    return false;
  }

  if (isPrivateIpAddress(hostname)) {
    return false;
  }

  try {
    const addresses = await lookupRemoteImageHost(hostname);
    return addresses.length > 0 && addresses.every((address) => !isPrivateIpAddress(address));
  } catch {
    return false;
  }
}

function readImageMimeType(value: string | null): string | null {
  const mimeType = (value || "").split(";")[0].trim().toLowerCase();
  return remoteImageMimeTypes.has(mimeType) ? mimeType : null;
}

async function readResponseBytes(response: Response, maxBytes: number): Promise<Buffer> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxBytes) {
    throw new Error("远程图片超过允许大小");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) {
      throw new Error("远程图片超过允许大小");
    }

    return bytes;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }

    const chunk = Buffer.from(result.value);
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw new Error("远程图片超过允许大小");
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function persistRemoteImageUrl(
  rootDir: string,
  sessionId: string,
  image: StoredGeneratedImage,
  options: Required<GenerationHistoryStoreOptions>
): Promise<StoredGeneratedImage> {
  let imageUrl: URL;

  try {
    imageUrl = new URL(image.dataUrl);
  } catch {
    return image;
  }

  const isSafeUrl = await isSafeRemoteImageUrl(
    imageUrl,
    options.allowedRemoteImageHosts,
    options.lookupRemoteImageHost
  );

  if (!isSafeUrl) {
    return image;
  }

  try {
    /*
     * 拒绝重定向，避免白名单 URL 再跳转到内网地址形成 SSRF。
     */
    const response = await options.fetchRemoteImage(imageUrl.toString(), {
      redirect: "error"
    });
    const mimeType = readImageMimeType(response.headers.get("content-type"));

    if (!response.ok || !mimeType) {
      return image;
    }

    const bytes = await readResponseBytes(response, options.maxRemoteImageBytes);
    if (bytes.length === 0) {
      return image;
    }

    return persistImageBytes(rootDir, sessionId, image.id, bytes, mimeType);
  } catch {
    return image;
  }
}

async function persistImageValue(
  rootDir: string,
  sessionId: string,
  image: StoredGeneratedImage,
  options: Required<GenerationHistoryStoreOptions>
): Promise<StoredGeneratedImage> {
  const dataUrlImage = await persistImageDataUrl(rootDir, sessionId, image);

  if (dataUrlImage.dataUrl !== image.dataUrl) {
    return dataUrlImage;
  }

  return persistRemoteImageUrl(rootDir, sessionId, image, options);
}

async function compactSessionImages(
  rootDir: string,
  session: StoredGenerationSession,
  options: Required<GenerationHistoryStoreOptions>
): Promise<{ changed: boolean; session: StoredGenerationSession }> {
  let changed = false;
  const images: StoredGeneratedImage[] = [];

  for (const image of session.images) {
    const compactedImage = await persistImageValue(
      rootDir,
      session.id,
      image,
      options
    );
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
  sessions: StoredGenerationSession[],
  options: Required<GenerationHistoryStoreOptions>
): Promise<{ changed: boolean; sessions: StoredGenerationSession[] }> {
  let changed = false;
  const compactedSessions: StoredGenerationSession[] = [];

  for (const session of sessions) {
    const compacted = await compactSessionImages(rootDir, session, options);
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
  rootDir = HISTORY_DIR,
  storeOptions: GenerationHistoryStoreOptions = {}
): GenerationHistoryStore {
  const historyFile = path.join(rootDir, "generation-history.json");
  const options: Required<GenerationHistoryStoreOptions> = {
    allowedRemoteImageHosts:
      storeOptions.allowedRemoteImageHosts === undefined
        ? readAllowedRemoteImageHosts()
        : normalizeAllowedRemoteImageHosts(storeOptions.allowedRemoteImageHosts),
    fetchRemoteImage: storeOptions.fetchRemoteImage ?? fetch,
    lookupRemoteImageHost:
      storeOptions.lookupRemoteImageHost ?? defaultLookupRemoteImageHost,
    maxRemoteImageBytes: readPositiveInteger(
      storeOptions.maxRemoteImageBytes,
      readRemoteImageMaxBytes()
    )
  };

  return {
    historyFile,

    async readGenerationHistory(): Promise<StoredGenerationSession[]> {
      try {
        const content = await fs.readFile(historyFile, "utf8");
        const sessions = normalizeHistory(JSON.parse(content));
        const compacted = await compactSessions(rootDir, sessions, options);

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
      const compacted = await compactSessions(rootDir, sessions, options);

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
