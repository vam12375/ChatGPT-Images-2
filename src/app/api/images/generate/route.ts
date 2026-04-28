import { randomUUID } from "node:crypto";

import { createGenerationTitle } from "@/lib/generation-history";
import {
  readGenerationHistory,
  writeGenerationHistory
} from "@/lib/generation-history-store";
import type {
  GenerationUsage,
  StoredGenerationSession
} from "@/lib/generation-history-types";
import {
  buildOpenAIImageRequest,
  type ImageRequestOptions,
  parseImageRequest
} from "@/lib/image-options";
import { formatOpenAIError } from "@/lib/openai-error";
import { handleProxyRequest } from "@/lib/proxy-handler";

export const runtime = "nodejs";

function toErrorResponse(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function readRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object"
    ? (input as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function createSessionId(): string {
  return `${Date.now()}-${randomUUID()}`;
}

function readHistoryMetadata(
  requestBody: unknown,
  options: ImageRequestOptions
): Pick<StoredGenerationSession, "sizeLabel" | "sizeValue" | "qualityLabel"> {
  const history = readRecord(readRecord(requestBody).history);

  return {
    sizeLabel: readString(history.sizeLabel) || options.size,
    sizeValue: readString(history.sizeValue) || options.size,
    qualityLabel: readString(history.qualityLabel) || options.quality
  };
}

async function saveSessionToHistory(
  session: StoredGenerationSession
): Promise<void> {
  try {
    const currentSessions = await readGenerationHistory();
    await writeGenerationHistory([session, ...currentSessions]);
  } catch {
    // 最近记录是辅助能力，写入失败时不影响图片生成结果返回。
    console.warn("保存最近记录失败");
  }
}

export async function POST(request: Request): Promise<Response> {
  let requestBody: unknown;
  let options: ImageRequestOptions;

  try {
    requestBody = await request.json();
    options = parseImageRequest(requestBody);
  } catch (error) {
    return toErrorResponse(readErrorMessage(error, "请求参数无效"));
  }

  try {
    const result = await handleProxyRequest(
      options,
      buildOpenAIImageRequest,
      formatOpenAIError
    );
    const session: StoredGenerationSession = {
      id: createSessionId(),
      title: createGenerationTitle(options.prompt),
      prompt: options.prompt,
      size: options.size,
      ...readHistoryMetadata(requestBody, options),
      outputFormat: options.outputFormat,
      count: options.count,
      images: result.images,
      model: result.model,
      usage: result.usage ? (result.usage as GenerationUsage) : null,
      createdAt: new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    await saveSessionToHistory(session);

    return Response.json({
      images: result.images,
      model: result.model,
      usage: result.usage,
      session,
      cached: result.cached || false
    });
  } catch (error) {
    // 统一出口保留中文错误，避免把 SDK 原始对象直接暴露给前端。
    const formattedError = formatOpenAIError(error);
    return toErrorResponse(formattedError.message, formattedError.status);
  }
}
