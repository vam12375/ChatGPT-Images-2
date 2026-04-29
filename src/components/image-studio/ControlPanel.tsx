import {
  ChevronDown,
  ImagePlus,
  Loader2,
  Settings2,
  Sparkles,
  WandSparkles
} from "lucide-react";
import type { FocusEvent, FormEvent } from "react";

import type {
  GenerationApiMode,
  ImageOutputFormat
} from "@/lib/image-options";

import type { SizeOption } from "./types";

type PromptExample = {
  label: string;
  value: string;
};

type SelectOption<T extends string> = {
  label: string;
  value: T;
};

type ControlPanelProps = {
  activeSessionSizeValue: string;
  apiMode: GenerationApiMode;
  apiModeOptions: Array<SelectOption<GenerationApiMode>>;
  canGenerate: boolean;
  count: number;
  currentApiModeLabel: string;
  currentModel: string;
  examplePrompts: readonly PromptExample[];
  formatOptions: Array<SelectOption<ImageOutputFormat>>;
  generationHint: string;
  isGenerating: boolean;
  isSizeMenuOpen: boolean;
  outputFormat: ImageOutputFormat;
  prompt: string;
  selectedSize: SizeOption;
  sizeDisplayValue: string;
  sizeOptions: SizeOption[];
  onApiModeChange: (value: GenerationApiMode) => void;
  onCountChange: (value: number) => void;
  onFormatChange: (value: ImageOutputFormat) => void;
  onPromptChange: (value: string) => void;
  onSizeOptionChange: (option: SizeOption) => void;
  onSizePickerBlur: (event: FocusEvent<HTMLDivElement>) => void;
  onSizePickerToggle: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ControlPanel({
  activeSessionSizeValue,
  apiMode,
  apiModeOptions,
  canGenerate,
  count,
  currentApiModeLabel,
  currentModel,
  examplePrompts,
  formatOptions,
  generationHint,
  isGenerating,
  isSizeMenuOpen,
  outputFormat,
  prompt,
  selectedSize,
  sizeDisplayValue,
  sizeOptions,
  onApiModeChange,
  onCountChange,
  onFormatChange,
  onPromptChange,
  onSizeOptionChange,
  onSizePickerBlur,
  onSizePickerToggle,
  onSubmit
}: ControlPanelProps) {
  return (
    <section className="control-panel" aria-label="图片生成控制台">
      <div className="brand-block">
        <span className="brand-mark" aria-hidden="true">
          <WandSparkles size={20} />
        </span>
        <div>
          <p className="eyebrow">OpenAI Image Studio</p>
          <h1>图片生成工作台</h1>
        </div>
      </div>

      <form className="generator-form" onSubmit={onSubmit}>
        <label className="field prompt-field">
          <span>画面描述</span>
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="描述主体、风格、光线、构图和用途"
            rows={6}
          />
        </label>

        <div className="prompt-chips" aria-label="提示词模板">
          {examplePrompts.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => onPromptChange(example.value)}
            >
              <Sparkles size={14} />
              {example.label}
            </button>
          ))}
        </div>

        <fieldset className="control-group">
          <legend>
            <Settings2 size={15} />
            生成参数
          </legend>
          <div className="form-grid">
            <label className="field size-field">
              <span>尺寸</span>
              <div className="aspect-ratio-picker" onBlur={onSizePickerBlur}>
                <button
                  className="aspect-ratio-trigger"
                  type="button"
                  aria-expanded={isSizeMenuOpen}
                  aria-haspopup="listbox"
                  onClick={onSizePickerToggle}
                >
                  <span className="aspect-ratio-trigger-icon" aria-hidden="true" />
                  <span>Aspect ratio</span>
                  <ChevronDown
                    className={isSizeMenuOpen ? "is-open" : ""}
                    size={18}
                    aria-hidden="true"
                  />
                </button>

                {isSizeMenuOpen ? (
                  <div className="aspect-ratio-menu" role="listbox">
                    <p>Generate this image with a different aspect ratio</p>
                    {sizeOptions.map((option) => (
                      <button
                        className="aspect-ratio-option"
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={option.value === selectedSize.value}
                        onClick={() => onSizeOptionChange(option)}
                      >
                        <span
                          className={`ratio-preview ratio-preview-${option.previewClass}`}
                          aria-hidden="true"
                        />
                        <span className="ratio-label">{option.label}</span>
                        <span className="ratio-value">{option.ratio}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>

            <label className="field">
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

            <label className="field">
              <span>格式</span>
              <select
                value={outputFormat}
                onChange={(event) =>
                  onFormatChange(event.target.value as ImageOutputFormat)
                }
              >
                {formatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>数量</span>
              <input
                type="number"
                min="1"
                max="4"
                value={count}
                onChange={(event) => {
                  const nextCount = Number(event.target.value);
                  onCountChange(Number.isInteger(nextCount) ? nextCount : 1);
                }}
              />
            </label>
          </div>
          <p className="field-hint">{generationHint}</p>
        </fieldset>

        <button className="primary-action" type="submit" disabled={!canGenerate}>
          {isGenerating ? (
            <>
              <Loader2 className="spin" size={18} />
              生成中
            </>
          ) : (
            <>
              <ImagePlus size={18} />
              生成图片
            </>
          )}
        </button>
      </form>

      <dl className="sidebar-meta" aria-label="当前设置">
        <div>
          <dt>画幅</dt>
          <dd>{activeSessionSizeValue || sizeDisplayValue}</dd>
        </div>
        <div>
          <dt>接口</dt>
          <dd>{currentApiModeLabel}</dd>
        </div>
        <div>
          <dt>模型</dt>
          <dd>{currentModel}</dd>
        </div>
      </dl>
    </section>
  );
}
