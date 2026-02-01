# 请求流程与端口映射

本文档说明外部请求如何访问运行在 Cloudflare Sandbox 容器内 18789 端口上的 OpenClaw 网关。

## 架构概览

```
用户浏览器
   ↓
https://your-worker.workers.dev
   ↓
┌────────────────────────────────────┐
│  Cloudflare Worker (src/index.ts)  │
│  - 初始化 Sandbox 实例             │
│  - 确保网关正在运行                 │
│  - 充当反向代理                     │
└──────────────┬─────────────────────┘
               │
               │ sandbox.containerFetch(request, 18789)
               │ sandbox.wsConnect(request, 18789)
               ↓
┌────────────────────────────────────┐
│  Cloudflare Sandbox 容器           │
│  - OpenClaw Gateway :18789         │
│  - 控制台 UI + WebSocket RPC        │
└────────────────────────────────────┘
```

## 关键组件

### 1. 容器绑定配置 (`wrangler.jsonc`)

容器在 Worker 中配置为 Durable Object 绑定：

```jsonc
"containers": [
  {
    "class_name": "Sandbox",
    "image": "./Dockerfile",
    "instance_type": "standard-4",
    "max_instances": 1
  }
],
"durable_objects": {
  "bindings": [
    {
      "class_name": "Sandbox",
      "name": "Sandbox"
    }
  ]
}
```

这使得容器可以在 Worker 代码中通过 `c.env.Sandbox` 访问。

### 2. Worker 作为反向代理 (`src/index.ts`)

Worker 充当智能反向代理，承担多项职责：

#### a. Sandbox 初始化 (第 116-121 行)

每个请求都会初始化或检索 sandbox 实例：

```typescript
app.use('*', async (c, next) => {
  const options = buildSandboxOptions(c.env);
  const sandbox = getSandbox(c.env.Sandbox, 'moltbot', options);
  c.set('sandbox', sandbox);
  await next();
});
```

#### b. 网关进程管理 (第 199-239 行)

在代理请求之前，Worker 确保 OpenClaw 网关正在运行：

```typescript
// 检查网关是否已经在运行
const existingProcess = await findExistingMoltbotProcess(sandbox);
const isGatewayReady = existingProcess !== null && existingProcess.status === 'running';

// 如果未准备好，显示加载页面（针对浏览器请求）
if (!isGatewayReady && !isWebSocketRequest && acceptsHtml) {
  // 在后台启动网关
  c.executionCtx.waitUntil(ensureMoltbotGateway(sandbox, c.env));
  return c.html(loadingPageHtml);
}

// 等待网关准备就绪
await ensureMoltbotGateway(sandbox, c.env);
```

#### c. HTTP 请求代理 (第 344-357 行)

常规 HTTP 请求使用 `containerFetch` 转发到容器：

```typescript
const httpResponse = await sandbox.containerFetch(request, MOLTBOT_PORT);
```

其中 `MOLTBOT_PORT = 18789`（在 `src/config.ts` 中定义）。

#### d. WebSocket 代理 (第 242-342 行)

WebSocket 连接使用 `wsConnect` 并包含消息拦截功能：

```typescript
// 连接到容器的 WebSocket 端点
const containerResponse = await sandbox.wsConnect(request, MOLTBOT_PORT);
const containerWs = containerResponse.webSocket;

// 创建客户端 WebSocket 对
const [clientWs, serverWs] = Object.values(new WebSocketPair());

// 双向转发消息
serverWs.addEventListener('message', (event) => {
  containerWs.send(event.data);
});

containerWs.addEventListener('message', (event) => {
  // 可以在这里拦截和转换消息
  serverWs.send(event.data);
});
```

### 3. 网关进程生命周期 (`src/gateway/process.ts`)

`ensureMoltbotGateway` 函数管理网关进程：

```typescript
export async function ensureMoltbotGateway(sandbox: Sandbox, env: MoltbotEnv): Promise<Process> {
  // 1. 检查是否存在现有进程
  const existingProcess = await findExistingMoltbotProcess(sandbox);
  
  if (existingProcess) {
    // 等待端口就绪
    await existingProcess.waitForPort(MOLTBOT_PORT, { 
      mode: 'tcp', 
      timeout: STARTUP_TIMEOUT_MS 
    });
    return existingProcess;
  }

  // 2. 启动新的网关进程
  const envVars = buildEnvVars(env);
  const process = await sandbox.startProcess('/usr/local/bin/start-moltbot.sh', {
    env: envVars
  });

  // 3. 等待端口就绪
  await process.waitForPort(MOLTBOT_PORT, { 
    mode: 'tcp', 
    timeout: STARTUP_TIMEOUT_MS 
  });

  return process;
}
```

## 请求流程示例

### 示例 1：首次 HTTP 请求

1. 用户访问 `https://your-worker.workers.dev/`
2. Worker 接收请求，初始化 sandbox
3. Worker 检查网关进程 → 未找到
4. Worker 检测到 HTML 请求 → 立即返回加载页面
5. Worker 通过 `executionCtx.waitUntil()` 在后台启动网关
6. 用户在约 30-60 秒后刷新页面
7. Worker 检测到正在运行的网关
8. Worker 通过 `sandbox.containerFetch(request, 18789)` 代理请求
9. 网关返回控制台 UI HTML
10. 用户看到 OpenClaw 界面

### 示例 2：WebSocket 连接

1. 浏览器向 `wss://your-worker.workers.dev/ws` 发起 WebSocket 升级请求
2. Worker 确保网关正在运行
3. Worker 调用 `sandbox.wsConnect(request, 18789)`
4. Worker 创建 WebSocket 对用于双向中继
5. 消息流向：浏览器 ↔ Worker ↔ 容器网关
6. Worker 可以拦截/转换消息（例如，美化错误消息）

### 示例 3：管理 API 请求

1. 浏览器发送 `POST https://your-worker.workers.dev/api/devices/approve`
2. Worker 路由到 `api` 路由（`src/routes/api.ts`）
3. API 处理器在容器中执行 CLI 命令：
   ```typescript
   sandbox.startProcess('clawdbot devices approve <id> --url ws://localhost:18789')
   ```
4. 等待命令完成（10-15 秒）
5. 返回 JSON 响应给浏览器

## 为什么端口 18789 不对外公开

容器的 18789 端口**不能从互联网直接访问**。原因是：

1. **Cloudflare Sandbox 提供隔离** - 容器运行在 Cloudflare 基础设施中，没有公网 IP
2. **Worker 作为唯一入口点** - 所有外部请求必须通过 Worker
3. **Cloudflare SDK 提供内部通信** - `containerFetch` 和 `wsConnect` 是内部 API，用于建立 Worker 和容器之间的通信

这种架构提供了：
- **安全性**：容器不直接暴露到互联网
- **身份验证**：Worker 可以在代理之前强制执行身份验证
- **监控**：Worker 可以记录、转换和计量所有请求
- **错误处理**：Worker 可以优雅地处理容器故障

## 特殊功能

### 加载状态管理 (第 206-218 行)

Worker 在网关启动时提供即时反馈：

```typescript
if (!isGatewayReady && !isWebSocketRequest && acceptsHtml) {
  // 异步启动网关
  c.executionCtx.waitUntil(ensureMoltbotGateway(sandbox, c.env));
  
  // 立即返回加载页面
  return c.html(loadingPageHtml);
}
```

### 错误消息转换 (第 36-46 行)

Worker 美化错误消息以提升用户体验：

```typescript
function transformErrorMessage(message: string, host: string): string {
  if (message.includes('gateway token missing')) {
    return `无效或缺少令牌。请访问 https://${host}?token={YOUR_TOKEN}`;
  }
  if (message.includes('pairing required')) {
    return `需要配对。请访问 https://${host}/_admin/`;
  }
  return message;
}
```

### WebSocket 消息拦截 (第 282-300 行)

Worker 可以在传输过程中修改 WebSocket 消息：

```typescript
containerWs.addEventListener('message', (event) => {
  let data = event.data;
  
  if (typeof data === 'string') {
    const parsed = JSON.parse(data);
    if (parsed.error?.message) {
      parsed.error.message = transformErrorMessage(parsed.error.message, url.host);
      data = JSON.stringify(parsed);
    }
  }
  
  serverWs.send(data);
});
```

## 性能考虑

- **冷启动**：首次请求需要 30-60 秒来启动容器
- **保持活动**：容器可以配置为无限期保持活动状态（`SANDBOX_SLEEP_AFTER=never`）
- **并发请求**：Worker 处理对同一 sandbox 实例的多个并发请求
- **CLI 命令**：由于 WebSocket 连接开销，设备管理命令需要 10-15 秒

## 总结

端口映射通过**反向代理模式**工作：
1. Cloudflare Worker 有一个公网 URL
2. 容器端口 18789 仅限内部访问
3. Worker 使用 Cloudflare Sandbox SDK 代理请求
4. 所有外部流量通过 Worker → 容器流动

这种架构结合了 **Serverless**（无需服务器管理）和**容器**（完整应用运行时）的优势，同时保持安全性和可观测性。
