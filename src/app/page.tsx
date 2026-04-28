"use client";

import {
  AlertCircle,
  Download,
  ImagePlus,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  Minus,
  MoreHorizontal,
  PanelLeft,
  Search,
  Settings2,
  Sparkles,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { formatDownloadFilename } from "@/lib/download-filename";
import {
  clampImageViewerZoom,
  createGenerationTitle,
  DEFAULT_IMAGE_VIEWER_ZOOM
} from "@/lib/generation-history";
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

type GenerationSession = {
  id: string;
  title: string;
  prompt: string;
  size: ImageSize;
  sizeLabel: string;
  sizeValue: string;
  qualityLabel: string;
  outputFormat: ImageOutputFormat;
  count: number;
  images: GeneratedImage[];
  model: string;
  usage: Usage | null;
  createdAt: string;
};

type ViewerImage = {
  image: GeneratedImage;
  index: number;
  title: string;
  outputFormat: ImageOutputFormat;
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

const recentPlaceholders = [
  "New chat",
  "Image Size Inquiry",
  "茶饮海报设计",
  "电商主图方案",
  "社交封面草稿",
  "礼盒宣传图",
  "产品摄影构图"
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

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  const [sessions, setSessions] = useState<GenerationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [viewerImage, setViewerImage] = useState<ViewerImage | null>(null);
  const [viewerZoom, setViewerZoom] = useState(DEFAULT_IMAGE_VIEWER_ZOOM);

  const effectiveSize = useMemo(
    () => (sizeMode === "custom" ? normalizeSizeValue(customSizeInput) : size),
    [customSizeInput, size, sizeMode]
  );
  const selectedSize = useMemo(
    () => sizeOptions.find((option) => option.value === effectiveSize),
    [effectiveSize]
  );
  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionId) ??
      sessions[0] ??
      null,
    [activeSessionId, sessions]
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
  const qualityLabel =
    qualityOptions.find((option) => option.value === quality)?.label ?? "平衡";
  const currentModel = activeSession?.model || model || "待生成";
  const currentUsage = activeSession?.usage ?? usage;
  const currentResultPills = activeSession
    ? [activeSession.sizeLabel, activeSession.qualityLabel, `${activeSession.count} 张`]
    : [sizeDisplayLabel, qualityLabel, `${count} 张`];

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

  function handleSelectSession(session: GenerationSession): void {
    const isPresetSize = sizeOptions.some((option) => option.value === session.size);

    setActiveSessionId(session.id);
    setPrompt(session.prompt);
    setImages(session.images);
    setModel(session.model);
    setUsage(session.usage);
    setOutputFormat(session.outputFormat);
    setCount(session.count);

    if (isPresetSize) {
      setSizeMode("preset");
      setSize(session.size);
      return;
    }

    setSizeMode("custom");
    setCustomSizeInput(session.size);
  }

  function openViewer(
    image: GeneratedImage,
    index: number,
    session: GenerationSession
  ): void {
    setViewerImage({
      image,
      index,
      title: session.title,
      outputFormat: session.outputFormat
    });
    setViewerZoom(DEFAULT_IMAGE_VIEWER_ZOOM);
  }

  function changeViewerZoom(delta: number): void {
    setViewerZoom((currentZoom) => clampImageViewerZoom(currentZoom + delta));
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

      const nextImages = payload.images || [];
      const nextModel = payload.model || "";
      const nextUsage = payload.usage || null;
      const nextSession: GenerationSession = {
        id: createSessionId(),
        title: createGenerationTitle(prompt),
        prompt: prompt.trim(),
        size: effectiveSize,
        sizeLabel: sizeDisplayLabel,
        sizeValue: sizeDisplayValue,
        qualityLabel,
        outputFormat,
        count,
        images: nextImages,
        model: nextModel,
        usage: nextUsage,
        createdAt: new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit"
        })
      };

      setImages(nextImages);
      setModel(nextModel);
      setUsage(nextUsage);
      setActiveSessionId(nextSession.id);
      // 只保留最近 12 条，保持侧边栏轻量且不引入持久化复杂度。
      setSessions((currentSessions) => [nextSession, ...currentSessions].slice(0, 12));
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
      <aside className="history-rail" aria-label="最近聊天">
        <div className="rail-topbar">
          <span className="rail-logo" aria-hidden="true">
            <WandSparkles size={18} />
          </span>
          <button className="icon-button" type="button" aria-label="折叠侧栏">
            <PanelLeft size={18} />
          </button>
        </div>

        <nav className="rail-actions" aria-label="快捷入口">
          <button type="button">
            <MessageSquarePlus size={18} />
            新聊天
          </button>
          <button type="button">
            <Search size={18} />
            搜索聊天
          </button>
        </nav>

        <div className="recent-section">
          <p>最近</p>
          <div className="recent-list">
            {sessions.length > 0
              ? sessions.map((session) => (
                  <button
                    className={session.id === activeSession?.id ? "is-active" : ""}
                    key={session.id}
                    type="button"
                    onClick={() => handleSelectSession(session)}
                  >
                    <span>{session.title}</span>
                    <small>{session.createdAt}</small>
                  </button>
                ))
              : recentPlaceholders.map((item, index) => (
                  <button
                    className={index === 0 ? "is-active" : ""}
                    key={item}
                    type="button"
                    onClick={() => setPrompt(examplePrompts[index % examplePrompts.length].value)}
                  >
                    <span>{item}</span>
                  </button>
                ))}
          </div>
        </div>

        <div className="account-card">
          <span>GL</span>
          <div>
            <strong>green lemon</strong>
            <small>Plus</small>
          </div>
        </div>
      </aside>

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

        <form className="generator-form" onSubmit={handleSubmit}>
          <label className="field prompt-field">
            <span>画面描述</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="描述主体、风格、光线、构图和用途"
              rows={6}
            />
          </label>

          <div className="prompt-chips" aria-label="提示词模板">
            {examplePrompts.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => setPrompt(example.value)}
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
            <p className="field-hint">
              自定义尺寸需满足最大边 ≤ 3840、宽高为 16 的倍数、长宽比 ≤ 3:1、总像素 0.65–8.3MP。
            </p>
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
            <dd>{activeSession?.sizeValue || sizeDisplayValue}</dd>
          </div>
          <div>
            <dt>模型</dt>
            <dd>{currentModel}</dd>
          </div>
        </dl>
      </section>

      <section className="chat-panel" aria-label="图片生成聊天">
        <header className="chat-header">
          <div>
            <h2>ChatGPT Image</h2>
            <span>{currentModel}</span>
          </div>
          <div className="chat-actions">
            <button className="icon-button" type="button" aria-label="更多操作">
              <MoreHorizontal size={19} />
            </button>
          </div>
        </header>

        <div className="chat-scroll">
          {error ? (
            <div className="error-box" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          ) : null}

          {isGenerating ? (
            <article className="chat-turn">
              <div className="user-bubble">{prompt}</div>
              <div className="assistant-message">
                <div className="loading-card">
                  <div className="loading-preview" />
                  <p>正在生成画面</p>
                </div>
              </div>
            </article>
          ) : null}

          {!isGenerating && activeSession ? (
            <article className="chat-turn">
              <div className="user-bubble">{activeSession.prompt}</div>

              <div className="assistant-message">
                <div className="result-pills" aria-label="结果设置">
                  {currentResultPills.map((pill) => (
                    <span key={pill}>{pill}</span>
                  ))}
                </div>

                <div className="generated-gallery">
                  {activeSession.images.map((image, index) => (
                    <figure className="generated-card" key={image.id}>
                      <button
                        className="generated-image-button"
                        type="button"
                        onClick={() => openViewer(image, index, activeSession)}
                      >
                        <img src={image.dataUrl} alt={`生成图片 ${index + 1}`} />
                        <span className="image-hover">
                          <Maximize2 size={18} />
                          查看
                        </span>
                      </button>
                      <figcaption>
                        <span>{activeSession.createdAt}</span>
                        <button
                          type="button"
                          onClick={() =>
                            downloadImage(
                              image.dataUrl,
                              index,
                              activeSession.outputFormat
                            )
                          }
                        >
                          <Download size={15} />
                          下载
                        </button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </article>
          ) : null}

          {!isGenerating && !activeSession ? (
            <div className="empty-chat">
              <span aria-hidden="true">
                <WandSparkles size={24} />
              </span>
              <h2>等待生成</h2>
              <p>新作品将在这里展开。</p>
            </div>
          ) : null}
        </div>

        {currentUsage ? (
          <dl className="usage-list">
            <div>
              <dt>总 tokens</dt>
              <dd>{currentUsage.total_tokens ?? "-"}</dd>
            </div>
            <div>
              <dt>输入 tokens</dt>
              <dd>{currentUsage.input_tokens ?? "-"}</dd>
            </div>
            <div>
              <dt>输出 tokens</dt>
              <dd>{currentUsage.output_tokens ?? "-"}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      {viewerImage ? (
        <div className="image-viewer" role="dialog" aria-modal="true" aria-label="图片查看器">
          <div className="viewer-toolbar">
            <div>
              <strong>{viewerImage.title}</strong>
              <span>{Math.round(viewerZoom * 100)}%</span>
            </div>
            <div className="viewer-actions">
              <button
                className="icon-button"
                type="button"
                aria-label="缩小图片"
                onClick={() => changeViewerZoom(-0.25)}
              >
                <ZoomOut size={18} />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="重置缩放"
                onClick={() => setViewerZoom(DEFAULT_IMAGE_VIEWER_ZOOM)}
              >
                <Minus size={18} />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="放大图片"
                onClick={() => changeViewerZoom(0.25)}
              >
                <ZoomIn size={18} />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="下载图片"
                onClick={() =>
                  downloadImage(
                    viewerImage.image.dataUrl,
                    viewerImage.index,
                    viewerImage.outputFormat
                  )
                }
              >
                <Download size={18} />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="关闭图片查看器"
                onClick={() => setViewerImage(null)}
              >
                <X size={19} />
              </button>
            </div>
          </div>
          <div className="viewer-stage">
            <img
              src={viewerImage.image.dataUrl}
              alt={viewerImage.title}
              style={{ transform: `scale(${viewerZoom})` }}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
