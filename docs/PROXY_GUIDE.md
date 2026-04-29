# ChatGPT 图片生成反向代理 - 实现指南

## 概述

这个项目实现了一个本地优先的 OpenAI 图片生成反向代理系统，支持缓存、负载均衡、限流、监控鉴权和错误重试。

## 核心特性

### 1. **API 密钥负载均衡**
支持配置多个 OpenAI API 密钥，自动轮转使用，防止单个密钥被限流。

```env
# .env.local
OPENAI_API_KEYS=sk-key-1,sk-key-2,sk-key-3
```

### 2. **智能缓存机制**
- 基于接口模式、prompt、size、quality、outputFormat、count、model 的 MD5 哈希缓存
- 默认缓存1小时
- 默认最多保留 50 条缓存结果
- 可通过 API 手动清空

### 3. **自动重试机制**
- 指数退避重试（最多3次）
- 只重试 429 和 5xx，参数错误不会重复请求
- 避免临时网络故障导致请求失败

### 4. **请求日志和监控**
- 记录最近100条请求
- 实时查看代理运行状态
- 监控接口需要 `PROXY_ADMIN_TOKEN`

### 5. **本地限流**
- 默认每个客户端每分钟最多 10 次生成请求
- 可通过环境变量调整限流窗口和上限

## 配置

### 环境变量

```env
# 必需：OpenAI API 密钥
OPENAI_API_KEY=sk-xxx

# 可选：多个密钥（逗号分隔）
OPENAI_API_KEYS=sk-key-1,sk-key-2,sk-key-3

# 图片生成模型
OPENAI_IMAGE_MODEL=gpt-image-2

# 代理配置
ENABLE_PROXY_CACHE=true           # 启用缓存
PROXY_CACHE_DURATION=3600          # 缓存持续时间（秒）
PROXY_CACHE_MAX_ENTRIES=50         # 内存缓存最多条目
ENABLE_REQUEST_LOG=true            # 启用请求日志
PROXY_ADMIN_TOKEN=change-me        # 监控接口访问令牌

# 本地防滥用
IMAGE_RATE_LIMIT_MAX=10
IMAGE_RATE_LIMIT_WINDOW_MS=60000

# 自定义 API 代理地址 (可选，用于解决国内网络问题或使用第三方中转 API)
# OPENAI_BASE_URL=https://api.openai.com/v1
```

## API 端点

### 生成图片
```
POST /api/images/generate
Content-Type: application/json

{
  "prompt": "一只可爱的猫咪",
  "size": "1024x1024",
  "quality": "high",
  "outputFormat": "png",
  "count": 1
}
```

**响应：**
```json
{
  "images": [
    {
      "id": "1714310400000-0",
      "dataUrl": "/api/generation-history/image?sessionId=1714310400000-uuid&imageId=1714310400000-0",
      "mimeType": "image/png"
    }
  ],
  "model": "gpt-image-2",
  "usage": null,
  "cached": false
}
```

### 代理统计信息
```
GET /api/proxy/stats
Authorization: Bearer <PROXY_ADMIN_TOKEN>
```

**响应：**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "proxyConfig": {
    "totalKeys": 3,
    "requests": {
      "0": 45,
      "1": 42,
      "2": 38
    },
    "currentKeyIndex": 1
  },
  "cache": {
    "cacheSize": 12,
    "maxCacheEntries": 50,
    "maxCacheAge": 3600000,
    "requestLogSize": 25
  },
  "recentRequests": [
    {
      "timestamp": "2024-01-15T10:29:50.123Z",
      "prompt": "a cute cat...",
      "size": "1024x1024",
      "status": "pending"
    }
  ]
}
```

### 清空缓存
```
POST /api/proxy/stats
Content-Type: application/json
Authorization: Bearer <PROXY_ADMIN_TOKEN>

{
  "action": "clear-cache"
}
```

## 反向代理的工作流程

```
┌─────────────┐
│   客户端    │
└──────┬──────┘
       │ 请求生成图片
       ▼
┌──────────────────────────────┐
│  /api/images/generate (POST) │
└──────┬───────────────────────┘
       │
       ├─► 检查缓存 ──► 有缓存？返回缓存图片
       │
       ├─► 记录请求日志
       │
       ├─► 获取 API 密钥（负载均衡）
       │
       ├─► 调用 OpenAI API
       │   └─► 失败？重试最多3次
       │
       ├─► 处理响应
       │
       ├─► 存入缓存
       │
       └─► 返回结果给客户端
```

## 文件结构

```
src/
├── lib/
│   ├── proxy-config.js        # 密钥管理和负载均衡
│   ├── proxy-middleware.js    # 缓存和日志中间件
│   ├── rate-limit.js          # 本地内存限流
│   ├── admin-auth.js          # 监控接口鉴权
│   ├── openai-retry.js        # OpenAI 重试策略
│   ├── proxy-handler.js       # 核心代理逻辑（重试、缓存）
│   ├── image-options.js       # 请求参数验证
│   └── openai-error.js        # 错误处理
└── app/
    └── api/
        ├── generation-history/image/route.js  # 本地图片读取端点
        ├── images/generate/route.js           # 生成图片端点
        └── proxy/stats/route.js               # 监控端点
```

## 使用示例

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
```bash
# 编辑 .env.local
OPENAI_API_KEY=sk-your-key
OPENAI_IMAGE_MODEL=gpt-image-2
ENABLE_PROXY_CACHE=true
PROXY_ADMIN_TOKEN=change-me
```

### 3. 运行开发服务器
```bash
npm run dev
```

### 4. 测试反向代理

```bash
# 测试生成图片
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "一只看书的猫咪",
    "size": "1024x1024",
    "quality": "high",
    "outputFormat": "png",
    "count": 1
  }'

# 查看代理统计
curl http://localhost:3000/api/proxy/stats \
  -H "Authorization: Bearer change-me"

# 清空缓存
curl -X POST http://localhost:3000/api/proxy/stats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer change-me" \
  -d '{"action": "clear-cache"}'
```

## 高级特性

### 多密钥轮转
系统会自动轮转使用配置的多个 API 密钥，实现负载均衡：

```javascript
// 密钥 1 -> 密钥 2 -> 密钥 3 -> 密钥 1...
```

### 智能缓存
相同的接口模式、prompt、size、quality、outputFormat、count、model 组合会返回缓存结果，减少 API 调用成本。缓存 TTL 由 `PROXY_CACHE_DURATION` 控制，容量由 `PROXY_CACHE_MAX_ENTRIES` 控制。

### 自动重试
当请求遇到 429 或 5xx 时，系统会自动重试最多3次，间隔时间按指数退避增长：
- 第1次重试：等待 1 秒
- 第2次重试：等待 2 秒
- 第3次重试：等待 4 秒

## 部署建议

### 生产环境
1. 配置多个 API 密钥以提高容错能力
2. 启用缓存以减少 API 成本
3. 配置 `PROXY_ADMIN_TOKEN` 后监控 `/api/proxy/stats`
4. 根据使用频率调整 `IMAGE_RATE_LIMIT_MAX`
5. 多人或生产部署时再考虑数据库、Redis 或对象存储

### 安全性
- 保护好 `.env.local` 文件
- 为监控接口配置强随机 `PROXY_ADMIN_TOKEN`
- 保持请求限流开启，防止误操作消耗额度
- 定期更新依赖包

## 故障排查

### 缓存命中率低
- 检查是否启用了缓存：`ENABLE_PROXY_CACHE=true`
- 查看 `/api/proxy/stats` 中的 `cacheSize`

### 请求总是失败
- 验证 API 密钥是否正确
- 检查 API 额度是否充足
- 查看错误日志中的详细信息

### 性能下降
- 清空过期缓存：`POST /api/proxy/stats`，body 为 `{"action":"clear-cache"}`
- 增加 API 密钥数量以分散流量
- 检查是否有内存泄漏

## 相关文档

- [OpenAI 官方文档](https://platform.openai.com/docs/api-reference/images)
- [Next.js API 路由](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
