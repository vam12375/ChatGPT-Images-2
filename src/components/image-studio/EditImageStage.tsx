"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef
} from "react";

import { readMaskAlpha } from "@/lib/image-edit-mask";

import type { GeneratedImage } from "./types";

export type EditMaskState = {
  canRedo: boolean;
  canUndo: boolean;
  hasMask: boolean;
};

export type EditMaskExportOptions = {
  height: number;
  width: number;
};

export type EditImageStageHandle = {
  clearMask: () => void;
  exportMaskBlob: (options?: EditMaskExportOptions) => Promise<Blob | null>;
  redoMask: () => void;
  undoMask: () => void;
};

type EditImageStageProps = {
  image: GeneratedImage;
  title: string;
  onMaskStateChange: (state: EditMaskState) => void;
};

const brushRadius = 30;
const overlayColor = {
  alpha: 90,
  blue: 235,
  green: 114,
  red: 37
};

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("当前浏览器不支持图片编辑画布");
  }

  return context;
}

function hasSelection(canvas: HTMLCanvasElement): boolean {
  const context = getCanvasContext(canvas);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > 0) {
      return true;
    }
  }

  return false;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("mask 图片导出失败"));
    }, "image/png");
  });
}

export const EditImageStage = forwardRef<
  EditImageStageHandle,
  EditImageStageProps
>(function EditImageStage({ image, title, onMaskStateChange }, ref) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const historyRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);

  const emitMaskState = useCallback(() => {
    const selectionCanvas = selectionCanvasRef.current;

    onMaskStateChange({
      canRedo: redoRef.current.length > 0,
      canUndo: historyRef.current.length > 0,
      hasMask: selectionCanvas ? hasSelection(selectionCanvas) : false
    });
  }, [onMaskStateChange]);

  const repaintOverlay = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current;
    const selectionCanvas = selectionCanvasRef.current;

    if (!overlayCanvas || !selectionCanvas) {
      return;
    }

    const overlayContext = getCanvasContext(overlayCanvas);
    const selectionContext = getCanvasContext(selectionCanvas);
    const selectionData = selectionContext.getImageData(
      0,
      0,
      selectionCanvas.width,
      selectionCanvas.height
    );
    const overlayData = overlayContext.createImageData(
      overlayCanvas.width,
      overlayCanvas.height
    );

    for (let index = 0; index < selectionData.data.length; index += 4) {
      if (selectionData.data[index + 3] === 0) {
        continue;
      }

      overlayData.data[index] = overlayColor.red;
      overlayData.data[index + 1] = overlayColor.green;
      overlayData.data[index + 2] = overlayColor.blue;
      overlayData.data[index + 3] = overlayColor.alpha;
    }

    overlayContext.putImageData(overlayData, 0, 0);
  }, []);

  const pushHistory = useCallback(() => {
    const selectionCanvas = selectionCanvasRef.current;

    if (!selectionCanvas) {
      return;
    }

    const context = getCanvasContext(selectionCanvas);
    historyRef.current.push(
      context.getImageData(0, 0, selectionCanvas.width, selectionCanvas.height)
    );
    redoRef.current = [];
  }, []);

  const restoreSelection = useCallback(
    (imageData: ImageData) => {
      const selectionCanvas = selectionCanvasRef.current;

      if (!selectionCanvas) {
        return;
      }

      const context = getCanvasContext(selectionCanvas);
      context.putImageData(imageData, 0, 0);
      repaintOverlay();
      emitMaskState();
    },
    [emitMaskState, repaintOverlay]
  );

  const drawAtPoint = useCallback((clientX: number, clientY: number) => {
    const overlayCanvas = overlayCanvasRef.current;
    const selectionCanvas = selectionCanvasRef.current;

    if (!overlayCanvas || !selectionCanvas) {
      return;
    }

    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const selectionContext = getCanvasContext(selectionCanvas);
    const overlayContext = getCanvasContext(overlayCanvas);

    selectionContext.fillStyle = "rgba(0, 0, 0, 1)";
    selectionContext.beginPath();
    selectionContext.arc(x, y, brushRadius, 0, Math.PI * 2);
    selectionContext.fill();

    overlayContext.fillStyle = `rgba(${overlayColor.red}, ${overlayColor.green}, ${overlayColor.blue}, 0.35)`;
    overlayContext.beginPath();
    overlayContext.arc(x, y, brushRadius, 0, Math.PI * 2);
    overlayContext.fill();
  }, []);

  function handleImageLoad(): void {
    const loadedImage = imageRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const selectionCanvas = selectionCanvasRef.current;

    if (!loadedImage || !overlayCanvas || !selectionCanvas) {
      return;
    }

    const width = loadedImage.naturalWidth || 1024;
    const height = loadedImage.naturalHeight || 1024;

    for (const canvas of [overlayCanvas, selectionCanvas]) {
      canvas.width = width;
      canvas.height = height;
      getCanvasContext(canvas).clearRect(0, 0, width, height);
    }

    historyRef.current = [];
    redoRef.current = [];
    emitMaskState();
  }

  useImperativeHandle(
    ref,
    () => ({
      clearMask() {
        const overlayCanvas = overlayCanvasRef.current;
        const selectionCanvas = selectionCanvasRef.current;

        if (!overlayCanvas || !selectionCanvas || !hasSelection(selectionCanvas)) {
          return;
        }

        pushHistory();
        getCanvasContext(selectionCanvas).clearRect(
          0,
          0,
          selectionCanvas.width,
          selectionCanvas.height
        );
        getCanvasContext(overlayCanvas).clearRect(
          0,
          0,
          overlayCanvas.width,
          overlayCanvas.height
        );
        emitMaskState();
      },
      async exportMaskBlob(options) {
        const selectionCanvas = selectionCanvasRef.current;

        if (!selectionCanvas || !hasSelection(selectionCanvas)) {
          return null;
        }

        const targetWidth = options?.width ?? selectionCanvas.width;
        const targetHeight = options?.height ?? selectionCanvas.height;
        const sourceCanvas =
          targetWidth === selectionCanvas.width &&
          targetHeight === selectionCanvas.height
            ? selectionCanvas
            : document.createElement("canvas");

        if (sourceCanvas !== selectionCanvas) {
          sourceCanvas.width = targetWidth;
          sourceCanvas.height = targetHeight;
          getCanvasContext(sourceCanvas).drawImage(
            selectionCanvas,
            0,
            0,
            targetWidth,
            targetHeight
          );
        }

        const selectionContext = getCanvasContext(sourceCanvas);
        const selectionData = selectionContext.getImageData(
          0,
          0,
          sourceCanvas.width,
          sourceCanvas.height
        );
        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = sourceCanvas.width;
        maskCanvas.height = sourceCanvas.height;

        const maskContext = getCanvasContext(maskCanvas);
        const maskData = maskContext.createImageData(
          maskCanvas.width,
          maskCanvas.height
        );

        for (let index = 0; index < selectionData.data.length; index += 4) {
          maskData.data[index] = 0;
          maskData.data[index + 1] = 0;
          maskData.data[index + 2] = 0;
          maskData.data[index + 3] = readMaskAlpha(selectionData.data[index + 3]);
        }

        maskContext.putImageData(maskData, 0, 0);
        return canvasToBlob(maskCanvas);
      },
      redoMask() {
        const selectionCanvas = selectionCanvasRef.current;
        const redoImage = redoRef.current.pop();

        if (!selectionCanvas || !redoImage) {
          return;
        }

        historyRef.current.push(
          getCanvasContext(selectionCanvas).getImageData(
            0,
            0,
            selectionCanvas.width,
            selectionCanvas.height
          )
        );
        restoreSelection(redoImage);
      },
      undoMask() {
        const selectionCanvas = selectionCanvasRef.current;
        const previousImage = historyRef.current.pop();

        if (!selectionCanvas || !previousImage) {
          return;
        }

        redoRef.current.push(
          getCanvasContext(selectionCanvas).getImageData(
            0,
            0,
            selectionCanvas.width,
            selectionCanvas.height
          )
        );
        restoreSelection(previousImage);
      }
    }),
    [emitMaskState, pushHistory, restoreSelection]
  );

  return (
    <div className="edit-stage" aria-label="图片编辑画布">
      <div className="edit-image-frame">
        <img
          ref={imageRef}
          src={image.dataUrl}
          alt={title}
          draggable={false}
          onLoad={handleImageLoad}
        />
        <canvas
          ref={overlayCanvasRef}
          className="edit-overlay-canvas"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            pushHistory();
            isDrawingRef.current = true;
            drawAtPoint(event.clientX, event.clientY);
            emitMaskState();
          }}
          onPointerMove={(event) => {
            if (!isDrawingRef.current) {
              return;
            }

            drawAtPoint(event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            isDrawingRef.current = false;
            emitMaskState();
          }}
          onPointerCancel={() => {
            isDrawingRef.current = false;
            emitMaskState();
          }}
        />
        <canvas ref={selectionCanvasRef} hidden aria-hidden="true" />
      </div>
      <p className="edit-stage-hint">拖动画笔涂抹要重绘的区域；不涂抹时会提交整图编辑。</p>
    </div>
  );
});

