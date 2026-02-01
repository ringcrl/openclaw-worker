# OpenClaw on Cloudflare Workers (Simplified Demo)

Run [OpenClaw](https://github.com/openclaw/openclaw) personal AI assistant in a [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/).

![moltworker architecture](./assets/logo.png)

> **Note:** This is a simplified demo version with minimal dependencies. Data is not persisted across container restarts.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/moltworker)

## Requirements

- [Workers Paid plan](https://www.cloudflare.com/plans/developer-platform/) ($5 USD/month) — required for Cloudflare Sandbox containers
- [Anthropic API key](https://console.anthropic.com/) — for Claude access, or you can use AI Gateway's [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/)

## What is OpenClaw?

[OpenClaw](https://github.com/openclaw/openclaw) is a personal AI assistant with a gateway architecture that connects to multiple chat platforms. Key features:

- **Control UI** - Web-based chat interface at the gateway
- **Multi-channel support** - Telegram, Discord, Slack
- **Device pairing** - Secure DM authentication requiring explicit approval
- **Agent runtime** - Extensible AI capabilities with workspace and skills

This project packages OpenClaw to run in a [Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/) container, providing a fully managed, always-on deployment without needing to self-host.

## Architecture

```
Browser
   │
   ▼
┌──────────────────────────┐
│  Cloudflare Worker       │
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
└──────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Set your API key
npx wrangler secret put ANTHROPIC_API_KEY

# Or use AI Gateway instead (see "Optional: Cloudflare AI Gateway" below)
# npx wrangler secret put AI_GATEWAY_API_KEY
# npx wrangler secret put AI_GATEWAY_BASE_URL

# Generate and set a gateway token (required for remote access)
export MOLTBOT_GATEWAY_TOKEN=$(openssl rand -hex 32)
echo "Your gateway token: $MOLTBOT_GATEWAY_TOKEN"
echo "$MOLTBOT_GATEWAY_TOKEN" | npx wrangler secret put MOLTBOT_GATEWAY_TOKEN

# Deploy
npm run deploy
```

After deploying, open the Control UI with your token:

```
https://your-worker.workers.dev/?token=YOUR_GATEWAY_TOKEN
```

Replace `your-worker` with your actual worker subdomain and `YOUR_GATEWAY_TOKEN` with the token you generated above.

**Note:** The first request may take 1-2 minutes while the container starts.

> **Important:** For device pairing, visit the admin UI at `/_admin/` to approve new devices.

## Admin UI

Access the admin UI at `/_admin/` to:
- **Gateway Controls** - Restart the gateway process
- **Device Pairing** - View pending requests, approve devices individually or all at once, view paired devices

## Authentication

By default, OpenClaw uses **device pairing** for authentication. When a new device (browser, CLI, etc.) connects, it must be approved via the admin UI at `/_admin/`.

### Device Pairing

1. A device connects to the gateway
2. The connection is held pending until approved
3. An admin approves the device via `/_admin/`
4. The device is now paired and can connect freely

### Gateway Token (Required)

A gateway token is required to access the Control UI when hosted remotely. Pass it as a query parameter:

```
https://your-worker.workers.dev/?token=YOUR_TOKEN
wss://your-worker.workers.dev/ws?token=YOUR_TOKEN
```

**Note:** Even with a valid token, new devices still require approval via the admin UI.

For local development, set `DEV_MODE=true` in `.dev.vars` to bypass device pairing entirely.

## Container Lifecycle

By default, the sandbox container stays alive indefinitely (`SANDBOX_SLEEP_AFTER=never`). This is recommended because cold starts take 1-2 minutes.

To reduce costs for infrequently used deployments, you can configure the container to sleep after a period of inactivity:

```bash
npx wrangler secret put SANDBOX_SLEEP_AFTER
# Enter: 10m (or 1h, 30m, etc.)
```

**Note:** When the container sleeps and restarts, all paired devices and conversation history will be lost in this simplified version.

## Debug Endpoints

Debug endpoints are available at `/debug/*` when enabled (requires `DEBUG_ROUTES=true`):

- `GET /debug/processes` - List all container processes
- `GET /debug/logs?id=<process_id>` - Get logs for a specific process
- `GET /debug/version` - Get container and moltbot version info

## Optional: Chat Channels

### Telegram

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npm run deploy
```

### Discord

```bash
npx wrangler secret put DISCORD_BOT_TOKEN
npm run deploy
```

### Slack

```bash
npx wrangler secret put SLACK_BOT_TOKEN
npx wrangler secret put SLACK_APP_TOKEN
npm run deploy
```

## Optional: Cloudflare AI Gateway

You can route API requests through [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) for caching, rate limiting, analytics, and cost tracking.

### Setup

1. Create an AI Gateway in the [AI Gateway section](https://dash.cloudflare.com/?to=/:account/ai/ai-gateway/create-gateway)
2. Add a provider (e.g., Anthropic) to your gateway
3. Set the gateway secrets:

```bash
# Your provider's API key
npx wrangler secret put AI_GATEWAY_API_KEY

# Your AI Gateway endpoint URL
npx wrangler secret put AI_GATEWAY_BASE_URL
# Enter: https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic
```

4. Redeploy:

```bash
npm run deploy
```

## Local Development

```bash
npm install
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your ANTHROPIC_API_KEY
npm run start
```

For local development, create `.dev.vars`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
DEV_MODE=true           # Skips device pairing
DEBUG_ROUTES=true       # Enables /debug/* routes
```

### WebSocket Limitations

Local development with `wrangler dev` has issues proxying WebSocket connections through the sandbox. HTTP requests work but WebSocket connections may fail. Deploy to Cloudflare for full functionality.

## All Secrets Reference

| Secret | Required | Description |
|--------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | Direct Anthropic API key (or use AI Gateway) |
| `MOLTBOT_GATEWAY_TOKEN` | Yes | Gateway token for authentication |
| `AI_GATEWAY_API_KEY` | Yes* | API key for AI Gateway provider (alternative to ANTHROPIC_API_KEY) |
| `AI_GATEWAY_BASE_URL` | No | AI Gateway endpoint URL (required when using AI_GATEWAY_API_KEY) |
| `ANTHROPIC_BASE_URL` | No | Direct Anthropic API base URL (fallback) |
| `OPENAI_API_KEY` | No | OpenAI API key (alternative provider) |
| `DEV_MODE` | No | Set to `true` to bypass device pairing (local dev only) |
| `DEBUG_ROUTES` | No | Set to `true` to enable `/debug/*` routes |
| `SANDBOX_SLEEP_AFTER` | No | Container sleep timeout: `never` (default) or duration like `10m`, `1h` |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token |
| `TELEGRAM_DM_POLICY` | No | Telegram DM policy: `pairing` (default) or `open` |
| `DISCORD_BOT_TOKEN` | No | Discord bot token |
| `DISCORD_DM_POLICY` | No | Discord DM policy: `pairing` (default) or `open` |
| `SLACK_BOT_TOKEN` | No | Slack bot token |
| `SLACK_APP_TOKEN` | No | Slack app token |

## Troubleshooting

**`npm run dev` fails with an `Unauthorized` error:** You need to enable Cloudflare Containers in the [Containers dashboard](https://dash.cloudflare.com/?to=/:account/workers/containers)

**Gateway fails to start:** Check `npx wrangler secret list` and `npx wrangler tail`

**Config changes not working:** Edit the `# Build cache bust:` comment in `Dockerfile` and redeploy

**Slow first request:** Cold starts take 1-2 minutes. Subsequent requests are faster.

**Devices not appearing in admin UI:** Device list commands take 10-15 seconds due to WebSocket connection overhead. Wait and refresh.

**WebSocket issues in local development:** `wrangler dev` has known limitations with WebSocket proxying through the sandbox. Deploy to Cloudflare for full functionality.

## Links

- [OpenClaw](https://github.com/openclaw/openclaw)
- [OpenClaw Docs](https://docs.openclaw.ai/)
- [Cloudflare Sandbox Docs](https://developers.cloudflare.com/sandbox/)
