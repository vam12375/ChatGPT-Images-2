import type { ImageOutputFormat, ImageSize } from "@/lib/image-options";

export type GenerationUsage = {
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
};

export type StoredGeneratedImage = {
  id: string;
  dataUrl: string;
};

export type StoredGenerationSession = {
  id: string;
  title: string;
  prompt: string;
  size: ImageSize;
  sizeLabel: string;
  sizeValue: string;
  qualityLabel: string;
  outputFormat: ImageOutputFormat;
  count: number;
  images: StoredGeneratedImage[];
  model: string;
  usage: GenerationUsage | null;
  createdAt: string;
};
