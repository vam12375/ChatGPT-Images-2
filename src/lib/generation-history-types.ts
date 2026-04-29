import type {
  GenerationApiMode,
  ImageOutputFormat,
  ImageSize
} from "@/lib/image-options";

export type GenerationUsage = {
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
};

export type StoredGeneratedImage = {
  id: string;
  dataUrl: string;
  mimeType?: string;
};

export type StoredGenerationSession = {
  id: string;
  title: string;
  prompt: string;
  operation: "generate" | "edit";
  sourceImageId?: string;
  referenceImageCount?: number;
  usedMask?: boolean;
  size: ImageSize;
  sizeLabel: string;
  sizeValue: string;
  qualityLabel: string;
  apiMode: GenerationApiMode;
  outputFormat: ImageOutputFormat;
  count: number;
  images: StoredGeneratedImage[];
  model: string;
  usage: GenerationUsage | null;
  createdAt: string;
};
