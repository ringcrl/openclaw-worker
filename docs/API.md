# API 参考文档

本 Worker 采用 **纯 API 驱动架构**。所有配置都通过 API 动态管理，只需要 3 个环境变量。

## 环境变量

使用 `wrangler secret put` 设置：

```bash
# 必需
npx wrangler secret put MOLTBOT_GATEWAY_TOKEN   # API 认证的 Bearer token
npx wrangler secret put ANTHROPIC_API_KEY        # Anthropic API 密钥
npx wrangler secret put ANTHROPIC_BASE_URL       # 自定义 Anthropic 端点
```

## 认证方式

所有 API 端点都需要 Bearer token 认证：

```bash
curl -H "Authorization: Bearer <MOLTBOT_GATEWAY_TOKEN>" \
  https://your-worker.workers.dev/api/status
```

## API 端点

### 网关管理

#### GET /api/status
获取当前网关状态。

**请求：**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-worker.workers.dev/api/status
```

**响应：**
```json
{
  "status": "running",
  "ready": true,
  "processId": "abc123"
}
```

#### POST /api/gateway/restart
重启网关进程。

**请求：**
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://your-worker.workers.dev/api/gateway/restart
```

**响应：**
```json
{
  "success": true,
  "message": "Gateway process killed, new instance starting...",
  "previousProcessId": "abc123"
}
```

### 动态配置

#### GET /api/config
获取当前配置（敏感 token 已脱敏）。

**请求：**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-worker.workers.dev/api/config
```

**响应：**
```json
{
  "config": {
    "channels": {
      "telegram": {
        "enabled": true,
        "botToken": "***REDACTED***",
        "dm": { "policy": "pair-first" }
      }
    }
  }
}
```

#### POST /api/config/telegram
配置 Telegram 机器人。

**请求：**
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "123456:ABC-DEF...",
    "dmPolicy": "pair-first"
  }' \
  https://your-worker.workers.dev/api/config/telegram
```

**响应：**
```json
{
  "success": true,
  "message": "Telegram bot configured and gateway restarted"
}
```

**参数：**
- `botToken` (必需): 从 @BotFather 获取的 Telegram bot token
- `dmPolicy` (可选): 私聊策略 - `"pair-first"` (默认), `"allow"`, 或 `"deny"`

#### POST /api/config/discord
配置 Discord 机器人。

**请求：**
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "your-discord-bot-token",
    "dmPolicy": "pair-first"
  }' \
  https://your-worker.workers.dev/api/config/discord
```

**响应：**
```json
{
  "success": true,
  "message": "Discord bot configured and gateway restarted"
}
```

**参数：**
- `botToken` (必需): Discord bot token
- `dmPolicy` (可选): 私聊策略 - `"pair-first"` (默认), `"allow"`, 或 `"deny"`

#### POST /api/config/slack
配置 Slack 机器人。

**请求：**
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "xoxb-...",
    "appToken": "xapp-..."
  }' \
  https://your-worker.workers.dev/api/config/slack
```

**响应：**
```json
{
  "success": true,
  "message": "Slack bot configured and gateway restarted"
}
```

**参数：**
- `botToken` (必需): Slack Bot User OAuth Token (以 `xoxb-` 开头)
- `appToken` (必需): Slack App-Level Token (以 `xapp-` 开头)

#### DELETE /api/config/:channel
删除指定渠道的配置。

**请求：**
```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  https://your-worker.workers.dev/api/config/telegram
```

**响应：**
```json
{
  "success": true,
  "message": "telegram configuration removed and gateway restarted"
}
```

**支持的渠道：** `telegram`, `discord`, `slack`

## 完整工作流示例

### 初始化设置

```bash
# 1. 设置环境变量
npx wrangler secret put MOLTBOT_GATEWAY_TOKEN
# 输入: my-secret-token-123

npx wrangler secret put ANTHROPIC_API_KEY
# 输入: sk-ant-...

# 2. 部署
npm run deploy

# 3. 保存 token 用于 API 调用
export TOKEN="my-secret-token-123"
export WORKER_URL="https://your-worker.workers.dev"
```

### 配置 Telegram

```bash
# 1. 通过 @BotFather 创建 Telegram bot
# 2. 获取 bot token

# 3. 通过 API 配置
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "123456:ABC-DEF..."
  }' \
  $WORKER_URL/api/config/telegram

# 4. 检查配置
curl -H "Authorization: Bearer $TOKEN" \
  $WORKER_URL/api/config
```

### 配置 Discord

```bash
# 1. 在 https://discord.com/developers/applications 创建 Discord 应用
# 2. 创建 bot 并获取 token

# 3. 通过 API 配置
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "your-discord-bot-token"
  }' \
  $WORKER_URL/api/config/discord
```

### 配置 Slack

```bash
# 1. 在 https://api.slack.com/apps 创建 Slack 应用
# 2. 获取 Bot User OAuth Token (xoxb-...) 和 App-Level Token (xapp-...)

# 3. 通过 API 配置
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "xoxb-...",
    "appToken": "xapp-..."
  }' \
  $WORKER_URL/api/config/slack
```

### 更新配置

```bash
# 删除 Telegram 配置
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  $WORKER_URL/api/config/telegram

# 重启网关以应用更改
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  $WORKER_URL/api/gateway/restart
```

## 错误响应

### 401 未授权
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid Authorization header",
  "hint": "Use: Authorization: Bearer <MOLTBOT_GATEWAY_TOKEN>"
}
```

### 400 错误请求
```json
{
  "error": "botToken is required"
}
```

### 500 内部服务器错误
```json
{
  "error": "Failed to update configuration"
}
```

## 注意事项

- **网关重启**：配置更改需要重启网关（配置端点会自动处理）
- **Token 安全**：永远不要将 token 提交到 git。始终使用 `wrangler secret put`
- **容器持久化**：配置存储在容器内存中。如果容器重启，需要通过 API 重新配置
- **DEV_MODE**：设备配对默认被跳过（硬编码 `DEV_MODE=true`）
- **WebSocket**：网关 WebSocket 端点需要 token 作为查询参数：`wss://your-worker.workers.dev/ws?token=YOUR_TOKEN`

## 高级：配置持久化

要在容器重启后保持配置，可以考虑：

1. **R2 存储**：将配置存储在 Cloudflare R2 中，启动时加载
2. **KV 存储**：使用 Cloudflare KV 进行轻量级配置存储
3. **Durable Objects**：使用 DO state 进行事务性配置管理

R2 集成示例：

```typescript
// 启动时从 R2 加载配置
const configObject = await env.R2_BUCKET.get('moltbot-config.json');
const config = configObject ? await configObject.json() : {};

// 应用配置到网关...
```

## 使用技巧

### 批量配置脚本

创建一个 `configure.sh` 脚本来快速配置所有渠道：

```bash
#!/bin/bash
set -e

TOKEN="your-token"
WORKER_URL="https://your-worker.workers.dev"

# Telegram
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"botToken\": \"$TELEGRAM_BOT_TOKEN\"}" \
  $WORKER_URL/api/config/telegram

# Discord
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"botToken\": \"$DISCORD_BOT_TOKEN\"}" \
  $WORKER_URL/api/config/discord

# Slack
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"botToken\": \"$SLACK_BOT_TOKEN\", \"appToken\": \"$SLACK_APP_TOKEN\"}" \
  $WORKER_URL/api/config/slack

echo "✅ All channels configured!"
```

### 健康检查

设置定时任务检查网关状态：

```bash
#!/bin/bash
# healthcheck.sh

STATUS=$(curl -s -H "Authorization: Bearer $TOKEN" \
  $WORKER_URL/api/status | jq -r '.status')

if [ "$STATUS" != "running" ]; then
  echo "⚠️  Gateway is $STATUS, restarting..."
  curl -X POST -H "Authorization: Bearer $TOKEN" \
    $WORKER_URL/api/gateway/restart
else
  echo "✅ Gateway is healthy"
fi
```

### 配置备份

定期备份配置到本地：

```bash
#!/bin/bash
# backup-config.sh

curl -H "Authorization: Bearer $TOKEN" \
  $WORKER_URL/api/config | \
  jq '.' > "config-backup-$(date +%Y%m%d-%H%M%S).json"

echo "✅ Configuration backed up"
```
