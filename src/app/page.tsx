"use client";

import {
  AlertCircle,
  ChevronDown,
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
import type { FocusEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatDownloadFilename } from "@/lib/download-filename";
import {
  clampImageViewerZoom,
  createGenerationTitle,
  DEFAULT_IMAGE_VIEWER_ZOOM
} from "@/lib/generation-history";
import type {
  GenerationUsage,
  StoredGeneratedImage,
  StoredGenerationSession
} from "@/lib/generation-history-types";
import type {
  ImageOutputFormat,
  ImageQuality,
  ImageSize
} from "@/lib/image-options";

type GeneratedImage = StoredGeneratedImage;
type Usage = GenerationUsage;

type GenerateResponse = {
  images?: GeneratedImage[];
  model?: string;
  usage?: Usage | null;
  session?: GenerationSession;
  error?: string;
};

type HistoryResponse = {
  sessions?: StoredGenerationSession[];
  error?: string;
};

type GenerationSession = StoredGenerationSession;

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

type SizeOption = {
  value: ImageSize;
  label: string;
  ratio: string;
  dimensions: string;
  previewClass: string;
};

// 按官网样式展示常用画幅比例，底层仍传入符合接口约束的实际像素尺寸。
const sizeOptions: SizeOption[] = [
  {
    value: "1024x1024",
    label: "Square",
    ratio: "1:1",
    dimensions: "1024 x 1024",
    previewClass: "square"
  },
  {
    value: "1536x2048",
    label: "Portrait",
    ratio: "3:4",
    dimensions: "1536 x 2048",
    previewClass: "portrait"
  },
  {
    value: "1152x2048",
    label: "Story",
    ratio: "9:16",
    dimensions: "1152 x 2048",
    previewClass: "story"
  },
  {
    value: "2048x1536",
    label: "Landscape",
    ratio: "4:3",
    dimensions: "2048 x 1536",
    previewClass: "landscape"
  },
  {
    value: "2048x1152",
    label: "Widescreen",
    ratio: "16:9",
    dimensions: "2048 x 1152",
    previewClass: "widescreen"
  }
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

const defaultSize: ImageSize = "1024x1024";
const defaultQuality: ImageQuality = "medium";
const defaultOutputFormat: ImageOutputFormat = "png";
const defaultCount = 1;

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readSelectableSize(value: ImageSize): ImageSize {
  return sizeOptions.some((option) => option.value === value)
    ? value
    : sizeOptions[0].value;
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
  const [size, setSize] = useState<ImageSize>(defaultSize);
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [quality, setQuality] = useState<ImageQuality>(defaultQuality);
  const [outputFormat, setOutputFormat] = useState<ImageOutputFormat>(defaultOutputFormat);
  const [count, setCount] = useState(defaultCount);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [model, setModel] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessions, setSessions] = useState<GenerationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [viewerImage, setViewerImage] = useState<ViewerImage | null>(null);
  const [viewerZoom, setViewerZoom] = useState(DEFAULT_IMAGE_VIEWER_ZOOM);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase("zh-CN");
  const selectedSize = useMemo(
    () => sizeOptions.find((option) => option.value === size) ?? sizeOptions[0],
    [size]
  );
  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionId) ??
      sessions[0] ??
      null,
    [activeSessionId, sessions]
  );
  const filteredSessions = useMemo(() => {
    if (!normalizedSearchQuery) {
      return sessions;
    }

    return sessions.filter((session) =>
      [
        session.title,
        session.prompt,
        session.sizeLabel,
        session.sizeValue,
        session.qualityLabel,
        session.createdAt
      ].some((item) => item.toLocaleLowerCase("zh-CN").includes(normalizedSearchQuery))
    );
  }, [normalizedSearchQuery, sessions]);
  const filteredPlaceholders = useMemo(() => {
    if (!normalizedSearchQuery) {
      return recentPlaceholders;
    }

    return recentPlaceholders.filter((item) =>
      item.toLocaleLowerCase("zh-CN").includes(normalizedSearchQuery)
    );
  }, [normalizedSearchQuery]);
  const visibleSessions = isSearchOpen ? filteredSessions : sessions;
  const visiblePlaceholders = isSearchOpen
    ? filteredPlaceholders
    : recentPlaceholders;
  const sizeDisplayLabel = `${selectedSize.label} ${selectedSize.ratio}`;
  const sizeDisplayValue = `${selectedSize.ratio} · ${selectedSize.dimensions}`;
  const qualityLabel =
    qualityOptions.find((option) => option.value === quality)?.label ?? "平衡";
  const currentModel = activeSession?.model || model || "待生成";
  const currentUsage = activeSession?.usage ?? usage;
  const currentResultPills = activeSession
    ? [activeSession.sizeLabel, activeSession.qualityLabel, `${activeSession.count} 张`]
    : [sizeDisplayLabel, qualityLabel, `${count} 张`];

  const canGenerate = useMemo(
    () =>
      prompt.trim().length > 0 && size.trim().length > 0 && !isGenerating,
    [prompt, size, isGenerating]
  );

  useEffect(() => {
    if (!isSearchOpen || isRailCollapsed) {
      return;
    }

    searchInputRef.current?.focus();
  }, [isRailCollapsed, isSearchOpen]);

  useEffect(() => {
    let isMounted = true;

    async function loadStoredSessions(): Promise<void> {
      try {
        const response = await fetch("/api/generation-history", {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as HistoryResponse;
        const storedSessions = Array.isArray(payload.sessions)
          ? payload.sessions
          : [];
        const latestSession = storedSessions[0];

        if (!isMounted || !latestSession) {
          return;
        }

        setSessions(storedSessions);
        setActiveSessionId(latestSession.id);
        setPrompt(latestSession.prompt);
        setImages(latestSession.images);
        setModel(latestSession.model);
        setUsage(latestSession.usage);
        setOutputFormat(latestSession.outputFormat);
        setCount(latestSession.count);
        setSize(readSelectableSize(latestSession.size));
      } catch {
        // 本地历史加载失败不阻塞生成流程，保持当前默认状态即可。
      }
    }

    void loadStoredSessions();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleSizeOptionChange(value: ImageSize): void {
    setSize(value);
    setIsSizeMenuOpen(false);
  }

  function handleSizePickerBlur(event: FocusEvent<HTMLDivElement>): void {
    const nextFocusedElement = event.relatedTarget;

    if (
      nextFocusedElement instanceof Node &&
      event.currentTarget.contains(nextFocusedElement)
    ) {
      return;
    }

    setIsSizeMenuOpen(false);
  }

  function handleToggleRail(): void {
    const shouldCollapse = !isRailCollapsed;

    setIsRailCollapsed(shouldCollapse);

    if (shouldCollapse) {
      setIsSearchOpen(false);
      setSearchQuery("");
    }
  }

  function handleNewChat(): void {
    setActiveSessionId("");
    setPrompt("");
    setImages([]);
    setModel("");
    setUsage(null);
    setError("");
    setViewerImage(null);
    setViewerZoom(DEFAULT_IMAGE_VIEWER_ZOOM);
    setSize(defaultSize);
    setQuality(defaultQuality);
    setOutputFormat(defaultOutputFormat);
    setCount(defaultCount);
    setIsSizeMenuOpen(false);
    setIsSearchOpen(false);
    setSearchQuery("");
  }

  function handleToggleSearch(): void {
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery("");
      return;
    }

    setIsRailCollapsed(false);
    setIsSearchOpen(true);
  }

  function handleClearSearch(): void {
    setSearchQuery("");
    searchInputRef.current?.focus();
  }

  function handleSelectSession(session: GenerationSession): void {
    setActiveSessionId(session.id);
    setPrompt(session.prompt);
    setImages(session.images);
    setModel(session.model);
    setUsage(session.usage);
    setOutputFormat(session.outputFormat);
    setCount(session.count);
    setSize(readSelectableSize(session.size));
    setIsSearchOpen(false);
    setSearchQuery("");
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
          size,
          quality,
          outputFormat,
          count,
          history: {
            sizeLabel: sizeDisplayLabel,
            sizeValue: sizeDisplayValue,
            qualityLabel
          }
        })
      });
      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok) {
        throw new Error(payload.error || "生成失败");
      }

      const nextImages = payload.images || [];
      const nextModel = payload.model || "";
      const nextUsage = payload.usage || null;
      const nextSession: GenerationSession = payload.session ?? {
        id: createSessionId(),
        title: createGenerationTitle(prompt),
        prompt: prompt.trim(),
        size,
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
      setSessions((currentSessions) => {
        const nextSessions = [nextSession, ...currentSessions].slice(0, 12);
        return nextSessions;
      });
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
    <main className={`workspace-shell${isRailCollapsed ? " is-rail-collapsed" : ""}`}>
      <aside
        className={`history-rail${isRailCollapsed ? " is-collapsed" : ""}`}
        aria-label="最近聊天"
      >
        <div className="rail-topbar">
          <span className="rail-logo" aria-hidden="true">
            <WandSparkles size={18} />
          </span>
          <button
            className="icon-button rail-collapse-button"
            type="button"
            aria-label={isRailCollapsed ? "展开侧栏" : "折叠侧栏"}
            aria-pressed={isRailCollapsed}
            onClick={handleToggleRail}
          >
            <PanelLeft size={18} />
          </button>
        </div>

        <nav className="rail-actions" aria-label="快捷入口">
          <button
            type="button"
            aria-label="新聊天"
            disabled={isGenerating}
            title="新聊天"
            onClick={handleNewChat}
          >
            <MessageSquarePlus size={18} />
            <span>新聊天</span>
          </button>
          <button
            className={isSearchOpen ? "is-active" : ""}
            type="button"
            aria-label={isSearchOpen ? "关闭搜索聊天" : "搜索聊天"}
            aria-expanded={isSearchOpen}
            title="搜索聊天"
            onClick={handleToggleSearch}
          >
            <Search size={18} />
            <span>搜索聊天</span>
          </button>
        </nav>

        {isSearchOpen ? (
          <div className="rail-search" role="search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索标题或提示词"
              aria-label="搜索聊天记录"
            />
            {searchQuery ? (
              <button
                className="search-clear"
                type="button"
                aria-label="清空搜索"
                onClick={handleClearSearch}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="recent-section">
          <p>{isSearchOpen ? "搜索结果" : "最近"}</p>
          <div className="recent-list" aria-live="polite">
            {sessions.length > 0 ? (
              visibleSessions.length > 0 ? (
                visibleSessions.map((session) => (
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
              ) : (
                <div className="recent-empty">没有找到匹配的聊天记录。</div>
              )
            ) : visiblePlaceholders.length > 0 ? (
              visiblePlaceholders.map((item, index) => (
                <button
                  className={!isSearchOpen && index === 0 ? "is-active" : ""}
                  key={item}
                  type="button"
                  onClick={() =>
                    setPrompt(examplePrompts[index % examplePrompts.length].value)
                  }
                >
                  <span>{item}</span>
                </button>
              ))
            ) : (
              <div className="recent-empty">没有找到匹配的聊天记录。</div>
            )}
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
                <div className="aspect-ratio-picker" onBlur={handleSizePickerBlur}>
                  <button
                    className="aspect-ratio-trigger"
                    type="button"
                    aria-expanded={isSizeMenuOpen}
                    aria-haspopup="listbox"
                    onClick={() => setIsSizeMenuOpen((isOpen) => !isOpen)}
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
                          aria-selected={option.value === size}
                          onClick={() => handleSizeOptionChange(option.value)}
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
              当前比例会自动匹配符合接口约束的像素尺寸：{sizeDisplayValue}。
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
