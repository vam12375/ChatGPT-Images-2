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

import {
  maxEditUploadBytes,
  resolveCompactEditImageSize,
  shouldCompactEditImage
} from "@/lib/image-edit-upload";
import type { GenerationApiMode, ImageOutputFormat } from "@/lib/image-options";

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

type EditableSourceFile = {
  file: File;
  height: number;
  width: number;
};

const editApiModeOptions: Array<{ label: string; value: GenerationApiMode }> = [
  { label: "Images API", value: "images" },
  { label: "Responses API", value: "responses" }
];
const defaultEditApiMode: GenerationApiMode = "images";

const initialMaskState: EditMaskState = {
  canRedo: false,
  canUndo: false,
  hasMask: false
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("源图读取失败，请重新选择图片"));
    };
    image.src = objectUrl;
  });
}

async function encodeCompactImage(canvas: HTMLCanvasElement): Promise<Blob> {
  const candidates: Blob[] = [];

  /*
   * 为了避开中转网关 413，编辑参考图优先压成浏览器支持的轻量格式。
   */
  for (const type of ["image/webp", "image/jpeg"]) {
    for (const quality of [0.86, 0.76, 0.66, 0.56]) {
      const blob = await canvasToBlob(canvas, type, quality);

      if (!blob || blob.size === 0) {
        continue;
      }

      candidates.push(blob);
      if (blob.size <= maxEditUploadBytes) {
        return blob;
      }
    }
  }

  const smallest = candidates.sort((left, right) => left.size - right.size)[0];
  if (!smallest) {
    throw new Error("源图压缩失败，请重新选择图片");
  }

  return smallest;
}

async function createSourceFile(
  target: ImageEditTarget
): Promise<EditableSourceFile> {
  const response = await fetch(target.image.dataUrl);

  if (!response.ok) {
    throw new Error("源图读取失败，请重新选择图片");
  }

  const blob = await response.blob();
  const image = await loadBlobImage(blob);
  const sourceWidth = image.naturalWidth || image.width || 1024;
  const sourceHeight = image.naturalHeight || image.height || 1024;
  const compactSize = resolveCompactEditImageSize(sourceWidth, sourceHeight);
  const mimeType = blob.type || target.image.mimeType || "image/png";
  const extension = mimeType.split("/")[1] || "png";

  if (
    !shouldCompactEditImage(blob.size) &&
    compactSize.width === sourceWidth &&
    compactSize.height === sourceHeight
  ) {
    return {
      file: new File([blob], `source-${target.image.id}.${extension}`, {
        type: mimeType
      }),
      height: sourceHeight,
      width: sourceWidth
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = compactSize.width;
  canvas.height = compactSize.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器不支持图片压缩，请换一张更小的图片再编辑");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compactBlob = await encodeCompactImage(canvas);
  const compactMimeType = compactBlob.type || "image/jpeg";
  const compactExtension = compactMimeType.split("/")[1] || "jpg";

  return {
    file: new File(
      [compactBlob],
      `source-${target.image.id}.${compactExtension}`,
      { type: compactMimeType }
    ),
    height: compactSize.height,
    width: compactSize.width
  };
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
  const [editApiMode, setEditApiMode] =
    useState<GenerationApiMode>(defaultEditApiMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maskState, setMaskState] = useState<EditMaskState>(initialMaskState);

  useEffect(() => {
    setPrompt("");
    setError("");
    setEditApiMode(defaultEditApiMode);
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
      const maskBlob = await stageRef.current?.exportMaskBlob({
        height: sourceFile.height,
        width: sourceFile.width
      });
      const formData = new FormData();

      formData.set("prompt", editPrompt);
      formData.set("size", target.session.size);
      formData.set("quality", "high");
      formData.set("output_format", target.session.outputFormat);
      formData.set("background", "auto");
      formData.set("api_mode", editApiMode);
      formData.set("size_label", target.session.sizeLabel);
      formData.set("size_value", target.session.sizeValue);
      formData.set("quality_label", target.session.qualityLabel || "high");
      formData.set("source_image_id", target.image.id);
      formData.append("image[]", sourceFile.file);

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
        apiMode={editApiMode}
        apiModeOptions={editApiModeOptions}
        hasMask={maskState.hasMask}
        isSubmitting={isSubmitting}
        prompt={prompt}
        onApiModeChange={setEditApiMode}
        onPromptChange={setPrompt}
        onSubmit={handleSubmit}
      />
    </main>
  );
}

