import {
  generationApiModes,
  imageOutputFormats,
  imageQualities,
  imageSizes,
  type GenerationApiMode,
  type ImageOutputFormat,
  type ImageQuality,
  type ImageSize
} from "./image-options.ts";

export type ImageEditBackground = "auto" | "opaque";

export type ImageEditFields = {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageOutputFormat;
  background: ImageEditBackground;
  apiMode: GenerationApiMode;
};

const allowedSizes = new Set<string>(imageSizes);
const allowedQualities = new Set<string>(imageQualities);
const allowedFormats = new Set<string>(imageOutputFormats);
const allowedApiModes = new Set<string>(generationApiModes);
const allowedBackgrounds = new Set<string>(["auto", "opaque"]);
const allowedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp"
]);
const maxReferenceImages = 16;

function readRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object"
    ? (input as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readChoice<T extends string>(
  value: unknown,
  allowed: Set<string>,
  fallback: T,
  errorMessage: string
): T {
  const candidate = readString(value);

  if (!candidate) {
    return fallback;
  }

  if (allowed.has(candidate)) {
    return candidate as T;
  }

  throw new Error(errorMessage);
}

function readImageSize(value: unknown): ImageSize {
  const candidate = readString(value).toLowerCase().replace(/\s+/g, "");

  if (!candidate) {
    return "1024x1024";
  }

  if (allowedSizes.has(candidate)) {
    return candidate as ImageSize;
  }

  throw new Error("当前仅支持 1024x1024、1536x1024、1024x1536 三种标准尺寸");
}

function isAllowedImageFile(file: File): boolean {
  return allowedImageTypes.has(file.type.toLowerCase());
}

export function parseImageEditFields(input: unknown): ImageEditFields {
  const record = readRecord(input);
  const prompt = readString(record.prompt);

  if (!prompt) {
    throw new Error("请输入图片编辑指令");
  }

  if (readString(record.background) === "transparent") {
    throw new Error("图片编辑暂不支持透明背景");
  }

  return {
    prompt,
    size: readImageSize(record.size),
    quality: readChoice<ImageQuality>(
      record.quality,
      allowedQualities,
      "high",
      "图片编辑质量参数无效"
    ),
    outputFormat: readChoice<ImageOutputFormat>(
      record.output_format ?? record.outputFormat,
      allowedFormats,
      "png",
      "图片输出格式无效"
    ),
    background: readChoice<ImageEditBackground>(
      record.background,
      allowedBackgrounds,
      "auto",
      "图片编辑背景仅支持 auto 或 opaque"
    ),
    apiMode: readChoice<GenerationApiMode>(
      record.api_mode ?? record.apiMode,
      allowedApiModes,
      "images",
      "图片编辑接口类型无效"
    )
  };
}

export function validateImageEditFiles(images: File[], mask: File | null): void {
  if (images.length === 0) {
    throw new Error("请先选择要编辑的图片");
  }

  if (images.length > maxReferenceImages) {
    throw new Error("图片编辑最多支持 16 张参考图");
  }

  if (images.some((image) => !isAllowedImageFile(image))) {
    throw new Error("仅支持 PNG、JPEG、WebP 格式的参考图");
  }

  if (mask && !isAllowedImageFile(mask)) {
    throw new Error("mask 必须是 PNG、JPEG 或 WebP 图片文件");
  }
}
