import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { ensureMoltbotGateway, findExistingMoltbotProcess } from '../gateway';

const CONFIG_DIR = '/root/.clawdbot';
const CONFIG_FILE = `${CONFIG_DIR}/clawdbot.json`;

/**
 * Dynamic Configuration API
 * 
 * All channel bindings (Telegram, Discord, Slack) are managed via API
 * instead of environment variables. This allows runtime configuration
 * without redeploying the worker.
 */
const configApi = new Hono<AppEnv>();

/**
 * Helper: Update config file in container
 */
async function updateConfigFile(
  sandbox: any,
  updates: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Read current config
    const readProc = await sandbox.startProcess(`cat ${CONFIG_FILE} || echo '{}'`);
    await new Promise(r => setTimeout(r, 1000));
    const logs = await readProc.getLogs();
    
    let config: any = {};
    try {
      config = JSON.parse(logs.stdout || '{}');
    } catch {
      config = {};
    }

    // Merge updates
    config = deepMerge(config, updates);

    // Write back to file
    const configJson = JSON.stringify(config, null, 2);
    const writeCmd = `echo '${configJson.replace(/'/g, "'\\''")}' > ${CONFIG_FILE}`;
    const writeProc = await sandbox.startProcess(writeCmd);
    await new Promise(r => setTimeout(r, 1000));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper: Deep merge objects
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Helper: Restart gateway to apply config changes
 */
async function restartGateway(sandbox: any, env: any): Promise<void> {
  const existingProcess = await findExistingMoltbotProcess(sandbox);
  if (existingProcess) {
    console.log('Killing existing gateway to apply config changes...');
    try {
      await existingProcess.kill();
    } catch (err) {
      console.error('Error killing process:', err);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  await ensureMoltbotGateway(sandbox, env);
}

// GET /api/config - Get current configuration
configApi.get('/', async (c) => {
  const sandbox = c.get('sandbox');

  try {
    await ensureMoltbotGateway(sandbox, c.env);
    
    const proc = await sandbox.startProcess(`cat ${CONFIG_FILE} || echo '{}'`);
    await new Promise(r => setTimeout(r, 1000));
    const logs = await proc.getLogs();
    
    let config: any = {};
    try {
      config = JSON.parse(logs.stdout || '{}');
    } catch {
      config = {};
    }

    // Redact sensitive tokens
    if (config.channels) {
      if (config.channels.telegram?.botToken) {
        config.channels.telegram.botToken = '***REDACTED***';
      }
      if (config.channels.discord?.botToken) {
        config.channels.discord.botToken = '***REDACTED***';
      }
      if (config.channels.slack?.botToken) {
        config.channels.slack.botToken = '***REDACTED***';
      }
      if (config.channels.slack?.appToken) {
        config.channels.slack.appToken = '***REDACTED***';
      }
    }

    return c.json({ config });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

// POST /api/config/telegram - Configure Telegram bot
configApi.post('/telegram', async (c) => {
  const sandbox = c.get('sandbox');

  try {
    const { botToken, dmPolicy } = await c.req.json();

    if (!botToken) {
      return c.json({ error: 'botToken is required' }, 400);
    }

    await ensureMoltbotGateway(sandbox, c.env);

    const updates = {
      channels: {
        telegram: {
          enabled: true,
          botToken,
          dm: {
            policy: dmPolicy || 'pair-first',
          },
        },
      },
    };

    const result = await updateConfigFile(sandbox, updates);
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }

    // Restart gateway to apply changes
    await restartGateway(sandbox, c.env);

    return c.json({
      success: true,
      message: 'Telegram bot configured and gateway restarted',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

// POST /api/config/discord - Configure Discord bot
configApi.post('/discord', async (c) => {
  const sandbox = c.get('sandbox');

  try {
    const { botToken, dmPolicy } = await c.req.json();

    if (!botToken) {
      return c.json({ error: 'botToken is required' }, 400);
    }

    await ensureMoltbotGateway(sandbox, c.env);

    const updates = {
      channels: {
        discord: {
          enabled: true,
          botToken,
          dm: {
            policy: dmPolicy || 'pair-first',
          },
        },
      },
    };

    const result = await updateConfigFile(sandbox, updates);
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }

    await restartGateway(sandbox, c.env);

    return c.json({
      success: true,
      message: 'Discord bot configured and gateway restarted',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

// POST /api/config/slack - Configure Slack bot
configApi.post('/slack', async (c) => {
  const sandbox = c.get('sandbox');

  try {
    const { botToken, appToken } = await c.req.json();

    if (!botToken || !appToken) {
      return c.json({ error: 'Both botToken and appToken are required' }, 400);
    }

    await ensureMoltbotGateway(sandbox, c.env);

    const updates = {
      channels: {
        slack: {
          enabled: true,
          botToken,
          appToken,
        },
      },
    };

    const result = await updateConfigFile(sandbox, updates);
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }

    await restartGateway(sandbox, c.env);

    return c.json({
      success: true,
      message: 'Slack bot configured and gateway restarted',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

// DELETE /api/config/:channel - Remove a channel configuration
configApi.delete('/:channel', async (c) => {
  const sandbox = c.get('sandbox');
  const channel = c.req.param('channel');

  if (!['telegram', 'discord', 'slack'].includes(channel)) {
    return c.json({ error: 'Invalid channel. Must be: telegram, discord, or slack' }, 400);
  }

  try {
    await ensureMoltbotGateway(sandbox, c.env);

    const updates = {
      channels: {
        [channel]: {
          enabled: false,
        },
      },
    };

    const result = await updateConfigFile(sandbox, updates);
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }

    await restartGateway(sandbox, c.env);

    return c.json({
      success: true,
      message: `${channel} configuration removed and gateway restarted`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

export { configApi };
