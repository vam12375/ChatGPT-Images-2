import "./globals.css";

export const metadata = {
  title: "OpenAI 图片生成工作台",
  description: "基于 OpenAI Image API 的可视化图片生成前端"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
