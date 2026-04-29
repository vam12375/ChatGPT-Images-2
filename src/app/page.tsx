"use client";

import type { FocusEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChatPanel } from "@/components/image-studio/ChatPanel";
import { ControlPanel } from "@/components/image-studio/ControlPanel";
import { HistoryRail } from "@/components/image-studio/HistoryRail";
import { ImageViewer } from "@/components/image-studio/ImageViewer";
import type {
  GeneratedImage,
  GenerationSession,
  SizeOption,
  Usage,
  ViewerImage
} from "@/components/image-studio/types";
import {
  appendAspectRatioInstruction,
  type ImageAspectRatio
} from "@/lib/aspect-ratio-prompt";
import { formatDownloadFilename } from "@/lib/download-filename";
import {
  clampImageViewerZoom,
  createGenerationTitle,
  DEFAULT_IMAGE_VIEWER_ZOOM
} from "@/lib/generation-history";
import type { StoredGenerationSession } from "@/lib/generation-history-types";
import type {
  GenerationApiMode,
  ImageOutputFormat,
  ImageSize
} from "@/lib/image-options";

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

// 按官网样式展示常用画幅比例，比例意图通过提示词传递，底层仍使用稳定尺寸。
const sizeOptions: SizeOption[] = [
  {
    value: "1:1",
    apiSize: "1024x1024",
    label: "Square",
    ratio: "1:1",
    dimensions: "1024 x 1024",
    previewClass: "square"
  },
  {
    value: "3:4",
    apiSize: "1024x1536",
    label: "Portrait",
    ratio: "3:4",
    dimensions: "1024 x 1536",
    previewClass: "portrait"
  },
  {
    value: "9:16",
    apiSize: "1024x1536",
    label: "Story",
    ratio: "9:16",
    dimensions: "1024 x 1536",
    previewClass: "story"
  },
  {
    value: "4:3",
    apiSize: "1536x1024",
    label: "Landscape",
    ratio: "4:3",
    dimensions: "1536 x 1024",
    previewClass: "landscape"
  },
  {
    value: "16:9",
    apiSize: "1536x1024",
    label: "Widescreen",
    ratio: "16:9",
    dimensions: "1536 x 1024",
    previewClass: "widescreen"
  }
];

const formatOptions: Array<{ value: ImageOutputFormat; label: string }> = [
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "jpeg", label: "JPEG" }
];

const apiModeOptions: Array<{ value: GenerationApiMode; label: string }> = [
  { value: "images", label: "Images API" },
  { value: "responses", label: "Responses API" }
];

const defaultAspectRatio: ImageAspectRatio = "1:1";
const fixedQuality = "high" as const;
const fixedQualityLabel = "高质量";
const defaultApiMode: GenerationApiMode = "images";
const defaultOutputFormat: ImageOutputFormat = "png";
const defaultCount = 1;

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readAspectRatioFromText(value: string): ImageAspectRatio | null {
  const match = value.match(/\b(1:1|3:4|9:16|4:3|16:9)\b/);
  return match ? (match[1] as ImageAspectRatio) : null;
}

function readSelectableAspectRatio(
  session: Pick<GenerationSession, "size" | "sizeLabel" | "sizeValue">
): ImageAspectRatio {
  const storedRatio =
    readAspectRatioFromText(session.sizeLabel) ??
    readAspectRatioFromText(session.sizeValue);

  if (storedRatio) {
    return storedRatio;
  }

  return (
    sizeOptions.find((option) => option.apiSize === session.size)?.ratio ??
    defaultAspectRatio
  );
}

function readApiModeLabel(value: GenerationApiMode): string {
  return apiModeOptions.find((option) => option.value === value)?.label ?? "Images API";
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
  const [aspectRatio, setAspectRatio] =
    useState<ImageAspectRatio>(defaultAspectRatio);
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [apiMode, setApiMode] = useState<GenerationApiMode>(defaultApiMode);
  const [outputFormat, setOutputFormat] =
    useState<ImageOutputFormat>(defaultOutputFormat);
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
    () =>
      sizeOptions.find((option) => option.ratio === aspectRatio) ??
      sizeOptions[0],
    [aspectRatio]
  );
  const size: ImageSize = selectedSize.apiSize;
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
        session.model,
        readApiModeLabel(session.apiMode),
        session.createdAt
      ].some((item) =>
        item.toLocaleLowerCase("zh-CN").includes(normalizedSearchQuery)
      )
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
  const qualityLabel = fixedQualityLabel;
  const currentApiMode = activeSession?.apiMode ?? apiMode;
  const currentApiModeLabel = readApiModeLabel(currentApiMode);
  const currentModel = activeSession?.model || model || "待生成";
  const currentUsage = activeSession?.usage ?? usage;
  const generationHint = `会追加：Make the aspect ratio ${selectedSize.ratio}；提交尺寸：${selectedSize.dimensions}。`;
  const currentResultPills = activeSession
    ? [
        readApiModeLabel(activeSession.apiMode),
        activeSession.sizeLabel,
        activeSession.qualityLabel,
        `${activeSession.count} 张`
      ]
    : [currentApiModeLabel, sizeDisplayLabel, qualityLabel, `${count} 张`];

  const canGenerate = useMemo(
    () => prompt.trim().length > 0 && !isGenerating,
    [prompt, isGenerating]
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
        setApiMode(latestSession.apiMode);
        setOutputFormat(latestSession.outputFormat);
        setCount(latestSession.count);
        setAspectRatio(readSelectableAspectRatio(latestSession));
      } catch {
        // 本地历史加载失败不阻塞生成流程，保持当前默认状态即可。
      }
    }

    void loadStoredSessions();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleSizeOptionChange(option: SizeOption): void {
    setAspectRatio(option.ratio);
    setPrompt((currentPrompt) =>
      appendAspectRatioInstruction(currentPrompt, option.ratio)
    );
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
    setAspectRatio(defaultAspectRatio);
    setApiMode(defaultApiMode);
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
    setApiMode(session.apiMode);
    setOutputFormat(session.outputFormat);
    setCount(session.count);
    setAspectRatio(readSelectableAspectRatio(session));
    setIsSearchOpen(false);
    setSearchQuery("");
  }

  function handlePlaceholderSelect(index: number): void {
    setPrompt(examplePrompts[index % examplePrompts.length].value);
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
          quality: fixedQuality,
          apiMode,
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
        apiMode,
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
    <main className={`workspace-shell${isRailCollapsed ? " is-rail-collapsed" : ""}`}>
      <HistoryRail
        activeSession={activeSession}
        isGenerating={isGenerating}
        isRailCollapsed={isRailCollapsed}
        isSearchOpen={isSearchOpen}
        recentPlaceholders={recentPlaceholders}
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        sessions={sessions}
        visiblePlaceholders={visiblePlaceholders}
        visibleSessions={visibleSessions}
        onClearSearch={handleClearSearch}
        onNewChat={handleNewChat}
        onPlaceholderSelect={handlePlaceholderSelect}
        onSearchQueryChange={setSearchQuery}
        onSelectSession={handleSelectSession}
        onToggleRail={handleToggleRail}
        onToggleSearch={handleToggleSearch}
      />

      <ControlPanel
        activeSessionSizeValue={activeSession?.sizeValue || ""}
        apiMode={apiMode}
        apiModeOptions={apiModeOptions}
        canGenerate={canGenerate}
        count={count}
        currentApiModeLabel={currentApiModeLabel}
        currentModel={currentModel}
        examplePrompts={examplePrompts}
        formatOptions={formatOptions}
        generationHint={generationHint}
        isGenerating={isGenerating}
        isSizeMenuOpen={isSizeMenuOpen}
        outputFormat={outputFormat}
        prompt={prompt}
        selectedSize={selectedSize}
        sizeDisplayValue={sizeDisplayValue}
        sizeOptions={sizeOptions}
        onApiModeChange={setApiMode}
        onCountChange={setCount}
        onFormatChange={setOutputFormat}
        onPromptChange={setPrompt}
        onSizeOptionChange={handleSizeOptionChange}
        onSizePickerBlur={handleSizePickerBlur}
        onSizePickerToggle={() => setIsSizeMenuOpen((isOpen) => !isOpen)}
        onSubmit={handleSubmit}
      />

      <ChatPanel
        activeSession={activeSession}
        currentApiModeLabel={currentApiModeLabel}
        currentModel={currentModel}
        currentResultPills={currentResultPills}
        currentUsage={currentUsage}
        error={error}
        isGenerating={isGenerating}
        prompt={prompt}
        onDownloadImage={downloadImage}
        onOpenViewer={openViewer}
      />

      {viewerImage ? (
        <ImageViewer
          viewerImage={viewerImage}
          viewerZoom={viewerZoom}
          onClose={() => setViewerImage(null)}
          onDownload={() =>
            downloadImage(
              viewerImage.image.dataUrl,
              viewerImage.index,
              viewerImage.outputFormat
            )
          }
          onResetZoom={() => setViewerZoom(DEFAULT_IMAGE_VIEWER_ZOOM)}
          onZoomChange={changeViewerZoom}
        />
      ) : null}
    </main>
  );
}
