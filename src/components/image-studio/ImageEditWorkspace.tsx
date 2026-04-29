"use client";

import {
  ArrowLeft,
  Download,
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  Trash2
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { ImageOutputFormat } from "@/lib/image-options";

import { EditComposer } from "./EditComposer";
import {
  EditImageStage,
  type EditImageStageHandle,
  type EditMaskState
} from "./EditImageStage";
import type { GenerationSession, ImageEditTarget } from "./types";

type EditResponse = {
  error?: string;
  session?: GenerationSession;
};

type ImageEditWorkspaceProps = {
  target: ImageEditTarget;
  onClose: () => void;
  onDownloadImage: (
    dataUrl: string,
    index: number,
    outputFormat: ImageOutputFormat
  ) => void;
  onEditComplete: (session: GenerationSession) => void;
};

const initialMaskState: EditMaskState = {
  canRedo: false,
  canUndo: false,
  hasMask: false
};

async function createSourceFile(target: ImageEditTarget): Promise<File> {
  const response = await fetch(target.image.dataUrl);

  if (!response.ok) {
    throw new Error("源图读取失败，请重新选择图片");
  }

  const blob = await response.blob();
  const mimeType = blob.type || target.image.mimeType || "image/png";
  const extension = mimeType.split("/")[1] || "png";

  return new File([blob], `source-${target.image.id}.${extension}`, {
    type: mimeType
  });
}

export function ImageEditWorkspace({
  target,
  onClose,
  onDownloadImage,
  onEditComplete
}: ImageEditWorkspaceProps) {
  const stageRef = useRef<EditImageStageHandle | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maskState, setMaskState] = useState<EditMaskState>(initialMaskState);

  useEffect(() => {
    setPrompt("");
    setError("");
    setMaskState(initialMaskState);
  }, [target.image.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const editPrompt = prompt.trim();
    if (!editPrompt) {
      setError("请输入图片编辑指令");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const sourceFile = await createSourceFile(target);
      const maskBlob = await stageRef.current?.exportMaskBlob();
      const formData = new FormData();

      formData.set("prompt", editPrompt);
      formData.set("size", target.session.size);
      formData.set("quality", "high");
      formData.set("output_format", target.session.outputFormat);
      formData.set("background", "auto");
      formData.set("size_label", target.session.sizeLabel);
      formData.set("size_value", target.session.sizeValue);
      formData.set("quality_label", target.session.qualityLabel || "high");
      formData.set("source_image_id", target.image.id);
      formData.append("image[]", sourceFile);

      if (maskBlob) {
        formData.set("mask", new File([maskBlob], "mask.png", { type: "image/png" }));
      }

      const response = await fetch("/api/images/edit", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as EditResponse;

      if (!response.ok || !payload.session) {
        throw new Error(payload.error || "图片编辑失败，请稍后重试");
      }

      onEditComplete(payload.session);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "图片编辑失败，请稍后重试"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="image-edit-workspace">
      <header className="edit-toolbar">
        <button className="icon-button" type="button" aria-label="返回" onClick={onClose}>
          <ArrowLeft size={19} />
        </button>
        <div className="edit-toolbar-title">
          <strong>图片编辑</strong>
          <span>{target.session.sizeLabel} · {target.session.outputFormat.toUpperCase()}</span>
        </div>
        <div className="edit-toolbar-actions">
          <button
            className="icon-button"
            type="button"
            aria-label="撤销涂抹"
            disabled={!maskState.canUndo}
            onClick={() => stageRef.current?.undoMask()}
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="重做涂抹"
            disabled={!maskState.canRedo}
            onClick={() => stageRef.current?.redoMask()}
          >
            <RotateCw size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="清除涂抹"
            disabled={!maskState.hasMask}
            onClick={() => stageRef.current?.clearMask()}
          >
            <Trash2 size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="下载当前图片"
            onClick={() =>
              onDownloadImage(
                target.image.dataUrl,
                target.imageIndex,
                target.session.outputFormat
              )
            }
          >
            <Download size={18} />
          </button>
          <button className="icon-button" type="button" aria-label="更多操作">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>

      <EditImageStage
        ref={stageRef}
        image={target.image}
        title={target.session.title}
        onMaskStateChange={setMaskState}
      />

      {error ? (
        <div className="edit-error" role="alert">
          {error}
        </div>
      ) : null}

      <EditComposer
        hasMask={maskState.hasMask}
        isSubmitting={isSubmitting}
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmit={handleSubmit}
      />
    </main>
  );
}

