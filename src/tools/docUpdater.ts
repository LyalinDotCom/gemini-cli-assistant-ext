import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { updateDocsIndex } from '../docs/updater.js';
import { logger } from '../utils/logger.js';

export const updateDocsInputSchema = {};

export const updateDocsOutputSchema = {
  documentCount: z.number(),
  categories: z.record(z.number()),
  llmsPath: z.string(),
  indexPath: z.string(),
  readmePath: z.string(),
  buildDate: z.string(),
  version: z.string(),
};

export async function updateGeminiDocs(): Promise<CallToolResult> {
  try {
    logger.info('Refreshing Gemini CLI documentation cache from llms.txt');
    const result = await updateDocsIndex();

    const response = {
      documentCount: result.documentCount,
      categories: result.categories,
      llmsPath: result.llmsPath,
      indexPath: result.indexPath,
      readmePath: result.readmePath,
      buildDate: result.buildDate,
      version: result.version,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ message: 'Documentation cache updated', ...response }, null, 2),
        },
      ],
      structuredContent: response,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to refresh documentation cache:', message);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: message,
          }),
        },
      ],
      isError: true,
    };
  }
}
