export const maxEditUploadBytes = 600 * 1024;
export const maxEditUploadDimension = 1024;

export type CompactEditImageSize = {
  height: number;
  width: number;
};

export function shouldCompactEditImage(
  byteLength: number,
  maxBytes = maxEditUploadBytes
): boolean {
  return byteLength > maxBytes;
}

export function resolveCompactEditImageSize(
  width: number,
  height: number,
  maxDimension = maxEditUploadDimension
): CompactEditImageSize {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const longestSide = Math.max(safeWidth, safeHeight);

  if (longestSide <= maxDimension) {
    return {
      height: safeHeight,
      width: safeWidth
    };
  }

  const scale = maxDimension / longestSide;

  return {
    height: Math.max(1, Math.round(safeHeight * scale)),
    width: Math.max(1, Math.round(safeWidth * scale))
  };
}
