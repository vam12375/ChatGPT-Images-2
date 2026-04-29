import {
  AlertCircle,
  Download,
  Maximize2,
  MoreHorizontal,
  Pencil,
  WandSparkles
} from "lucide-react";

import type { GeneratedImage, GenerationSession, Usage } from "./types";

type ChatPanelProps = {
  activeSession: GenerationSession | null;
  currentApiModeLabel: string;
  currentModel: string;
  currentResultPills: string[];
  currentUsage: Usage | null;
  error: string;
  isGenerating: boolean;
  prompt: string;
  onDownloadImage: (
    dataUrl: string,
    index: number,
    outputFormat: GenerationSession["outputFormat"]
  ) => void;
  onEditImage: (
    image: GeneratedImage,
    index: number,
    session: GenerationSession
  ) => void;
  onOpenViewer: (
    image: GeneratedImage,
    index: number,
    session: GenerationSession
  ) => void;
};

export function ChatPanel({
  activeSession,
  currentApiModeLabel,
  currentModel,
  currentResultPills,
  currentUsage,
  error,
  isGenerating,
  prompt,
  onDownloadImage,
  onEditImage,
  onOpenViewer
}: ChatPanelProps) {
  return (
    <section className="chat-panel" aria-label="图片生成聊天">
      <header className="chat-header">
        <div>
          <h2>ChatGPT Image</h2>
          <span>
            {currentApiModeLabel} · {currentModel}
          </span>
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
                      onClick={() => onOpenViewer(image, index, activeSession)}
                    >
                      <img src={image.dataUrl} alt={`生成图片 ${index + 1}`} />
                      <span className="image-hover">
                        <Maximize2 size={18} />
                        查看
                      </span>
                    </button>
                    <figcaption>
                      <span>{activeSession.createdAt}</span>
                      <div className="generated-card-actions">
                        <button
                          type="button"
                          onClick={() => onEditImage(image, index, activeSession)}
                        >
                          <Pencil size={15} />
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onDownloadImage(
                              image.dataUrl,
                              index,
                              activeSession.outputFormat
                            )
                          }
                        >
                          <Download size={15} />
                          下载
                        </button>
                      </div>
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
  );
}
