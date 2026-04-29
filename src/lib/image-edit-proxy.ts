import type { GenerationUsage } from "@/lib/generation-history-types";
import type { ImageOutputFormat } from "@/lib/image-options";
import type { ImageEditFields } from "@/lib/image-edit-options";

export type ImageEditProxyRequestOptions = {
  apiKey: string;
  baseUrl: string;
  fields: ImageEditFields;
  images: File[];
  mask: File | null;
};

export type ImageEditProxyRequest = {
  init: RequestInit;
  url: string;
};

export type ImageEditResult = {
  images: Array<{
    id: string;
    dataUrl: string;
    mimeType: string;
  }>;
  model: string;
  usage: GenerationUsage | null;
};

type ImageEditResponseData = {
  b64_json?: string;
  url?: string;
};

type ImageEditResponse = {
  created?: number;
  data?: ImageEditResponseData[];
  model?: string;
  usage?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readUsage(value: unknown): GenerationUsage | null {
  const usage = asRecord(value);
  const totalTokens = readOptionalNumber(usage.total_tokens);
  const inputTokens =
    readOptionalNumber(usage.input_tokens) ??
    readOptionalNumber(usage.prompt_tokens);
  const outputTokens =
    readOptionalNumber(usage.output_tokens) ??
    readOptionalNumber(usage.completion_tokens);

  if (
    totalTokens === undefined &&
    inputTokens === undefined &&
    outputTokens === undefined
  ) {
    return null;
  }

  return {
    total_tokens: totalTokens,
    input_tokens: inputTokens,
    output_tokens: outputTokens
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function readImageDataUrl(
  image: ImageEditResponseData,
  outputFormat: ImageOutputFormat
): string {
  if (image.b64_json) {
    return `data:image/${outputFormat};base64,${image.b64_json}`;
  }

  if (image.url) {
    return image.url;
  }

  throw new Error("图片编辑接口未返回图片数据");
}

export function createImageEditProxyRequest(
  options: ImageEditProxyRequestOptions
): ImageEditProxyRequest {
  const body = new FormData();

  body.set("model", "gpt-image-2");
  body.set("prompt", options.fields.prompt);
  body.set("size", options.fields.size);
  body.set("quality", options.fields.quality);
  body.set("output_format", options.fields.outputFormat);
  body.set("background", options.fields.background);

  for (const image of options.images) {
    body.append("image[]", image);
  }

  if (options.mask) {
    body.set("mask", options.mask);
  }

  return {
    url: `${normalizeBaseUrl(options.baseUrl)}/images/edits`,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`
      },
      body
    }
  };
}

export function normalizeImageEditResponse(
  response: ImageEditResponse,
  outputFormat: ImageOutputFormat
): ImageEditResult {
  const images = (response.data || []).map((image, index) => {
    const dataUrl = readImageDataUrl(image, outputFormat);

    return {
      id: `${response.created || Date.now()}-${index}`,
      dataUrl,
      mimeType: `image/${outputFormat}`
    };
  });

  if (images.length === 0) {
    throw new Error("图片编辑接口未返回图片数据");
  }

  return {
    images,
    model: response.model || "gpt-image-2",
    usage: readUsage(response.usage)
  };
}

export async function sendImageEditRequest(
  options: ImageEditProxyRequestOptions
): Promise<ImageEditResult> {
  const request = createImageEditProxyRequest(options);
  const response = await fetch(request.url, request.init);
  const payload = (await response.json()) as ImageEditResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || "图片编辑失败，请稍后重试");
  }

  return normalizeImageEditResponse(payload, options.fields.outputFormat);
}

