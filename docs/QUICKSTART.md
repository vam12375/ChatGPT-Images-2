# 快速启动 - ChatGPT 反向代理

## 3分钟快速开始

### 第1步：配置环境变量

编辑 `.env.local` 文件，填入你的 OpenAI API 密钥：

```env
# 最简单的配置（单个密钥）
OPENAI_API_KEY=sk-proj-xxxxx

# 更强大的配置（多个密钥，自动轮转）
OPENAI_API_KEYS=sk-proj-key1,sk-proj-key2,sk-proj-key3

# 模型配置
OPENAI_IMAGE_MODEL=gpt-image-2

# 可选：通用中转 API 地址
OPENAI_BASE_URL=https://api.openai.com/v1

# 可选：Images API 图片编辑专用上游
OPENAI_IMAGE_EDIT_BASE_URL=https://api.apiyi.com/v1

# 可选：远程图片历史落盘白名单，留空时不主动拉取远程 URL
OPENAI_IMAGE_PERSIST_ALLOWED_HOSTS=
OPENAI_IMAGE_PERSIST_MAX_BYTES=8388608

# 启用代理功能
ENABLE_PROXY_CACHE=true
PROXY_CACHE_DURATION=3600
PROXY_CACHE_MAX_ENTRIES=50
ENABLE_REQUEST_LOG=true

# 本地防滥用与监控鉴权
IMAGE_RATE_LIMIT_MAX=10
IMAGE_RATE_LIMIT_WINDOW_MS=60000
PROXY_ADMIN_TOKEN=replace-with-long-random-token
```

### 第2步：启动服务

```bash
npm install
npm run dev
```

服务将运行在 `http://localhost:3000`

### 第3步：测试反向代理

#### 生成图片
```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "一只穿着宇航服的猫咪在月球上",
    "size": "1024x1024",
    "quality": "high",
    "outputFormat": "png",
    "count": 1
  }'
```

#### 编辑图片

前端页面生成图片后，点击结果卡片下方的“编辑”即可进入全屏图片编辑工作区。只输入文字会执行整图编辑；用画笔涂抹后提交，会把涂抹区域导出为 PNG mask 并执行局部重绘。

mask 规则：涂抹区域为透明像素，未涂抹区域为不透明像素。

接口也可以直接用 `multipart/form-data` 调用：

```bash
curl -X POST http://localhost:3000/api/images/edit \
  -F "prompt=把天空改成粉色晚霞" \
  -F "size=1024x1024" \
  -F "quality=high" \
  -F "output_format=png" \
  -F "background=auto" \
  -F "image[]=@source.png"
```

#### 查看统计信息
```bash
curl http://localhost:3000/api/proxy/stats \
  -H "Authorization: Bearer replace-with-long-random-token"
```

#### 清空缓存
```bash
curl -X POST http://localhost:3000/api/proxy/stats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer replace-with-long-random-token" \
  -d '{"action": "clear-cache"}'
```

## 运行测试

```bash
npm test
```

## 反向代理核心功能

| 功能 | 说明 |
|------|------|
| **密钥轮转** | 配置多个API密钥，自动轮转使用 |
| **智能缓存** | 相同请求返回缓存结果，节省成本 |
| **自动重试** | 只对 429 和 5xx 自动重试最多3次 |
| **监控统计** | 使用访问令牌查看代理运行状态和性能 |
| **本地限流** | 默认每个客户端每分钟最多10次生成请求 |
| **请求日志** | 记录最近100条请求用于调试 |
| **图片编辑** | 支持 `gpt-image-2` multipart 编辑接口和画笔 mask |

## 工作流程图

```
请求 → 验证参数 → 检查缓存 → 获取密钥 → 调用API → 处理响应 → 返回结果
                    ↓
                  命中？
                    ↓
                  直接返回
```

## 常见问题

**Q: 如何配置多个API密钥？**
```env
OPENAI_API_KEYS=sk-key-1,sk-key-2,sk-key-3
```

**Q: 缓存会不会太占内存？**
默认只保留最多100条请求日志，缓存默认最多保留50条结果，并在1小时后自动清理。

**Q: 如何禁用缓存？**
```env
ENABLE_PROXY_CACHE=false
```

**Q: 支持哪些图片大小？**
- 1024x1024
- 1536x1024
- 1024x1536

**Q: 图片编辑支持透明背景吗？**
不支持。编辑接口只允许 `background=auto` 或 `background=opaque`，避免把模型会拒绝的透明背景参数发到上游。

**Q: 局部编辑的 mask 为什么要透明？**
上游编辑接口用透明像素表示需要重绘的区域，不透明像素表示保留原图。页面中的蓝色涂抹只是交互反馈，真正提交的是透明/不透明 alpha mask。

**Q: 如何检查反向代理是否正常工作？**
访问 `http://localhost:3000/api/proxy/stats` 查看实时统计信息。

## 部署到云端

### Vercel 部署

1. 推送代码到 GitHub
2. 在 Vercel 中导入项目
3. 添加环境变量：`OPENAI_API_KEY`
4. 部署

### Docker 部署

创建 `Dockerfile`：
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "run", "start"]
```

构建和运行：
```bash
docker build -t chatgpt-proxy .
docker run -e OPENAI_API_KEY=sk-xxx -p 3000:3000 chatgpt-proxy
```

## 获取帮助

- 查看详细文档：[PROXY_GUIDE.md](./PROXY_GUIDE.md)
- OpenAI 官方文档：https://platform.openai.com/docs
- 项目问题：创建 Issue 或 Discussion

## 许可证

MIT
