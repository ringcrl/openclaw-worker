import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { ensureMoltbotGateway, findExistingMoltbotProcess } from '../gateway';
import { configApi } from './config-api';

/**
 * API routes with Bearer token authentication
 * 
 * All API endpoints require:
 *   Authorization: Bearer <MOLTBOT_GATEWAY_TOKEN>
 */
const api = new Hono<AppEnv>();

// Middleware: Verify Bearer token for ALL API routes
api.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
      hint: 'Use: Authorization: Bearer <MOLTBOT_GATEWAY_TOKEN>',
    }, 401);
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  
  if (token !== c.env.MOLTBOT_GATEWAY_TOKEN) {
    return c.json({
      error: 'Unauthorized',
      message: 'Invalid token',
    }, 401);
  }

  return next();
});

// GET /api/status - Gateway status
api.get('/status', async (c) => {
  const sandbox = c.get('sandbox');

  try {
    const existingProcess = await findExistingMoltbotProcess(sandbox);
    
    if (!existingProcess) {
      return c.json({
        status: 'stopped',
        ready: false,
      });
    }

    return c.json({
      status: existingProcess.status,
      ready: existingProcess.status === 'running',
      processId: existingProcess.id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

// POST /api/gateway/restart - Restart the gateway
api.post('/gateway/restart', async (c) => {
  const sandbox = c.get('sandbox');

  try {
    const existingProcess = await findExistingMoltbotProcess(sandbox);
    
    if (existingProcess) {
      console.log('Killing existing gateway process:', existingProcess.id);
      try {
        await existingProcess.kill();
      } catch (killErr) {
        console.error('Error killing process:', killErr);
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    const bootPromise = ensureMoltbotGateway(sandbox, c.env).catch((err) => {
      console.error('Gateway restart failed:', err);
    });
    c.executionCtx.waitUntil(bootPromise);

    return c.json({
      success: true,
      message: existingProcess 
        ? 'Gateway process killed, new instance starting...'
        : 'No existing process found, starting new instance...',
      previousProcessId: existingProcess?.id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

// Mount dynamic configuration API
api.route('/config', configApi);

export { api };
