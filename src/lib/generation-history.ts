export const MIN_IMAGE_VIEWER_ZOOM = 0.5;
export const MAX_IMAGE_VIEWER_ZOOM = 2.5;
export const DEFAULT_IMAGE_VIEWER_ZOOM = 1;

export function createGenerationTitle(prompt: string, maxLength = 18): string {
  const normalizedPrompt = prompt.replace(/\s+/g, " ").trim();

  if (!normalizedPrompt) {
    return "未命名图片";
  }

  // 最近记录只保留短标题，避免长提示词把侧边栏挤乱。
  return normalizedPrompt.length > maxLength
    ? `${normalizedPrompt.slice(0, maxLength)}...`
    : normalizedPrompt;
}

export function clampImageViewerZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_IMAGE_VIEWER_ZOOM;
  }

  // 缩放范围保持克制：既能看细节，也不会让图片飞出查看器太远。
  return Math.min(
    Math.max(value, MIN_IMAGE_VIEWER_ZOOM),
    MAX_IMAGE_VIEWER_ZOOM
  );
}
