import { Loader2, Send } from "lucide-react";
import type { FormEvent } from "react";

import type { GenerationApiMode } from "@/lib/image-options";

type SelectOption<T extends string> = {
  label: string;
  value: T;
};

type EditComposerProps = {
  apiMode: GenerationApiMode;
  apiModeOptions: Array<SelectOption<GenerationApiMode>>;
  hasMask: boolean;
  isSubmitting: boolean;
  prompt: string;
  onApiModeChange: (value: GenerationApiMode) => void;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function EditComposer({
  apiMode,
  apiModeOptions,
  hasMask,
  isSubmitting,
  prompt,
  onApiModeChange,
  onPromptChange,
  onSubmit
}: EditComposerProps) {
  return (
    <form className="edit-composer" onSubmit={onSubmit}>
      <label className="edit-prompt-field">
        <span>编辑指令</span>
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="描述编辑"
          rows={2}
        />
      </label>
      <label className="edit-api-field">
        <span>接口</span>
        <select
          value={apiMode}
          onChange={(event) =>
            onApiModeChange(event.target.value as GenerationApiMode)
          }
        >
          {apiModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="edit-submit-button"
        type="submit"
        disabled={isSubmitting || prompt.trim().length === 0}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="spin" size={18} />
            编辑中
          </>
        ) : (
          <>
            <Send size={18} />
            {hasMask ? "局部重绘" : "整图编辑"}
          </>
        )}
      </button>
    </form>
  );
}

