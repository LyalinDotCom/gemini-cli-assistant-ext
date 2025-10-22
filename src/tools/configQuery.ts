/**
 * Configuration query MCP tool
 */

import { z } from 'zod';
import { loadConfig, configExists, getConfigPath, type ConfigScope } from '../config/loader.js';
import { logger } from '../utils/logger.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Input schema
export const configQueryInputSchema = {
  setting: z
    .string()
    .optional()
    .describe('Specific setting path to query (e.g., "ui.theme", "mcpServers"). Omit to get full config.'),
  scope: z
    .enum(['user', 'project', 'merged'])
    .optional()
    .default('merged')
    .describe('Configuration scope: "user", "project", or "merged" (default)'),
};

// Output schema
export const configQueryOutputSchema = {
  value: z.any(),
  source: z.string().optional(),
  exists: z.boolean(),
  configPath: z.string().optional(),
};

/**
 * Get a nested value from an object by path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Execute configuration query
 */
export async function queryGeminiConfig(params: {
  setting?: string;
  scope?: 'user' | 'project' | 'merged';
}): Promise<CallToolResult> {
  try {
    const scope = params.scope || 'merged';
    logger.info(`Config query: setting="${params.setting || 'all'}", scope=${scope}`);

    let value: unknown;
    let source: string | undefined;
    let configPath: string | undefined;
    let exists = false;

    if (scope === 'merged') {
      // Load both user and project configs and merge them
      const userConfig = loadConfig('user');
      const projectConfig = loadConfig('project');

      // Merge configs (project overrides user)
      const mergedConfig = { ...userConfig, ...projectConfig };

      if (params.setting) {
        value = getNestedValue(mergedConfig, params.setting);
        exists = value !== undefined;

        // Determine source
        if (projectConfig && getNestedValue(projectConfig, params.setting) !== undefined) {
          source = 'project';
          configPath = getConfigPath('project');
        } else if (userConfig && getNestedValue(userConfig, params.setting) !== undefined) {
          source = 'user';
          configPath = getConfigPath('user');
        } else {
          source = 'default';
        }
      } else {
        value = mergedConfig;
        exists = true;
        source = 'merged';
      }
    } else {
      // Load specific scope
      const config = loadConfig(scope as ConfigScope);
      configPath = getConfigPath(scope as ConfigScope);
      exists = configExists(scope as ConfigScope);

      if (params.setting && config) {
        value = getNestedValue(config, params.setting);
      } else {
        value = config;
      }

      source = scope;
    }

    const output = {
      value,
      ...(source ? { source } : {}),
      exists,
      ...(configPath ? { configPath } : {}),
    };

    logger.info(`Config query result: exists=${exists}, source=${source}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(output, null, 2),
        },
      ],
      structuredContent: output,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Config query error:', errorMessage);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: errorMessage,
            setting: params.setting,
            scope: params.scope,
          }),
        },
      ],
      isError: true,
    };
  }
}
