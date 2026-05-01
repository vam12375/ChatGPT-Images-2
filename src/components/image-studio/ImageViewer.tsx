import { Download, Minus, X, ZoomIn, ZoomOut } from "lucide-react";

import type { ViewerImage } from "./types";

type ImageViewerProps = {
  viewerImage: ViewerImage;
  viewerZoom: number;
  onClose: () => void;
  onDownload: () => void;
  onResetZoom: () => void;
  onZoomChange: (delta: number) => void;
};

import { useEffect } from "react";

export function ImageViewer({
  viewerImage,
  viewerZoom,
  onClose,
  onDownload,
  onResetZoom,
  onZoomChange
}: ImageViewerProps) {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // 滚轮向上(负值)放大，向下(正值)缩小
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      onZoomChange(delta);
    };

    // 需要在捕获阶段阻止默认行为，所以使用原生事件监听
    const stage = document.querySelector('.viewer-stage');
    if (stage) {
      stage.addEventListener('wheel', handleWheel as EventListener, { passive: false });
    }

    return () => {
      if (stage) {
        stage.removeEventListener('wheel', handleWheel as EventListener);
      }
    };
  }, [onZoomChange]);

  return (
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
            onClick={() => onZoomChange(-0.25)}
          >
            <ZoomOut size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="重置缩放"
            onClick={onResetZoom}
          >
            <Minus size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="放大图片"
            onClick={() => onZoomChange(0.25)}
          >
            <ZoomIn size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="下载图片"
            onClick={onDownload}
          >
            <Download size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭图片查看器"
            onClick={onClose}
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
  );
}
