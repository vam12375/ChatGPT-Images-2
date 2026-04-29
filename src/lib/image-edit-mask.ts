export function readMaskAlpha(selectionAlpha: number): number {
  // API 要求透明区域被重绘，因此任何涂抹痕迹都导出为 alpha 0。
  return selectionAlpha > 0 ? 0 : 255;
}

