# OpenClaw on Cloudflare Workers (API-Driven)

Run [OpenClaw](https://github.com/openclaw/openclaw) personal AI assistant in a [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/) with **pure API-driven configuration**.

![moltworker architecture](./assets/logo.png)

> **Note:** This is an API-first architecture. All configuration (Telegram, Discord, Slack) is managed via API calls, not environment variables. Data is not persisted across container restarts.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/moltworker)

## Requirements

- [Workers Paid plan](https://www.cloudflare.com/plans/developer-platform/) ($5 USD/month) — required for Cloudflare Sandbox containers
- [Anthropic API key](https://console.anthropic.com/) — for Claude access

## What is OpenClaw?

[OpenClaw](https://github.com/openclaw/openclaw) is a personal AI assistant with a gateway architecture that connects to multiple chat platforms. Key features:

- **Control UI** - Web-based chat interface at the gateway
- **Multi-channel support** - Telegram, Discord, Slack (configured via API)
- **Agent runtime** - Extensible AI capabilities with workspace and skills
- **API-first** - All configuration managed dynamically

This project packages OpenClaw to run in a [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/) container, providing a fully managed, always-on deployment without needing to self-host.

## Architecture

```
Browser/API Client
   │
   ▼
┌──────────────────────────┐
│  Cloudflare Worker       │
│  - API Authentication    │
│  - Starts Sandbox        │
│  - Proxies HTTP/WS       │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  Cloudflare Sandbox      │
│  - OpenClaw Gateway      │
│  - Control UI            │
│  - WebSocket RPC         │
│  - Dynamic Config        │
└──────────────────────────┘
```

## Quick Start

### 1. Install and Configure

```bash
# Install dependencies
npm install

# Set required environment variables (only 3!)
npx wrangler secret put MOLTBOT_GATEWAY_TOKEN
# Enter: your-secret-api-token

npx wrangler secret put ANTHROPIC_API_KEY
# Enter: sk-ant-...

# Optional: Custom Anthropic endpoint
# npx wrangler secret put ANTHROPIC_BASE_URL
# Enter: https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/anthropic

# Deploy
npm run deploy
```

### 2. Configure Channels via API

All channel bindings are managed via API. See [API Reference](./docs/API.md) for full documentation.

**Configure Telegram:**
```bash
curl -X POST \
  -H "Authorization: Bearer <MOLTBOT_GATEWAY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"botToken": "123456:ABC-DEF..."}' \
  https://your-worker.workers.dev/api/config/telegram
```

**Configure Discord:**
```bash
curl -X POST \
  -H "Authorization: Bearer <MOLTBOT_GATEWAY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"botToken": "your-discord-token"}' \
  https://your-worker.workers.dev/api/config/discord
```

**Configure Slack:**
```bash
curl -X POST \
  -H "Authorization: Bearer <MOLTBOT_GATEWAY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"botToken": "xoxb-...", "appToken": "xapp-..."}' \
  https://your-worker.workers.dev/api/config/slack
```

### 3. Access the Gateway

Visit your worker URL to access the OpenClaw Control UI:

```
https://your-worker.workers.dev/?token=<MOLTBOT_GATEWAY_TOKEN>
```

## Environment Variables

Only **3 environment variables** are required:

| Variable | Required | Description |
|----------|----------|-------------|
| `MOLTBOT_GATEWAY_TOKEN` | Yes | Bearer token for API authentication |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `ANTHROPIC_BASE_URL` | No | Custom Anthropic endpoint (for AI Gateway) |
| `SANDBOX_SLEEP_AFTER` | No | Container sleep timeout: `'never'` (default) or duration like `'10m'` |
| `DEBUG_ROUTES` | No | Set to `'true'` to enable `/debug/*` routes |

## API Endpoints

Full API documentation: [docs/API.md](./docs/API.md)

**Gateway Management:**
- `GET /api/status` - Check gateway status
- `POST /api/gateway/restart` - Restart the gateway

**Dynamic Configuration:**
- `GET /api/config` - Get current configuration
- `POST /api/config/telegram` - Configure Telegram bot
- `POST /api/config/discord` - Configure Discord bot
- `POST /api/config/slack` - Configure Slack bot
- `DELETE /api/config/:channel` - Remove channel configuration

All API endpoints require:
```
Authorization: Bearer <MOLTBOT_GATEWAY_TOKEN>
```

## Gateway Token Authentication

The `MOLTBOT_GATEWAY_TOKEN` serves dual purposes:

1. **API Authentication**: Required as Bearer token for all API endpoints
2. **Gateway Access**: Required as query parameter for the Control UI

Access the Control UI:
```
https://your-worker.workers.dev/?token=<MOLTBOT_GATEWAY_TOKEN>
```

Connect via WebSocket:
```
wss://your-worker.workers.dev/ws?token=<MOLTBOT_GATEWAY_TOKEN>
```

## Container Lifecycle

By default, the sandbox container stays alive indefinitely (`SANDBOX_SLEEP_AFTER=never`). This is recommended because cold starts take 1-2 minutes.

To reduce costs for infrequently used deployments, you can configure the container to sleep after a period of inactivity:

```bash
npx wrangler secret put SANDBOX_SLEEP_AFTER
# Enter: 10m (or 1h, 30m, etc.)
```

**Note:** When the container sleeps and restarts, all channel configurations will be lost. You'll need to reconfigure via API.

## Debug Endpoints

Debug endpoints are available at `/debug/*` when enabled (requires `DEBUG_ROUTES=true`):

- `GET /debug/processes` - List all container processes
- `GET /debug/logs?id=<process_id>` - Get logs for a specific process
- `GET /debug/version` - Get container and moltbot version info

Enable debug routes:
```bash
npx wrangler secret put DEBUG_ROUTES
# Enter: true
```

## Local Development

```bash
npm install
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your tokens
npm run start
```

Example `.dev.vars`:
```bash
ANTHROPIC_API_KEY=sk-ant-...
MOLTBOT_GATEWAY_TOKEN=my-dev-token
DEBUG_ROUTES=true
```

### WebSocket Limitations

Local development (`wrangler dev`) has [limited WebSocket support](https://developers.cloudflare.com/workers/runtime-apis/websockets/#websockets-in-the-devtools). The gateway UI may not work fully in dev mode. Deploy to test WebSocket functionality.

## Comparison with Original

This fork differs from the upstream moltworker in the following ways:

| Feature | This Fork | Original |
|---------|-----------|----------|
| **Configuration** | API-driven | Environment variables |
| **Admin UI** | No Web UI | React SPA at `/_admin/` |
| **Channel Setup** | Runtime via API | Deploy-time via secrets |
| **Device Pairing** | Bypassed (DEV_MODE) | Required, managed via UI |
| **Environment Vars** | 3 required | 10+ optional |
| **Use Case** | Programmatic control | Manual management |

## Why API-Driven?

- ✅ **No Redeployment**: Change configuration without `wrangler deploy`
- ✅ **Simpler Architecture**: No React frontend, no asset building
- ✅ **CI/CD Friendly**: Automate channel management via scripts
- ✅ **Multi-Tenant Ready**: Each deployment can have different configs
- ✅ **Smaller Codebase**: ~40% less code

## Known Limitations

- **No Persistence**: Configuration is stored in container memory. Container restarts lose config.
- **No Device Management UI**: Device pairing is bypassed (DEV_MODE enabled by default).
- **Manual API Calls**: No GUI for configuration management.

To add persistence, consider integrating Cloudflare R2 or KV storage.

## Troubleshooting

**Gateway not starting:**
```bash
# Check logs
wrangler tail

# Restart gateway via API
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://your-worker.workers.dev/api/gateway/restart
```

**Configuration not applying:**
```bash
# Check current config
curl -H "Authorization: Bearer $TOKEN" \
  https://your-worker.workers.dev/api/config

# Restart to apply changes
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://your-worker.workers.dev/api/gateway/restart
```

**401 Unauthorized:**
- Verify `MOLTBOT_GATEWAY_TOKEN` is set: `wrangler secret list`
- Check Authorization header format: `Bearer <token>`

## Contributing

This is a demo project. For production use, consider adding:

- Configuration persistence (R2/KV)
- Web UI for API management
- Multi-user authentication
- Rate limiting

## License

MIT
