"use client";

import {
  AlertCircle,
  Download,
  ImagePlus,
  Loader2,
  Settings2,
  Sparkles,
  WandSparkles
} from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { formatDownloadFilename } from "@/lib/download-filename";
import type {
  ImageOutputFormat,
  ImageQuality,
  ImageSize
} from "@/lib/image-options";

type GeneratedImage = {
  id: string;
  dataUrl: string;
};

type Usage = {
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
};

type GenerateResponse = {
  images?: GeneratedImage[];
  model?: string;
  usage?: Usage | null;
  error?: string;
};

const examplePrompts = [
  {
    label: "茶饮海报",
    value: "高级茶饮品牌海报，白瓷杯、柔和自然光、干净背景，适合电商首图"
  },
  {
    label: "产品界面",
    value: "未来感图片生成控制台 UI，深浅混合界面，专业产品摄影风格"
  },
  {
    label: "礼盒封面",
    value: "茶叶礼盒社交媒体封面，顶部留出标题空间，真实摄影质感"
  }
] as const;

const sizeOptions: Array<{ value: ImageSize; label: string; ratio: string }> = [
  { value: "1024x1024", label: "方形 1:1", ratio: "1024 x 1024" },
  { value: "1536x1024", label: "横版 3:2", ratio: "1536 x 1024" },
  { value: "1024x1536", label: "竖版 2:3", ratio: "1024 x 1536" },
  { value: "2048x2048", label: "方形 2K", ratio: "2048 x 2048" },
  { value: "2048x1152", label: "横版 2K", ratio: "2048 x 1152" },
  { value: "3840x2160", label: "横版 4K", ratio: "3840 x 2160" },
  { value: "2160x3840", label: "竖版 4K", ratio: "2160 x 3840" }
];

const qualityOptions: Array<{ value: ImageQuality; label: string }> = [
  { value: "low", label: "低成本" },
  { value: "medium", label: "平衡" },
  { value: "high", label: "高质量" }
];

const formatOptions: Array<{ value: ImageOutputFormat; label: string }> = [
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "jpeg", label: "JPEG" }
];

const customSizeOptionValue = "__custom__";

function normalizeSizeValue(value: string): ImageSize {
  return value.trim().toLowerCase().replace(/\s+/g, "") as ImageSize;
}

function formatSizeText(value: string): string {
  return value.includes("x") ? value.replace("x", " × ") : value || "-";
}

function downloadImage(
  dataUrl: string,
  index: number,
  outputFormat: ImageOutputFormat
): void {
  const link = document.createElement("a");

  link.href = dataUrl;
  link.download = formatDownloadFilename(new Date(), index, outputFormat);
  link.click();
}

export default function HomePage() {
  const [prompt, setPrompt] = useState<string>(examplePrompts[0].value);
  const [size, setSize] = useState<ImageSize>("1024x1024");
  const [sizeMode, setSizeMode] = useState<"preset" | "custom">("preset");
  const [customSizeInput, setCustomSizeInput] = useState("");
  const [quality, setQuality] = useState<ImageQuality>("medium");
  const [outputFormat, setOutputFormat] = useState<ImageOutputFormat>("png");
  const [count, setCount] = useState(1);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [model, setModel] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const effectiveSize = useMemo(
    () => (sizeMode === "custom" ? normalizeSizeValue(customSizeInput) : size),
    [customSizeInput, size, sizeMode]
  );
  const selectedSize = useMemo(
    () => sizeOptions.find((option) => option.value === effectiveSize),
    [effectiveSize]
  );
  const sizeSelectValue = sizeMode === "custom" ? customSizeOptionValue : size;
  const sizeDisplayLabel = selectedSize
    ? selectedSize.label
    : effectiveSize
      ? `自定义 ${effectiveSize}`
      : "自定义尺寸";
  const sizeDisplayValue = selectedSize
    ? selectedSize.ratio
    : formatSizeText(effectiveSize);

  const canGenerate = useMemo(
    () =>
      prompt.trim().length > 0 && effectiveSize.trim().length > 0 && !isGenerating,
    [effectiveSize, prompt, isGenerating]
  );

  function handleSizeOptionChange(value: string): void {
    if (value === customSizeOptionValue) {
      setSizeMode("custom");
      setCustomSizeInput((current) => current || size);
      return;
    }

    setSizeMode("preset");
    setSize(value as ImageSize);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          size: effectiveSize,
          quality,
          outputFormat,
          count
        })
      });
      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok) {
        throw new Error(payload.error || "生成失败");
      }

      setImages(payload.images || []);
      setModel(payload.model || "");
      setUsage(payload.usage || null);
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : "生成失败，请稍后重试";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="workspace-shell">
      <section className="sidebar-panel" aria-label="图片生成控制台">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <WandSparkles size={22} />
          </span>
          <div>
            <p className="eyebrow">OpenAI Image Studio</p>
            <h1>图片生成工作台</h1>
          </div>
        </div>

        <form className="generator-form" onSubmit={handleSubmit}>
          <label className="field prompt-field">
            <span>画面描述</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="描述主体、风格、光线、构图和用途"
              rows={8}
            />
          </label>

          <div className="prompt-chips" aria-label="提示词模板">
            {examplePrompts.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => setPrompt(example.value)}
              >
                <Sparkles size={15} />
                {example.label}
              </button>
            ))}
          </div>

          <fieldset className="control-group">
            <legend>
              <Settings2 size={16} />
              生成参数
            </legend>
            <div className="form-grid">
              <label className="field">
                <span>尺寸</span>
                <select
                  value={sizeSelectValue}
                  onChange={(event) => handleSizeOptionChange(event.target.value)}
                >
                  {sizeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} · {option.ratio}
                    </option>
                  ))}
                  <option value={customSizeOptionValue}>自定义尺寸</option>
                </select>
                {sizeMode === "custom" ? (
                  <input
                    type="text"
                    value={customSizeInput}
                    onChange={(event) => setCustomSizeInput(event.target.value)}
                    placeholder="例如 2304x1296"
                  />
                ) : null}
                <small className="field-hint">
                  预设尺寸请用下拉选择；如需任意合法尺寸，请切换为“自定义尺寸”后输入，例如 2048x1152。需满足最大边 ≤ 3840、宽高为 16 的倍数、长宽比 ≤ 3:1、总像素 0.65–8.3MP。
                </small>
              </label>

              <label className="field">
                <span>质量</span>
                <select
                  value={quality}
                  onChange={(event) =>
                    setQuality(event.target.value as ImageQuality)
                  }
                >
                  {qualityOptions.map((option) => (
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
                    setOutputFormat(event.target.value as ImageOutputFormat)
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
                    setCount(Number.isInteger(nextCount) ? nextCount : 1);
                  }}
                />
              </label>
            </div>
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
            <dd>{sizeDisplayValue}</dd>
          </div>
          <div>
            <dt>模型</dt>
            <dd>{model || "待生成"}</dd>
          </div>
        </dl>
      </section>

      <section className="canvas-panel" aria-label="图片预览">
        <header className="result-toolbar">
          <div>
            <p className="eyebrow">Result</p>
            <h2>生成结果</h2>
          </div>
          <div className="result-pills" aria-label="结果设置">
            <span>{sizeDisplayLabel}</span>
            <span>{qualityOptions.find((option) => option.value === quality)?.label}</span>
            <span>{count} 张</span>
          </div>
        </header>

        {error ? (
          <div className="error-box" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {isGenerating ? (
          <div className="loading-state">
            <div className="preview-canvas is-loading" />
            <p>正在生成画面</p>
          </div>
        ) : null}

        {!isGenerating && images.length === 0 ? (
          <div className="empty-state">
            <div className="preview-canvas">
              <div className="canvas-grid">
                <span />
                <span />
                <span />
                <span />
              </div>
              <strong>等待生成</strong>
            </div>
          </div>
        ) : null}

        {images.length > 0 ? (
          <div className="image-grid">
            {images.map((image, index) => (
              <article className="image-card" key={image.id}>
                <img src={image.dataUrl} alt={`生成图片 ${index + 1}`} />
                <button
                  type="button"
                  onClick={() => downloadImage(image.dataUrl, index, outputFormat)}
                >
                  <Download size={16} />
                  下载
                </button>
              </article>
            ))}
          </div>
        ) : null}

        {usage ? (
          <dl className="usage-list">
            <div>
              <dt>总 tokens</dt>
              <dd>{usage.total_tokens ?? "-"}</dd>
            </div>
            <div>
              <dt>输入 tokens</dt>
              <dd>{usage.input_tokens ?? "-"}</dd>
            </div>
            <div>
              <dt>输出 tokens</dt>
              <dd>{usage.output_tokens ?? "-"}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </main>
  );
}
