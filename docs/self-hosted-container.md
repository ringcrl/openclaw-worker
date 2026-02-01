# 自托管容器：替代 Cloudflare Sandbox

用自己的容器替代 Cloudflare Sandbox，实现数据持久化。

## 架构

```
Cloudflare Worker (环境变量 + 认证)
         ↓
    自托管容器 (Railway)
```

**优势：**
- ✅ 数据持久化
- ✅ 成本相同或更低
- ✅ 可替换任意容器服务商

---

## 步骤 1：部署容器

### 创建 Dockerfile

在项目根目录创建 `Dockerfile.selfhosted`：

```dockerfile
FROM node:22-slim

RUN npm install -g @openclaw/cli

RUN mkdir -p /root/.clawdbot
COPY moltbot.json.template /root/.clawdbot/clawdbot.json

EXPOSE 18789

CMD ["clawdbot", "gateway", "--port", "18789", "--bind", "0.0.0.0", "--allow-unconfigured", "--verbose"]
```

### 部署到 Railway

```bash
# 安装 CLI
npm install -g @railway/cli

# 登录
railway login

# 初始化
railway init

# 部署
railway up --dockerfile Dockerfile.selfhosted

# 获取地址
railway domain
```

记录输出的地址，例如：
```
https://openclaw-production.up.railway.app
```

> **注意：** 可以替换为任何支持 Docker 的服务商（Fly.io、Render、VPS 等），只需提供相同的 Dockerfile 和公网地址。

---

## 步骤 2：修改 Worker

### 修改 `src/types.ts`

添加外部后端地址：

```typescript
export interface MoltbotEnv {
  ANTHROPIC_API_KEY: string;
  MOLTBOT_GATEWAY_TOKEN: string;
  ANTHROPIC_BASE_URL?: string;
  SANDBOX_SLEEP_AFTER?: string;
  
  // 新增
  EXTERNAL_BACKEND_URL?: string;
  
  Sandbox?: object;
}
```

### 修改 `src/index.ts`

在 `app.all('*', async (c) => {` 开头添加外部后端支持（约第 154 行）：

```typescript
app.all('*', async (c) => {
  const request = c.req.raw;
  const url = new URL(request.url);

  // === 新增：使用外部后端 ===
  const backendUrl = c.env.EXTERNAL_BACKEND_URL;
  
  if (backendUrl) {
    console.log('[PROXY] Self-hosted backend:', backendUrl);
    
    const targetUrl = new URL(url.pathname + url.search, backendUrl);
    const headers = new Headers(request.headers);
    
    // 通过 Headers 传递环境变量
    if (c.env.ANTHROPIC_API_KEY) {
      headers.set('X-Anthropic-API-Key', c.env.ANTHROPIC_API_KEY);
    }
    if (c.env.MOLTBOT_GATEWAY_TOKEN) {
      headers.set('X-Gateway-Token', c.env.MOLTBOT_GATEWAY_TOKEN);
    }
    
    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: request.body,
        // @ts-ignore
        duplex: 'half',
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      return c.json({
        error: 'Backend unreachable',
        backend: backendUrl,
        details: error instanceof Error ? error.message : String(error),
      }, 503);
    }
  }

  // === 原有 Sandbox 逻辑 ===
  const sandbox = c.get('sandbox');
  
  console.log('[PROXY] Handling request:', url.pathname);

  const existingProcess = await findExistingMoltbotProcess(sandbox);
  const isGatewayReady = existingProcess !== null && existingProcess.status === 'running';
  
  // ... 保持原有代码不变 ...
```

---

## 步骤 3：部署

### 配置环境变量

```bash
# 设置后端地址
npx wrangler secret put EXTERNAL_BACKEND_URL
# 输入：https://openclaw-production.up.railway.app

# 其他环境变量保持不变
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put MOLTBOT_GATEWAY_TOKEN
```

### 部署 Worker

```bash
npm run deploy
```

### 测试

```bash
# 健康检查
curl https://your-worker.workers.dev/health

# API 测试
curl -H "Authorization: Bearer your-token" \
  https://your-worker.workers.dev/api/status
```

---

## 数据持久化

Railway 自动持久化 `/root/.clawdbot` 目录。

**验证：**
1. 配置 Telegram bot
2. 在 Railway Dashboard 重启容器
3. 配置依然存在 ✓

---

## 切换服务商

可以无缝迁移到任何服务商：

1. 在新平台部署相同的 `Dockerfile.selfhosted`
2. 更新 Worker 环境变量：
   ```bash
   npx wrangler secret put EXTERNAL_BACKEND_URL
   # 输入新的地址
   ```
3. 完成

---

## 故障排查

### 503 Backend unreachable

检查：
- 容器是否运行？（Railway Dashboard）
- `EXTERNAL_BACKEND_URL` 是否正确？（`wrangler secret list`）

### 配置丢失

检查：
- Railway 默认持久化，无需配置
- 其他平台需要挂载 Volume 到 `/root/.clawdbot`

---

## 成本对比

| 方案 | 成本 | 持久化 |
|------|------|--------|
| Cloudflare Sandbox | $5/月 | ❌ |
| Railway | $5/月 | ✅ |
| Fly.io | $3/月 | ✅ |

**迁移后：数据永久保存，成本更低或持平。**
