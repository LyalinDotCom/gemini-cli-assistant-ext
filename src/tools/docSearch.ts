/**
 * Documentation search MCP tool
 */

import { z } from 'zod';
import { loadDocIndex, getCategories } from '../docs/index.js';
import { searchDocuments } from '../docs/search.js';
import { logger } from '../utils/logger.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Input schema for the search tool
export const searchDocsInputSchema = {
  query: z.string().describe('The search query or question about Gemini CLI'),
  category: z
    .string()
    .optional()
    .describe(
      'Filter by documentation category (cli, tools, get-started, core, extensions, ide-integration, etc.)'
    ),
  maxResults: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe('Maximum number of results to return (1-20, default: 5)'),
};

// Output schema
export const searchDocsOutputSchema = {
  results: z.array(
    z.object({
      title: z.string(),
      excerpt: z.string(),
      liveUrl: z.string(),
      category: z.string(),
      relevanceScore: z.number(),
      matchedHeadings: z.array(z.string()),
    })
  ),
  totalResults: z.number(),
  categories: z.array(z.string()).optional(),
};

/**
 * Execute documentation search
 */
export async function searchGeminiDocs(params: {
  query: string;
  category?: string;
  maxResults?: number;
}): Promise<CallToolResult> {
  try {
    logger.info(`Searching docs for: "${params.query}"`);

    // Load documentation index
    const index = loadDocIndex();

    // Get available categories
    const allCategories = getCategories(index);

    // Validate category if provided
    if (params.category && !allCategories.includes(params.category)) {
      logger.warn(`Invalid category: ${params.category}`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: `Invalid category: ${params.category}`,
              availableCategories: allCategories,
            }),
          },
        ],
        isError: true,
      };
    }

    // Perform search
    const searchResults = searchDocuments(index.documents, {
      query: params.query,
      category: params.category,
      maxResults: params.maxResults || 5,
    });

    // Format results
    const results = searchResults.map((result) => ({
      title: result.document.title,
      excerpt: result.excerpt,
      liveUrl: result.document.liveUrl,
      category: result.document.category,
      relevanceScore: Math.round(result.relevanceScore * 100) / 100,
      matchedHeadings: result.matchedHeadings,
    }));

    const output = {
      results,
      totalResults: results.length,
    };

    logger.info(`Found ${results.length} results`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ...output,
            query: params.query,
            ...(params.category ? { filteredByCategory: params.category } : {}),
          }, null, 2),
        },
      ],
      structuredContent: output,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Search error:', errorMessage);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: errorMessage,
            query: params.query,
          }),
        },
      ],
      isError: true,
    };
  }
}
