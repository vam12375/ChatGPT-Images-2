export const imageAspectRatios = ["1:1", "3:4", "9:16", "4:3", "16:9"] as const;

export type ImageAspectRatio = (typeof imageAspectRatios)[number];

const aspectRatioInstructionPattern =
  /(?:\r?\n){0,2}Make the aspect ratio (?:1:1|3:4|9:16|4:3|16:9)\.?$/i;

export function createAspectRatioInstruction(ratio: ImageAspectRatio): string {
  return `Make the aspect ratio ${ratio}`;
}

export function appendAspectRatioInstruction(
  prompt: string,
  ratio: ImageAspectRatio
): string {
  const cleanPrompt = prompt
    .trim()
    .replace(aspectRatioInstructionPattern, "")
    .trim();
  const instruction = createAspectRatioInstruction(ratio);

  return cleanPrompt ? `${cleanPrompt}\n\n${instruction}` : instruction;
}
