import { describe, it, expect } from 'vitest';
import { buildEnvVars } from './env';
import { createMockEnv } from '../test-utils';

describe('buildEnvVars', () => {
  it('includes ANTHROPIC_API_KEY when set', () => {
    const env = createMockEnv({ ANTHROPIC_API_KEY: 'sk-test-key' });
    const result = buildEnvVars(env);
    expect(result.ANTHROPIC_API_KEY).toBe('sk-test-key');
  });

  it('includes ANTHROPIC_BASE_URL when set', () => {
    const env = createMockEnv({
      ANTHROPIC_API_KEY: 'sk-test-key',
      ANTHROPIC_BASE_URL: 'https://gateway.ai.cloudflare.com/v1/123/my-gw/anthropic',
    });
    const result = buildEnvVars(env);
    expect(result.ANTHROPIC_API_KEY).toBe('sk-test-key');
    expect(result.ANTHROPIC_BASE_URL).toBe('https://gateway.ai.cloudflare.com/v1/123/my-gw/anthropic');
  });

  it('removes trailing slash from ANTHROPIC_BASE_URL', () => {
    const env = createMockEnv({
      ANTHROPIC_API_KEY: 'sk-test-key',
      ANTHROPIC_BASE_URL: 'https://gateway.ai.cloudflare.com/v1/123/my-gw/anthropic/',
    });
    const result = buildEnvVars(env);
    expect(result.ANTHROPIC_BASE_URL).toBe('https://gateway.ai.cloudflare.com/v1/123/my-gw/anthropic');
  });

  it('maps MOLTBOT_GATEWAY_TOKEN to CLAWDBOT_GATEWAY_TOKEN for container', () => {
    const env = createMockEnv({
      ANTHROPIC_API_KEY: 'sk-test-key',
      MOLTBOT_GATEWAY_TOKEN: 'my-token',
    });
    const result = buildEnvVars(env);
    expect(result.CLAWDBOT_GATEWAY_TOKEN).toBe('my-token');
  });

  it('combines all env vars correctly', () => {
    const env = createMockEnv({
      ANTHROPIC_API_KEY: 'sk-key',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      MOLTBOT_GATEWAY_TOKEN: 'token',
    });
    const result = buildEnvVars(env);
    
    expect(result).toEqual({
      ANTHROPIC_API_KEY: 'sk-key',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      CLAWDBOT_GATEWAY_TOKEN: 'token',
    });
  });
});
