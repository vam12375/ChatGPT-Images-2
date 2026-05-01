import { randomUUID } from "node:crypto";

import { createGenerationTitle } from "@/lib/generation-history";
import {
  readGenerationHistory,
  writeGenerationHistory
} from "@/lib/generation-history-store";
import type { StoredGenerationSession } from "@/lib/generation-history-types";
import { readImageEditBaseUrl } from "@/lib/image-edit-config";
import {
  parseImageEditFields,
  validateImageEditFiles
} from "@/lib/image-edit-options";
import { formatOpenAIError } from "@/lib/openai-error";
import { proxyConfig } from "@/lib/proxy-config";
import {
  createMemoryRateLimiter,
  readClientIdentifier,
  readRateLimitConfig
} from "@/lib/rate-limit";
import { sendImageEditRequest } from "@/lib/image-edit-proxy";

export const runtime = "nodejs";

const editRateLimiter = createMemoryRateLimiter(readRateLimitConfig());

function createSessionId(): string {
  return `${Date.now()}-${randomUUID()}`;
}

function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function readFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

function readFiles(values: FormDataEntryValue[]): File[] {
  return values.filter(
    (value): value is File => value instanceof File && value.size > 0
  );
}

function toErrorResponse(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function saveSessionToHistory(
  session: StoredGenerationSession
): Promise<StoredGenerationSession> {
  try {
    const currentSessions = await readGenerationHistory();
    const sessions = await writeGenerationHistory([session, ...currentSessions]);
    return sessions[0] ?? session;
  } catch {
    // 历史记录是辅助能力，失败时不阻塞图片编辑结果返回。
    console.warn("保存图片编辑记录失败");
    return session;
  }
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = editRateLimiter.check(readClientIdentifier(request));
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "请求过于频繁，请稍后再试" },
      {
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000))
        },
        status: 429
      }
    );
  }

  let formData: FormData;
  let fields: ReturnType<typeof parseImageEditFields>;
  let images: File[];
  let mask: File | null;

  try {
    formData = await request.formData();
    fields = parseImageEditFields({
      prompt: formData.get("prompt"),
      size: formData.get("size"),
      quality: formData.get("quality"),
      output_format: formData.get("output_format"),
      background: formData.get("background"),
      api_mode: formData.get("api_mode")
    });
    images = readFiles(formData.getAll("image[]"));
    mask = readFile(formData.get("mask"));
    validateImageEditFiles(images, mask);
  } catch (error) {
    return toErrorResponse(readErrorMessage(error, "图片编辑请求参数无效"));
  }

  try {
    const result = await sendImageEditRequest({
      apiKey: proxyConfig.getNextApiKey(),
      baseUrl: readImageEditBaseUrl(fields.apiMode),
      fields,
      imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      images,
      mask,
      responsesModel: process.env.OPENAI_RESPONSES_MODEL || "gpt-4.1-mini"
    });
    const session: StoredGenerationSession = {
      id: createSessionId(),
      title: createGenerationTitle(fields.prompt),
      prompt: fields.prompt,
      operation: "edit",
      sourceImageId: readString(formData.get("source_image_id")) || undefined,
      referenceImageCount: images.length,
      usedMask: Boolean(mask),
      size: fields.size,
      sizeLabel: readString(formData.get("size_label")) || fields.size,
      sizeValue: readString(formData.get("size_value")) || fields.size,
      qualityLabel: readString(formData.get("quality_label")) || fields.quality,
      apiMode: fields.apiMode,
      outputFormat: fields.outputFormat,
      count: result.images.length,
      images: result.images,
      model: result.model,
      usage: result.usage,
      createdAt: new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };
    const storedSession = await saveSessionToHistory(session);

    return Response.json({
      images: storedSession.images,
      model: storedSession.model,
      usage: storedSession.usage,
      session: storedSession
    });
  } catch (error) {
    const formattedError = formatOpenAIError(error);
    return toErrorResponse(formattedError.message, formattedError.status);
  }
}

