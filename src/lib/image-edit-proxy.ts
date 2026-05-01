import type { GenerationUsage } from "@/lib/generation-history-types";
import type { ImageOutputFormat } from "@/lib/image-options";
import type { ImageEditFields } from "@/lib/image-edit-options";

export type ImageEditProxyRequestOptions = {
  apiKey: string;
  baseUrl: string;
  fields: ImageEditFields;
  imageModel?: string;
  images: File[];
  mask: File | null;
  responsesModel?: string;
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

type ResponsesImageEditProxyRequestOptions = ImageEditProxyRequestOptions & {
  imageModel: string;
  responsesModel: string;
};

type ResponsesImageOutput = {
  id?: string;
  result?: string;
  type?: string;
};

type ResponsesImageEditResponse = {
  created_at?: number;
  model?: string;
  output?: ResponsesImageOutput[];
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

async function fileToDataUrl(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/png";

  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

function readPayloadErrorMessage(payload: unknown): string {
  const record = asRecord(payload);
  const error = asRecord(record.error);

  return (
    (typeof error.message === "string" && error.message) ||
    (typeof record.message === "string" && record.message) ||
    ""
  );
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 160);
    throw new Error(
      `上游图片编辑接口返回非 JSON 响应（HTTP ${response.status}）：${preview || response.statusText}`
    );
  }
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

  body.set("model", options.imageModel || "gpt-image-2");
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

export async function createResponsesImageEditProxyRequest(
  options: ResponsesImageEditProxyRequestOptions
): Promise<ImageEditProxyRequest> {
  const content = [
    {
      type: "input_text",
      text: options.fields.prompt
    },
    ...(await Promise.all(
      options.images.map(async (image) => ({
        type: "input_image",
        image_url: await fileToDataUrl(image)
      }))
    ))
  ];
  const tool: Record<string, unknown> = {
    type: "image_generation",
    model: options.imageModel,
    action: "edit",
    size: options.fields.size,
    quality: options.fields.quality,
    output_format: options.fields.outputFormat,
    background: options.fields.background
  };

  if (options.mask) {
    tool.input_image_mask = {
      image_url: await fileToDataUrl(options.mask)
    };
  }

  return {
    url: `${normalizeBaseUrl(options.baseUrl)}/responses`,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.responsesModel,
        input: [
          {
            role: "user",
            content
          }
        ],
        tools: [tool],
        // 部分中转站的 Responses 结构体只接受字符串形式的 tool_choice。
        tool_choice: "required"
      })
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

export function normalizeResponsesImageEditResponse(
  response: ResponsesImageEditResponse,
  outputFormat: ImageOutputFormat
): ImageEditResult {
  const images = (response.output || [])
    .filter(
      (output) =>
        output.type === "image_generation_call" &&
        typeof output.result === "string" &&
        output.result.length > 0
    )
    .map((output, index) => ({
      id: `${output.id || response.created_at || Date.now()}-${index}`,
      dataUrl: `data:image/${outputFormat};base64,${output.result}`,
      mimeType: `image/${outputFormat}`
    }));

  if (images.length === 0) {
    throw new Error("Responses API 图片编辑未返回图片数据");
  }

  return {
    images,
    model: response.model || "responses",
    usage: readUsage(response.usage)
  };
}

export async function sendImageEditRequest(
  options: ImageEditProxyRequestOptions
): Promise<ImageEditResult> {
  const imageModel = options.imageModel || "gpt-image-2";
  const responsesModel = options.responsesModel || "gpt-4.1-mini";
  const request =
    options.fields.apiMode === "responses"
      ? await createResponsesImageEditProxyRequest({
          ...options,
          imageModel,
          responsesModel
        })
      : createImageEditProxyRequest({
          ...options,
          imageModel
        });
  let response: Response;

  try {
    response = await fetch(request.url, request.init);
  } catch (error) {
    throw new Error(
      `连接上游图片编辑接口失败（${request.url}）：${readErrorMessage(error)}`
    );
  }

  const payload = (await readJsonPayload(response)) as ImageEditResponse &
    ResponsesImageEditResponse & {
      error?: { message?: string };
    };

  if (!response.ok) {
    throw new Error(
      readPayloadErrorMessage(payload) || "图片编辑失败，请稍后重试"
    );
  }

  if (options.fields.apiMode === "responses") {
    return normalizeResponsesImageEditResponse(
      payload,
      options.fields.outputFormat
    );
  }

  return normalizeImageEditResponse(payload, options.fields.outputFormat);
}

