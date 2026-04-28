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
OPENAI_IMAGE_MODEL=dall-e-3

# 启用代理功能
ENABLE_PROXY_CACHE=true
ENABLE_REQUEST_LOG=true
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

#### 查看统计信息
```bash
curl http://localhost:3000/api/proxy/stats
```

#### 清空缓存
```bash
curl -X POST http://localhost:3000/api/proxy/clear-cache \
  -H "Content-Type: application/json" \
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
| **自动重试** | 请求失败自动重试最多3次 |
| **监控统计** | 实时查看代理运行状态和性能 |
| **请求日志** | 记录最近100条请求用于调试 |

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
默认只保留最多100条请求日志，缓存会在1小时后自动清理。

**Q: 如何禁用缓存？**
```env
ENABLE_PROXY_CACHE=false
```

**Q: 支持哪些图片大小？**
- 1024x1024
- 1536x1024
- 1024x1536

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
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
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
