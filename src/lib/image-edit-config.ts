import type { GenerationApiMode } from "@/lib/image-options";

const defaultImageEditBaseUrl = "https://api.apiyi.com/v1";

type ImageEditEnv = {
  OPENAI_BASE_URL?: string;
  OPENAI_IMAGE_EDIT_BASE_URL?: string;
  OPENAI_IMAGES_EDIT_BASE_URL?: string;
  OPENAI_RESPONSES_BASE_URL?: string;
  OPENAI_RESPONSES_EDIT_BASE_URL?: string;
};

function normalizeAbsoluteBaseUrl(value: string | undefined): string | null {
  const candidate = value?.trim().replace(/\/+$/, "");

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return candidate;
  } catch {
    return null;
  }
}

export function readImageEditBaseUrl(
  apiMode: GenerationApiMode,
  env: ImageEditEnv = process.env as ImageEditEnv
): string {
  if (apiMode === "responses") {
    return (
      normalizeAbsoluteBaseUrl(env.OPENAI_RESPONSES_EDIT_BASE_URL) ||
      normalizeAbsoluteBaseUrl(env.OPENAI_RESPONSES_BASE_URL) ||
      normalizeAbsoluteBaseUrl(env.OPENAI_BASE_URL) ||
      defaultImageEditBaseUrl
    );
  }

  return (
    normalizeAbsoluteBaseUrl(env.OPENAI_IMAGE_EDIT_BASE_URL) ||
    normalizeAbsoluteBaseUrl(env.OPENAI_IMAGES_EDIT_BASE_URL) ||
    defaultImageEditBaseUrl
  );
}
