import type { Context, Next } from 'hono';
import type { AppEnv, MoltbotEnv } from '../types';

/**
 * Options for creating an access middleware
 */
export interface AccessMiddlewareOptions {
  /** Response type: 'json' for API routes, 'html' for UI routes */
  type: 'json' | 'html';
  /** Whether to redirect to login when JWT is missing (only for 'html' type) */
  redirectOnMissing?: boolean;
}

/**
 * Check if running in development mode (skips CF Access auth)
 */
export function isDevMode(env: MoltbotEnv): boolean {
  return env.DEV_MODE === 'true';
}

/**
 * Extract JWT from request headers or cookies
 */
export function extractJWT(c: Context<AppEnv>): string | null {
  const jwtHeader = c.req.header('CF-Access-JWT-Assertion');
  const jwtCookie = c.req.raw.headers.get('Cookie')
    ?.split(';')
    .find(cookie => cookie.trim().startsWith('CF_Authorization='))
    ?.split('=')[1];

  return jwtHeader || jwtCookie || null;
}

/**
 * Create a Cloudflare Access authentication middleware
 * 
 * @param options - Middleware options
 * @returns Hono middleware function
 */
export function createAccessMiddleware(_options: AccessMiddlewareOptions) {
  return async (c: Context<AppEnv>, next: Next) => {
    // Skip auth in dev mode
    if (isDevMode(c.env)) {
      c.set('accessUser', { email: 'dev@localhost', name: 'Dev User' });
      return next();
    }

    // Cloudflare Access disabled: allow all requests
    c.set('accessUser', { email: 'anonymous@localhost', name: 'Anonymous' });
    return next();
  };
}
