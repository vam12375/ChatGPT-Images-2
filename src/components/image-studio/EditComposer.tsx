import { Loader2, Send } from "lucide-react";
import type { FormEvent } from "react";

type EditComposerProps = {
  hasMask: boolean;
  isSubmitting: boolean;
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function EditComposer({
  hasMask,
  isSubmitting,
  prompt,
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

