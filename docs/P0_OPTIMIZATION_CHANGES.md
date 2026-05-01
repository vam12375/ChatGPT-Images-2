# P0/P1 优化修改清单

日期：2026-05-01

## 范围说明

本次修改先处理 P0 级别问题：部署可用性、监控接口安全、配置示例可信度、文档与验证脚本漂移、Git 元数据卫生。

随后追加了低风险 P1 子集：生成图预览完整展示、代理请求日志语义增强、远程图片 URL 白名单落盘。

本次未处理前端状态拆分、React 组件测试等 P2 优化项。远程 URL 图片落盘已按白名单安全方案实现，仍然拒绝任意 URL 拉取。

## 修改概览

| 类别 | 修改内容 | 目标 |
| --- | --- | --- |
| 部署配置 | 新增生产启动脚本 `npm run start` | 让 Docker/生产部署示例可直接运行 |
| 运行时约束 | 新增 Node 版本约束 `>=22.14.0` | 与当前项目测试命令、依赖和本地运行环境对齐 |
| 监控安全 | 拒绝默认占位 `PROXY_ADMIN_TOKEN` | 避免使用 `change-me` 或示例 token 暴露监控接口 |
| 环境变量 | 补充图片编辑专用上游变量示例 | 明确 Images API 编辑与 Responses API 编辑的上游选择 |
| 文档一致性 | 更新 README、Quickstart、Proxy Guide | 修正文档与当前 TS/Next/gpt-image-2 实现之间的漂移 |
| 旧文档标记 | 为早期报告类文档加过时说明 | 避免读者把旧 `.js`、`dall-e-3` 示例当成当前事实 |
| 验证脚本 | 更新 `verify-setup` 文件路径和监控调用提示 | 让快速验证脚本匹配当前 `.ts` 文件结构和鉴权要求 |
| Git 卫生 | 忽略 `.sanshu-memory/` 并新增 `.gitattributes` | 避免本地记忆文件误提交，统一文本换行规则 |
| 图片预览 | 生成图预览从裁切改为完整展示 | 避免海报、竖图或宽图在结果卡片中丢失构图 |
| 代理日志 | 请求日志记录 `cache/success/error`、耗时和错误摘要 | 让 `/api/proxy/stats` 更适合排查请求状态 |
| 远程落盘 | 白名单远程图片 URL 可安全拉取到本地历史 | 避免只返回短期 URL 的上游导致历史图片失效，同时控制 SSRF 风险 |

## 文件清单

### 配置与部署

- `package.json`
  - 新增 `scripts.start = "next start"`。
  - 新增 `engines.node = ">=22.14.0"`。

- `package-lock.json`
  - 同步根包 `engines.node` 元数据。

- `.env.example`
  - 新增 `OPENAI_IMAGE_EDIT_BASE_URL`。
  - 新增 `OPENAI_RESPONSES_EDIT_BASE_URL`。
  - 新增 `OPENAI_IMAGE_PERSIST_ALLOWED_HOSTS`，留空时不主动拉取远程图片 URL。
  - 新增 `OPENAI_IMAGE_PERSIST_MAX_BYTES`，默认 8MB。
  - 将 `PROXY_ADMIN_TOKEN` 示例从 `change-me` 改为 `replace-with-long-random-token`。
  - 明确该 token 必须替换为强随机值。

### 安全

- `src/lib/admin-auth.ts`
  - 新增默认占位 token 黑名单。
  - 当 `PROXY_ADMIN_TOKEN` 为 `change-me` 或 `replace-with-long-random-token` 时，监控接口返回 `403`。
  - 保留原有 Bearer token 与 `x-proxy-admin-token` 校验方式。

- `test/proxy.test.ts`
  - 增加默认占位 token 被拒绝的测试覆盖。

### 文档

- `README.md`
  - 补充图片编辑专用上游环境变量。
  - 更新 `PROXY_ADMIN_TOKEN` 说明，标明默认占位值会被服务端拒绝。
  - 修正图片编辑上游说明：Images API 编辑优先使用 `OPENAI_IMAGE_EDIT_BASE_URL` / `OPENAI_IMAGES_EDIT_BASE_URL`，Responses API 编辑优先使用 `OPENAI_RESPONSES_EDIT_BASE_URL` / `OPENAI_RESPONSES_BASE_URL` / `OPENAI_BASE_URL`。

- `docs/QUICKSTART.md`
  - 更新环境变量示例。
  - 将监控接口 curl 示例中的 token 替换为非默认占位示例。
  - Docker 示例从 `node:18-alpine` 改为 `node:22-alpine`。
  - Docker 安装命令从 `npm install` 改为 `npm ci`。
  - Docker 启动命令改为 `npm run start`。

- `docs/PROXY_GUIDE.md`
  - 更新监控 token 示例。
  - 补充 `OPENAI_IMAGE_EDIT_BASE_URL` 示例。
  - 将核心文件结构中的 `.js` 路径修正为 `.ts`。

- `docs/ARCHITECTURE.md`
- `docs/DELIVERY_REPORT.md`
- `docs/FILE_STRUCTURE.md`
- `docs/IMPLEMENTATION_SUMMARY.md`
  - 添加过时说明：这些文件保留早期方案或交付记录，当前准确信息以 `README.md` 和 `docs/QUICKSTART.md` 为准。

### 验证脚本与 Git 元数据

- `verify-setup.sh`
  - 将检查路径从 `.js` 文件更新为当前 `.ts` 文件。
  - 将文档路径更新为 `docs/QUICKSTART.md` 和 `docs/PROXY_GUIDE.md`。
  - 更新代理统计接口示例，提示必须携带 `Authorization`。

- `verify-setup.bat`
  - 同步 Windows 版本验证脚本中的路径和代理统计接口提示。

- `.gitignore`
  - 新增 `.sanshu-memory/`。
  - 清理 `*.log` 规则末尾多余空格。

- `.gitattributes`
  - 新增默认文本换行规则：`* text=auto eol=lf`。
  - 保留 Windows 批处理文件 CRLF：`*.bat text eol=crlf`。

### P1 低风险修复

- `src/app/globals.css`
  - 将生成结果图的 `object-fit` 从 `cover` 改为 `contain`。
  - 添加中文注释说明：生成图预览必须保留完整构图，避免海报或竖图被卡片裁切。

- `src/lib/proxy-middleware.ts`
  - `RequestLogEntry` 新增 `id`、`durationMs`、`error` 字段。
  - 日志状态从固定 `pending` 扩展为 `pending`、`cache`、`success`、`error`。
  - `logRequest()` 返回日志 ID，便于后续更新同一条请求记录。
  - 新增 `completeRequest()`，用于记录请求最终状态、耗时和错误摘要。

- `src/lib/proxy-handler.ts`
  - 请求开始时记录日志 ID。
  - 缓存命中时写入 `cache` 状态。
  - 上游调用成功时写入 `success` 状态和耗时。
  - 上游调用失败时写入 `error` 状态、耗时和错误摘要后继续抛出原错误。
  - 移除缓存命中时的 `console.log`，避免生产日志噪声。

- `test/proxy.test.ts`
  - 增加代理请求日志 ID、默认 `pending` 状态、完成状态和耗时的测试覆盖。

- `src/lib/generation-history-store.ts`
  - 增加远程图片 URL 白名单落盘能力。
  - 仅允许 `OPENAI_IMAGE_PERSIST_ALLOWED_HOSTS` 或测试注入白名单中的 HTTPS 域名。
  - 拒绝相对 URL、非 HTTPS URL、包含认证信息的 URL、IP 字面量私网地址、DNS 解析到私网地址的主机。
  - 拉取时拒绝重定向，避免白名单地址跳转到内网资源。
  - 仅接受 `image/png`、`image/jpeg`、`image/webp`。
  - 使用 `OPENAI_IMAGE_PERSIST_MAX_BYTES` 或默认 8MB 限制单张远程图片大小。
  - 拉取失败、类型不合法、超过大小限制或不在白名单内时保留原 URL，不阻塞历史写入。

- `test/generation-history-store.test.ts`
  - 增加白名单远程 URL 成功落盘测试。
  - 增加未配置白名单时不拉取测试。
  - 增加 DNS 解析到私网地址时拒绝拉取测试。
  - 增加远程图片超过体积限制时保留原 URL 测试。

## 验证结果

已运行以下命令，全部通过：

```bash
npm run lint
npm test
npm run build
```

最新验证结果摘要：

- TypeScript 类型检查通过。
- Node 内置测试共 56 项，全部通过。
- Next.js 生产构建通过。
- 构建输出包含以下路由：
  - `/`
  - `/api/generation-history`
  - `/api/generation-history/image`
  - `/api/images/edit`
  - `/api/images/generate`
  - `/api/proxy/stats`

## 工作区状态说明

本轮 P0 修复之前，工作区已经存在多处 UI 和图片编辑相关未提交改动，包括：

- `src/app/api/images/edit/route.ts`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/image-studio/EditComposer.tsx`
- `src/components/image-studio/EditImageStage.tsx`
- `src/components/image-studio/HistoryRail.tsx`
- `src/components/image-studio/ImageEditWorkspace.tsx`
- `src/components/image-studio/ImageViewer.tsx`
- `src/lib/image-edit-options.ts`
- `src/lib/image-edit-proxy.ts`
- `test/image-edit-options.test.ts`
- `test/image-edit-proxy.test.ts`
- `src/components/ThemeToggle.tsx`
- `src/lib/image-edit-config.ts`
- `src/lib/image-edit-upload.ts`
- `test/image-edit-config.test.ts`
- `test/image-edit-upload.test.ts`

这些既有改动未被回滚。本次 P0 修复只在必要处与其协同，例如文档补充了图片编辑上游配置，测试验证覆盖了当前代码状态。

## 后续建议

建议下一轮按剩余优先级处理：

1. 前端状态拆分：拆分 `src/app/page.tsx` 中的生成、历史、查看器和编辑状态逻辑。
2. 组件测试：为关键前端交互补 React 层测试或 Playwright 冒烟测试。
3. 历史图片长期存储：如果后续需要生产级持久化，建议迁移到对象存储或数据库元数据，而不是继续扩大本地 `.local/`。
4. 可观测性扩展：如需生产排障，可把内存请求日志升级为结构化持久日志或接入外部日志服务。
