import type { ImageOutputFormat } from "@/lib/image-options";

function padTime(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDownloadFilename(
  date: Date,
  index: number,
  outputFormat: ImageOutputFormat
): string {
  const suffix = index > 0 ? `_${index + 1}` : "";

  // 保持用户熟悉的中文日期格式，时间部分用下划线避免文件系统兼容问题。
  return `ChatGPT Image ${date.getFullYear()}年${
    date.getMonth() + 1
  }月${date.getDate()}日 ${padTime(date.getHours())}_${padTime(
    date.getMinutes()
  )}_${padTime(date.getSeconds())}${suffix}.${outputFormat}`;
}
