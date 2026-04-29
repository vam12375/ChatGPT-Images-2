import type {
  GenerationUsage,
  StoredGeneratedImage,
  StoredGenerationSession
} from "@/lib/generation-history-types";
import type { ImageAspectRatio } from "@/lib/aspect-ratio-prompt";
import type { ImageOutputFormat, ImageSize } from "@/lib/image-options";

export type GeneratedImage = StoredGeneratedImage;
export type Usage = GenerationUsage;
export type GenerationSession = StoredGenerationSession;

export type ViewerImage = {
  image: GeneratedImage;
  index: number;
  title: string;
  outputFormat: ImageOutputFormat;
};

export type ImageEditTarget = {
  image: GeneratedImage;
  imageIndex: number;
  session: GenerationSession;
};

export type SizeOption = {
  value: ImageAspectRatio;
  apiSize: ImageSize;
  label: string;
  ratio: ImageAspectRatio;
  dimensions: string;
  previewClass: string;
};
