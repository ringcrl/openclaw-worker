import type { Sandbox } from '@cloudflare/sandbox';

/**
 * Environment bindings for the Moltbot Worker
 * Only 3 required environment variables for API-driven configuration
 */
export interface MoltbotEnv {
  Sandbox: DurableObjectNamespace<Sandbox>;
  // Required: API authentication
  MOLTBOT_GATEWAY_TOKEN: string; // Bearer token for all API requests
  // Required: AI provider configuration
  ANTHROPIC_API_KEY: string;
  // Optional: AI provider base URL (for AI Gateway or custom endpoints)
  ANTHROPIC_BASE_URL?: string;
  // Optional: Advanced configuration
  SANDBOX_SLEEP_AFTER?: string; // How long before sandbox sleeps: 'never' (default), or duration like '10m', '1h'
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
