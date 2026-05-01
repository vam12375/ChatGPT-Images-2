# Image Studio UI 重设计规范：极简 / 留白 / 高对比度

## 1. 设计理念 (灵感来自 Awwwards)
- **留白至上 (Whitespace is King)**：使用大量的边距和内边距。元素应该感觉像是在空间中漂浮，而不是被框在盒子里。
- **高对比度 (High Contrast)**：纯白 (`#ffffff`) 背景上的纯黑 (`#000000`)。文本必须具有极高的可读性。
- **排版驱动 (Typography-Driven)**：大而粗的标题。干净的无衬线字体。通过大小和字重来建立层级关系，而不是依赖颜色。
- **弱化边框与阴影 (Subtle Borders & Shadows)**：移除不必要的分割线。使用非常浅的灰色来构建结构 (`#f0f0f0`)，并依赖间距来分隔内容。阴影应该大、柔和且几乎不可见，或者完全放弃阴影以支持扁平化设计。
- **微交互 (Micro-interactions)**：平滑、干脆的过渡效果。悬停状态应该非常明显（例如：悬停时变为黑色背景）。

## 2. 色彩面板
```css
:root {
  --bg: #ffffff;
  --bg-soft: #fafafa;
  --rail: #ffffff;
  --panel: #ffffff;
  --panel-soft: #f5f5f5;
  --text: #000000;
  --text-secondary: #666666;
  --muted: #999999;
  --line: #eaeaea;
  --line-strong: #cccccc;
  --accent: #000000; /* 纯黑用于主要操作 */
  --accent-strong: #333333;
  --accent-foreground: #ffffff;
  --error: #ff3333;
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 24px 60px rgba(0, 0, 0, 0.08);
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-pill: 9999px;
}
```

## 3. 布局更新
- **工作区外壳 (Workspace Shell)**：保持 3 列网格 (`HistoryRail` | `ControlPanel` | `ChatPanel`)，但移除它们之间的硬边框。为 `ControlPanel` 使用微妙的背景色 (`#fafafa`)，以将其与纯白的 `ChatPanel` 和 `HistoryRail` 区分开来。
- **历史侧边栏 (History Rail)**：使其看起来像一个悬浮的停靠栏或非常干净的侧边栏。图标应该锐利且极简。
- **控制面板 (Control Panel)**：
  - 输入框和文本域在聚焦前不应有可见边框，或者使用非常柔和的背景 (`#f5f5f5`)。
  - “生成”按钮应该是一个大而粗的黑色药丸形状或矩形。
- **聊天面板 (Chat Panel)**：
  - 用户提示词：大而粗的排版。
  - 生成的图片：在卡片内边缘到边缘显示，最小化边框。
  - 移除用户消息的“气泡”外观；使其看起来像干净的编辑排版。

## 4. 组件细节
- **按钮 (Buttons)**：
  - 主要按钮：黑色背景，白色文本，药丸形状 (`border-radius: 9999px`)。
  - 次要按钮：透明背景，黑色边框，或者仅在悬停时带有下划线的文本。
- **宽高比选择器 (Aspect Ratio Picker)**：干净的下拉菜单，极简的图标。
- **图片卡片 (Image Cards)**：悬停时有柔和的阴影，干净的圆角 (`16px`)。

## 5. 实施步骤
1. 使用新的颜色变量和基础排版更新 `globals.css`。
2. 重构 `.workspace-shell` 和列布局，移除硬边框并调整背景颜色。
3. 将 `ControlPanel` 表单元素（输入框、选择器、文本域）更新为极简风格。
4. 将 `ChatPanel` 消息气泡更新为编辑风格（无背景，仅为用户提示词提供大文本）。
5. 将 `HistoryRail` 更新为更干净、以图标为中心的外观。
6. 完善动画和悬停状态。
