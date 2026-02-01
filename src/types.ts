import type { Sandbox } from '@cloudflare/sandbox';

/**
 * Environment bindings for the Moltbot Worker
 */
export interface MoltbotEnv {
  Sandbox: DurableObjectNamespace<Sandbox>;
  ASSETS: Fetcher; // Assets binding for admin UI static files
  // AI Gateway configuration (preferred)
  AI_GATEWAY_API_KEY?: string; // API key for the provider configured in AI Gateway
  AI_GATEWAY_BASE_URL?: string; // AI Gateway URL (e.g., https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic)
  // Legacy direct provider configuration (fallback)
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  MOLTBOT_GATEWAY_TOKEN?: string; // Gateway token (mapped to CLAWDBOT_GATEWAY_TOKEN for container)

  CLAWDBOT_BIND_MODE?: string;
  DEV_MODE?: string; // Set to 'true' for local dev (skips moltbot device pairing)
  DEBUG_ROUTES?: string; // Set to 'true' to enable /debug/* routes
  SANDBOX_SLEEP_AFTER?: string; // How long before sandbox sleeps: 'never' (default), or duration like '10m', '1h'
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_DM_POLICY?: string;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_DM_POLICY?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_APP_TOKEN?: string;
}

/**
 * Hono app environment type
 */
export type AppEnv = {
  Bindings: MoltbotEnv;
  Variables: {
    sandbox: Sandbox;
  };
};
