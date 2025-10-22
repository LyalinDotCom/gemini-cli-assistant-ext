/**
 * Configuration editor MCP tool
 */

import { z } from 'zod';
import { editConfig } from '../config/editor.js';
import { logger } from '../utils/logger.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Input schema
export const configEditorInputSchema = {
  instruction: z
    .string()
    .describe(
      'Natural language instruction for configuration change (e.g., "enable vim mode", "set theme to GitHub", "use model gemini-2.0-flash")'
    ),
  scope: z
    .enum(['user', 'project'])
    .optional()
    .default('user')
    .describe('Configuration scope: "user" (~/.gemini/settings.json) or "project" (.gemini/settings.json). Defaults to user-wide.'),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe('Preview changes without applying them'),
};

// Output schema
export const configEditorOutputSchema = {
  success: z.boolean(),
  changes: z.array(
    z.object({
      path: z.string(),
      oldValue: z.any(),
      newValue: z.any(),
    })
  ),
  configPath: z.string().optional(),
  preview: z.string(),
  warnings: z.array(z.string()),
  backupPath: z.string().optional(),
};

/**
 * Execute configuration edit
 */
export async function configureGeminiCli(params: {
  instruction: string;
  scope: 'user' | 'project';
  dryRun?: boolean;
}): Promise<CallToolResult> {
  try {
    logger.info(`Config edit request: "${params.instruction}" (${params.scope})`);

    // Execute the config edit
    const result = await editConfig(params.instruction, params.scope, params.dryRun || false);

    // Format the response
    const output = {
      success: result.success,
      changes: result.changes,
      ...(result.configPath ? { configPath: result.configPath } : {}),
      preview: result.preview,
      warnings: result.warnings,
      ...(result.backupPath ? { backupPath: result.backupPath } : {}),
    };

    logger.info(`Config edit result: ${result.success ? 'success' : 'failed'}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(output, null, 2),
        },
      ],
      structuredContent: output,
      isError: !result.success,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Config editor error:', errorMessage);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            instruction: params.instruction,
          }),
        },
      ],
      isError: true,
    };
  }
}
