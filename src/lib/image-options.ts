export const imageSizes = [
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
  "2048x1152",
  "3840x2160",
  "2160x3840"
] as const;

export const imageQualities = ["low", "medium", "high"] as const;
export const imageOutputFormats = ["png", "jpeg", "webp"] as const;

export type PresetImageSize = (typeof imageSizes)[number];
export type ImageSize = PresetImageSize | `${number}x${number}`;
export type ImageQuality = (typeof imageQualities)[number];
export type ImageOutputFormat = (typeof imageOutputFormats)[number];

export type ImageRequestOptions = {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageOutputFormat;
  count: number;
};

export type OpenAIImagePayload = {
  model: string;
  prompt: string;
  n: number;
  size: ImageSize;
  quality?: ImageQuality;
  output_format?: ImageOutputFormat;
  response_format?: "b64_json";
};

const MIN_IMAGE_PIXELS = 650_000;
const MAX_IMAGE_PIXELS = 8_300_000;
const MAX_IMAGE_EDGE = 3840;
const MAX_IMAGE_ASPECT_RATIO = 3;
const imageSizePattern = /^(\d+)x(\d+)$/;

const allowedSizes = new Set<string>(imageSizes);
const allowedQualities = new Set<string>(imageQualities);
const allowedFormats = new Set<string>(imageOutputFormats);

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeImageSize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function readChoice<T extends string>(
  value: unknown,
  allowed: Set<string>,
  fallback: T
): T {
  const candidate = readString(value);
  return allowed.has(candidate) ? (candidate as T) : fallback;
}

function readImageSize(value: unknown): ImageSize {
  const candidate = normalizeImageSize(readString(value));

  if (!candidate) {
    return "1024x1024";
  }

  if (allowedSizes.has(candidate)) {
    return candidate as PresetImageSize;
  }

  const match = candidate.match(imageSizePattern);
  if (!match) {
    throw new Error(
      "尺寸格式无效。请输入如 2048x1152 的宽x高，并满足最大边 ≤ 3840、宽高为 16 的倍数、长宽比 ≤ 3:1、总像素 0.65–8.3MP。"
    );
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  const longestEdge = Math.max(width, height);
  const shortestEdge = Math.min(width, height);
  const totalPixels = width * height;

  const isValidCustomSize =
    width > 0 &&
    height > 0 &&
    width % 16 === 0 &&
    height % 16 === 0 &&
    longestEdge <= MAX_IMAGE_EDGE &&
    shortestEdge > 0 &&
    longestEdge / shortestEdge <= MAX_IMAGE_ASPECT_RATIO &&
    totalPixels >= MIN_IMAGE_PIXELS &&
    totalPixels <= MAX_IMAGE_PIXELS;

  if (!isValidCustomSize) {
    throw new Error(
      "尺寸格式无效。请输入如 2048x1152 的宽x高，并满足最大边 ≤ 3840、宽高为 16 的倍数、长宽比 ≤ 3:1、总像素 0.65–8.3MP。"
    );
  }

  return candidate as ImageSize;
}

function readCount(value: unknown): number {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue)) {
    return 1;
  }

  // 控制单次生成数量，避免误操作一次消耗过多额度。
  return Math.min(Math.max(numericValue, 1), 4);
}

function readRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object"
    ? (input as Record<string, unknown>)
    : {};
}

export function parseImageRequest(input: unknown): ImageRequestOptions {
  const record = readRecord(input);
  const prompt = readString(record.prompt);

  if (!prompt) {
    throw new Error("请输入图片描述");
  }

  return {
    prompt,
    size: readImageSize(record.size),
    quality: readChoice<ImageQuality>(record.quality, allowedQualities, "medium"),
    outputFormat: readChoice<ImageOutputFormat>(
      record.outputFormat,
      allowedFormats,
      "png"
    ),
    count: readCount(record.count)
  };
}

export function buildOpenAIImageRequest(
  options: ImageRequestOptions,
  model: string
): OpenAIImagePayload {
  const payload: OpenAIImagePayload = {
    model,
    prompt: options.prompt,
    n: options.count,
    size: options.size
  };

  if (model.startsWith("dall-e")) {
    payload.response_format = "b64_json";
    return payload;
  }

  // GPT Image 模型支持质量和输出格式，旧模型保持最小兼容参数。
  payload.quality = options.quality;
  payload.output_format = options.outputFormat;
  return payload;
}
