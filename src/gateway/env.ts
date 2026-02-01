import type { MoltbotEnv } from '../types';

/**
 * Build environment variables to pass to the Moltbot container process
 * Only passes the 3 core environment variables. All other configuration
 * (Telegram, Discord, Slack, etc.) is managed dynamically via API.
 * 
 * @param env - Worker environment bindings
 * @returns Environment variables record
 */
export function buildEnvVars(env: MoltbotEnv): Record<string, string> {
  const envVars: Record<string, string> = {};

  // Required: AI provider credentials
  envVars.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  
  // Optional: AI provider base URL
  if (env.ANTHROPIC_BASE_URL) {
    envVars.ANTHROPIC_BASE_URL = env.ANTHROPIC_BASE_URL.replace(/\/+$/, '');
  }

  // Required: Gateway authentication token (map to container's expected name)
  envVars.CLAWDBOT_GATEWAY_TOKEN = env.MOLTBOT_GATEWAY_TOKEN;

  // Force DEV_MODE to skip device pairing (API-only access model)
  envVars.CLAWDBOT_DEV_MODE = 'true';

  return envVars;
}
