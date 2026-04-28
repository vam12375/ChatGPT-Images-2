"use client";

import { useMemo, useState } from "react";

const examplePrompts = [
  "一张高级茶饮品牌海报，白瓷杯，柔和自然光，干净背景，适合电商首图",
  "未来感图片生成控制台 UI 截图，深浅混合界面，专业产品摄影风格",
  "一张适合社交媒体封面的茶叶礼盒照片，留出顶部文字空间，真实摄影"
];

const sizeOptions = [
  { value: "1024x1024", label: "方形 1:1 (1024x1024)" },
  { value: "1024x1536", label: "竖版 3:4 (1024x1536)" },
  { value: "1024x1792", label: "故事版 9:16 (1024x1792)" },
  { value: "1536x1024", label: "横版 4:3 (1536x1024)" },
  { value: "1792x1024", label: "宽屏 16:9 (1792x1024)" }
];

const qualityOptions = [
  { value: "low", label: "低质量，省成本" },
  { value: "medium", label: "中等，推荐" },
  { value: "high", label: "高质量，细节更好" }
];

const formatOptions = [
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "jpeg", label: "JPEG" }
];

function downloadImage(dataUrl, index) {
  const link = document.createElement("a");
  link.href = dataUrl;
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const suffix = index > 0 ? `_${index + 1}` : '';
  link.download = `ChatGPT Image ${year}年${month}月${date}日 ${hours}_${minutes}_${seconds}${suffix}.png`;
  
  link.click();
}

export default function HomePage() {
  const [prompt, setPrompt] = useState(examplePrompts[0]);
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("medium");
  const [outputFormat, setOutputFormat] = useState("png");
  const [count, setCount] = useState(1);
  const [images, setImages] = useState([]);
  const [model, setModel] = useState("");
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const canGenerate = useMemo(
    () => prompt.trim().length > 0 && !isGenerating,
    [prompt, isGenerating]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size, quality, outputFormat, count })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "生成失败");
      }

      setImages(payload.images || []);
      setModel(payload.model || "");
      setUsage(payload.usage || null);
    } catch (generationError) {
      setError(generationError.message || "生成失败，请稍后重试");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="control-panel" aria-label="图片生成控制台">
        <div className="panel-heading">
          <p className="eyebrow">OpenAI Image API</p>
          <h1>图片生成工作台</h1>
          <p className="panel-copy">
            输入画面描述，后端会安全调用 OpenAI API 并返回可预览的图片。
          </p>
        </div>

        <form className="generator-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>图片描述</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="描述你想生成的图片..."
              rows={8}
            />
          </label>

          <div className="prompt-chips" aria-label="示例提示词">
            {examplePrompts.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
              >
                套用示例
              </button>
            ))}
          </div>

          <div className="form-grid">
            <label className="field">
              <span>尺寸</span>
              <select value={size} onChange={(event) => setSize(event.target.value)}>
                {sizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>质量</span>
              <select
                value={quality}
                onChange={(event) => setQuality(event.target.value)}
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
                onChange={(event) => setOutputFormat(event.target.value)}
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
                onChange={(event) => setCount(event.target.value)}
              />
            </label>
          </div>

          <button className="primary-action" type="submit" disabled={!canGenerate}>
            {isGenerating ? "生成中..." : "生成图片"}
          </button>
        </form>
      </section>

      <section className="preview-panel" aria-label="图片预览">
        <div className="preview-header">
          <div>
            <p className="eyebrow">Result</p>
            <h2>生成结果</h2>
          </div>
          {model ? <span className="model-pill">{model}</span> : null}
        </div>

        {error ? <p className="error-box">{error}</p> : null}

        {isGenerating ? (
          <div className="loading-state">
            <div className="loading-frame" />
            <p>正在请求后端生成图片，复杂画面可能需要更久。</p>
          </div>
        ) : null}

        {!isGenerating && images.length === 0 ? (
          <div className="empty-state">
            <div className="empty-preview">
              <span>预览区</span>
            </div>
            <p>生成后的图片会显示在这里，可直接下载。</p>
          </div>
        ) : null}

        {images.length > 0 ? (
          <div className="image-grid">
            {images.map((image, index) => (
              <article className="image-card" key={image.id}>
                <img src={image.dataUrl} alt={`生成图片 ${index + 1}`} />
                <button type="button" onClick={() => downloadImage(image.dataUrl, index)}>
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
