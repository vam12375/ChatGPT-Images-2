# GPT-Image-2 图片编辑功能实施计划

> **给 agentic workers：** 必须使用 superpowers:executing-plans 执行本计划。步骤使用 checkbox（`- [ ]`）语法跟踪进度。

**目标：** 在现有图片工作台中新增官网式全屏图片编辑能力，支持文字编辑、画笔局部涂抹生成 mask，并调用 API易 `gpt-image-2` 图片编辑接口。

**架构：** 前端从生成结果卡片进入全屏编辑工作区，编辑工作区负责图片展示、画笔遮罩、提示词提交和结果回填。后端新增 `/api/images/edit` 接收 multipart 请求，校验字段后转发到 API易图片编辑接口，并把上游 base64 响应归一化为现有图片结果结构。

**技术栈：** Next.js 16 App Router、React 19、TypeScript、Node `node:test`、浏览器 Canvas、原生 `FormData` / `fetch`。

---

## 文件结构

- 新建 `src/lib/image-edit-options.ts`：解析与校验图片编辑表单字段、文件数量和格式。
- 新建 `src/lib/image-edit-mask.ts`：纯函数描述 mask 像素规则，供测试和前端导出逻辑复用。
- 新建 `src/lib/image-edit-proxy.ts`：封装 API易 `/v1/images/edits` multipart 转发与响应归一化。
- 新建 `src/app/api/images/edit/route.ts`：图片编辑 API 路由，接入限流、错误格式化、历史记录保存。
- 新建 `src/components/image-studio/ImageEditWorkspace.tsx`：官网式全屏图片编辑页壳层。
- 新建 `src/components/image-studio/EditImageStage.tsx`：图片展示、画笔指针事件、蓝色选择遮罩、mask 导出。
- 新建 `src/components/image-studio/EditComposer.tsx`：底部编辑提示词输入与提交按钮。
- 修改 `src/components/image-studio/ChatPanel.tsx`：结果图卡片增加“编辑”按钮。
- 修改 `src/components/image-studio/types.ts`：补充编辑工作区与历史记录使用的类型。
- 修改 `src/lib/generation-history-types.ts`：历史会话增加 `operation`、`sourceImageId`、`referenceImageCount`、`usedMask`。
- 修改 `src/lib/generation-history-store.ts`：读取旧历史时给缺省字段安全默认值。
- 修改 `src/app/page.tsx`：维护编辑工作区状态、调用编辑 API、把编辑结果写入历史与当前结果区。
- 修改 `src/app/globals.css`：添加编辑按钮、全屏编辑页、画笔遮罩、底部 composer 样式。
- 新建 `test/image-edit-options.test.ts`：TDD 覆盖编辑参数解析。
- 新建 `test/image-edit-proxy.test.ts`：TDD 覆盖 multipart 转发和 base64 响应归一化。
- 新建 `test/image-edit-mask.test.ts`：TDD 覆盖 mask 透明/不透明像素规则。

## Chunk 1：后端编辑参数与 mask 规则

### Task 1：编辑参数解析

**文件：**
- 新建：`test/image-edit-options.test.ts`
- 新建：`src/lib/image-edit-options.ts`

- [ ] **Step 1：写失败测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  parseImageEditFields,
  validateImageEditFiles
} from "../src/lib/image-edit-options.ts";

test("解析图片编辑字段并使用安全默认值", () => {
  const fields = parseImageEditFields({
    prompt: "  把天空改成粉色晚霞  ",
    size: "1536x1024",
    quality: "high",
    output_format: "webp",
    background: "opaque"
  });

  assert.equal(fields.prompt, "把天空改成粉色晚霞");
  assert.equal(fields.size, "1536x1024");
  assert.equal(fields.quality, "high");
  assert.equal(fields.outputFormat, "webp");
  assert.equal(fields.background, "opaque");
});

test("拒绝空编辑提示词", () => {
  assert.throws(() => parseImageEditFields({ prompt: "   " }), /请输入图片编辑指令/);
});

test("校验参考图数量和格式", () => {
  const image = new File(["x"], "photo.png", { type: "image/png" });

  assert.doesNotThrow(() => validateImageEditFiles([image], null));
  assert.throws(() => validateImageEditFiles([], null), /请先选择要编辑的图片/);
  assert.throws(
    () => validateImageEditFiles([new File(["x"], "bad.gif", { type: "image/gif" })], null),
    /仅支持 PNG、JPEG、WebP/
  );
});
```

- [ ] **Step 2：运行测试确认失败**

运行：`npm test test/image-edit-options.test.ts`

预期：失败，提示找不到 `image-edit-options.ts` 或导出函数。

- [ ] **Step 3：实现最小代码**

实现 `parseImageEditFields`、`validateImageEditFiles`，复用现有尺寸、质量、格式白名单，不允许 `transparent` 背景。

- [ ] **Step 4：运行测试确认通过**

运行：`npm test test/image-edit-options.test.ts`

预期：通过。

- [ ] **Step 5：提交**

```bash
git add test/image-edit-options.test.ts src/lib/image-edit-options.ts
git commit -m "feat(api): 新增图片编辑参数校验" -m "为 GPT-Image-2 图片编辑请求增加字段解析、参考图数量和文件格式校验。" -m "Co-Authored-By: OpenAI GPT-5.5 <noreply@openai.com>"
```

### Task 2：mask 像素规则

**文件：**
- 新建：`test/image-edit-mask.test.ts`
- 新建：`src/lib/image-edit-mask.ts`

- [ ] **Step 1：写失败测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { readMaskAlpha } from "../src/lib/image-edit-mask.ts";

test("涂抹区域导出为透明像素，未涂抹区域导出为不透明像素", () => {
  assert.equal(readMaskAlpha(255), 0);
  assert.equal(readMaskAlpha(1), 0);
  assert.equal(readMaskAlpha(0), 255);
});
```

- [ ] **Step 2：运行测试确认失败**

运行：`npm test test/image-edit-mask.test.ts`

预期：失败，提示找不到 `image-edit-mask.ts` 或导出函数。

- [ ] **Step 3：实现最小代码**

实现 `readMaskAlpha(selectionAlpha: number): number`，任何大于 0 的选择 alpha 导出为 0，否则导出为 255。

- [ ] **Step 4：运行测试确认通过**

运行：`npm test test/image-edit-mask.test.ts`

预期：通过。

- [ ] **Step 5：提交**

```bash
git add test/image-edit-mask.test.ts src/lib/image-edit-mask.ts
git commit -m "feat(ui): 定义图片编辑 mask 像素规则" -m "为画笔选择区域提供可测试的透明度转换规则，确保涂抹区域符合 API 局部重绘要求。" -m "Co-Authored-By: OpenAI GPT-5.5 <noreply@openai.com>"
```

## Chunk 2：编辑 API 转发与历史记录

### Task 3：编辑接口代理

**文件：**
- 新建：`test/image-edit-proxy.test.ts`
- 新建：`src/lib/image-edit-proxy.ts`
- 新建：`src/app/api/images/edit/route.ts`

- [ ] **Step 1：写失败测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { createImageEditProxyRequest, normalizeImageEditResponse } from "../src/lib/image-edit-proxy.ts";

test("图片编辑代理请求使用 image[] 和可选 mask 字段", async () => {
  const source = new File(["image"], "source.png", { type: "image/png" });
  const mask = new File(["mask"], "mask.png", { type: "image/png" });
  const request = createImageEditProxyRequest({
    apiKey: "sk-test",
    baseUrl: "https://api.apiyi.com/v1",
    fields: {
      prompt: "替换天空",
      size: "1024x1024",
      quality: "high",
      outputFormat: "png",
      background: "auto"
    },
    images: [source],
    mask
  });

  assert.equal(request.url, "https://api.apiyi.com/v1/images/edits");
  assert.equal(request.init.method, "POST");
  assert.equal((request.init.headers as Record<string, string>).Authorization, "Bearer sk-test");
});

test("图片编辑响应归一化为 data URL", () => {
  const result = normalizeImageEditResponse({
    created: 1,
    data: [{ b64_json: "YWJj" }],
    usage: { total_tokens: 3, input_tokens: 1, output_tokens: 2 }
  }, "png");

  assert.equal(result.images[0].dataUrl, "data:image/png;base64,YWJj");
  assert.equal(result.usage?.total_tokens, 3);
});
```

- [ ] **Step 2：运行测试确认失败**

运行：`npm test test/image-edit-proxy.test.ts`

预期：失败，提示找不到代理模块。

- [ ] **Step 3：实现最小代码**

实现代理构造、响应归一化和路由处理。路由读取 `request.formData()`，调用参数校验，使用 `proxyConfig.getNextApiKey()` 和 `OPENAI_BASE_URL`，默认 base URL 为 `https://api.apiyi.com/v1` 或当前环境变量。

- [ ] **Step 4：运行测试确认通过**

运行：`npm test test/image-edit-proxy.test.ts`

预期：通过。

- [ ] **Step 5：补充历史记录字段**

修改 `StoredGenerationSession` 与历史读取逻辑，给旧数据默认 `operation: "generate"`。

- [ ] **Step 6：运行相关测试**

运行：`npm test test/generation-history-store.test.ts test/image-edit-proxy.test.ts`

预期：通过。

- [ ] **Step 7：提交**

```bash
git add test/image-edit-proxy.test.ts src/lib/image-edit-proxy.ts src/app/api/images/edit/route.ts src/lib/generation-history-types.ts src/lib/generation-history-store.ts
git commit -m "feat(api): 接入 GPT-Image-2 图片编辑接口" -m "新增图片编辑代理路由，支持 multipart 转发、mask 透传、响应归一化和编辑历史元数据。" -m "Co-Authored-By: OpenAI GPT-5.5 <noreply@openai.com>"
```

## Chunk 3：官网式全屏编辑 UI

### Task 4：结果卡片编辑入口

**文件：**
- 修改：`src/components/image-studio/ChatPanel.tsx`
- 修改：`src/app/page.tsx`
- 修改：`src/components/image-studio/types.ts`
- 修改：`src/app/globals.css`

- [ ] **Step 1：写类型驱动测试或最小可验证约束**

本项目目前没有 React 测试环境。先通过 TypeScript 类型检查作为 UI 集成保护，新增 props 时保持 `npm run lint` 可验证。

- [ ] **Step 2：实现编辑入口**

在每张结果图按钮附近增加“编辑”按钮，点击后把当前图片、会话、图片索引传给页面级 `openImageEditor`。

- [ ] **Step 3：运行类型检查**

运行：`npm run lint`

预期：通过。

- [ ] **Step 4：提交**

```bash
git add src/components/image-studio/ChatPanel.tsx src/app/page.tsx src/components/image-studio/types.ts src/app/globals.css
git commit -m "feat(ui): 为生成结果添加图片编辑入口" -m "在图片结果卡片上增加编辑按钮，并接入页面级编辑工作区状态。" -m "Co-Authored-By: OpenAI GPT-5.5 <noreply@openai.com>"
```

### Task 5：全屏编辑工作区与画笔遮罩

**文件：**
- 新建：`src/components/image-studio/ImageEditWorkspace.tsx`
- 新建：`src/components/image-studio/EditImageStage.tsx`
- 新建：`src/components/image-studio/EditComposer.tsx`
- 修改：`src/app/page.tsx`
- 修改：`src/app/globals.css`

- [ ] **Step 1：实现编辑工作区壳层**

添加全屏编辑视图：顶部工具栏、中央图片舞台、底部 composer。返回时恢复原工作台。

- [ ] **Step 2：实现画笔选择**

`EditImageStage` 使用两个 canvas：一个显示蓝色半透明覆盖层，一个内部保存选择 alpha。鼠标或触控拖动时绘制圆形笔刷，支持清除、撤销、重做的最小状态栈。

- [ ] **Step 3：实现 mask 导出**

提交时把选择 canvas 转成与源图自然尺寸一致的 PNG mask。已涂抹区域 alpha 为 0，未涂抹区域 alpha 为 255。

- [ ] **Step 4：接入编辑提交**

`ImageEditWorkspace` 构造 `FormData`，字段包含 `prompt`、`size`、`quality`、`output_format`、`background`、`image[]`，有涂抹区域时追加 `mask`。

- [ ] **Step 5：运行类型检查**

运行：`npm run lint`

预期：通过。

- [ ] **Step 6：提交**

```bash
git add src/components/image-studio/ImageEditWorkspace.tsx src/components/image-studio/EditImageStage.tsx src/components/image-studio/EditComposer.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat(ui): 新增全屏图片编辑工作区" -m "实现官网式图片编辑视图、画笔涂抹遮罩、mask 导出和编辑请求提交。" -m "Co-Authored-By: OpenAI GPT-5.5 <noreply@openai.com>"
```

## Chunk 4：端到端整理与验证

### Task 6：结果回填、下载与文档整理

**文件：**
- 修改：`src/app/page.tsx`
- 修改：`src/components/image-studio/ChatPanel.tsx`
- 修改：`docs/QUICKSTART.md`
- 修改：`README.md`

- [ ] **Step 1：编辑结果回填**

编辑 API 成功后创建 `operation: "edit"` 会话，写入历史、切换为当前结果，并允许继续编辑新图。

- [ ] **Step 2：更新中文文档**

在 README 和 Quickstart 中补充图片编辑入口、mask 涂抹说明、API易环境变量使用方式。

- [ ] **Step 3：运行全量验证**

运行：

```bash
npm test
npm run lint
npm run build
```

预期：全部通过。

- [ ] **Step 4：启动本地服务并手动验证**

运行：`npm run dev`

打开本地页面，验证：

- 结果图显示“编辑”按钮。
- 点击后进入全屏编辑工作区。
- 文字编辑可以提交。
- 画笔涂抹显示蓝色遮罩。
- 清除、撤销、重做可用。
- 编辑结果回到历史和结果区。

- [ ] **Step 5：提交**

```bash
git add src/app/page.tsx src/components/image-studio/ChatPanel.tsx docs/QUICKSTART.md README.md
git commit -m "docs(config): 补充图片编辑使用说明" -m "更新中文使用文档，说明 GPT-Image-2 图片编辑入口、画笔 mask 和环境变量配置。" -m "Co-Authored-By: OpenAI GPT-5.5 <noreply@openai.com>"
```

## 最终检查

- [ ] 重新运行 `npm test`。
- [ ] 重新运行 `npm run lint`。
- [ ] 重新运行 `npm run build`。
- [ ] 检查 `git status --short`，确认只剩预期变更或工作区干净。
- [ ] 汇总提交哈希、验证结果和任何未完成风险。
