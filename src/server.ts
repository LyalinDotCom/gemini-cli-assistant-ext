#!/usr/bin/env node

/**
 * Gemini CLI Assistant MCP Server
 *
 * Provides self-documentation and configuration management tools for Gemini CLI
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger, LogLevel } from './utils/logger.js';
import {
  searchGeminiDocs,
  searchDocsInputSchema,
  searchDocsOutputSchema,
} from './tools/docSearch.js';
import {
  configureGeminiCli,
  configEditorInputSchema,
  configEditorOutputSchema,
} from './tools/configEditor.js';
import {
  queryGeminiConfig,
  configQueryInputSchema,
  configQueryOutputSchema,
} from './tools/configQuery.js';

// Set log level from environment
if (process.env.DEBUG === 'true') {
  logger.setLevel(LogLevel.DEBUG);
}

/**
 * Main server initialization
 */
async function main() {
  logger.info('Starting Gemini CLI Assistant MCP Server...');

  // Create MCP server instance
  const server = new McpServer({
    name: 'gemini-cli-assistant',
    version: '1.0.0',
  });

  logger.info('Registering tools...');

  // Register documentation search tool
  server.registerTool(
    'search_gemini_docs',
    {
      title: 'Search Gemini CLI Documentation',
      description:
        'Search the Gemini CLI documentation to answer questions about how Gemini CLI works. ' +
        'Returns relevant documentation excerpts with links to full documentation.',
      inputSchema: searchDocsInputSchema,
      outputSchema: searchDocsOutputSchema,
    },
    async (params) => {
      return await searchGeminiDocs(params);
    }
  );

  logger.debug('Registered tool: search_gemini_docs');

  // Register configuration editor tool
  server.registerTool(
    'configure_gemini_cli',
    {
      title: 'Configure Gemini CLI',
      description:
        'Configure Gemini CLI settings using natural language instructions. ' +
        'Can modify user-wide settings (~/.gemini/settings.json) or project-specific settings (.gemini/settings.json). ' +
        'Supports instructions like "enable vim mode", "set theme to GitHub", "use model gemini-2.0-flash", etc.',
      inputSchema: configEditorInputSchema,
      outputSchema: configEditorOutputSchema,
    },
    async (params) => {
      return await configureGeminiCli(params);
    }
  );

  logger.debug('Registered tool: configure_gemini_cli');

  // Register configuration query tool
  server.registerTool(
    'query_gemini_config',
    {
      title: 'Query Gemini CLI Configuration',
      description:
        'Query current Gemini CLI configuration settings. ' +
        'Can query specific settings or retrieve the entire configuration. ' +
        'Supports user, project, or merged scope.',
      inputSchema: configQueryInputSchema,
      outputSchema: configQueryOutputSchema,
    },
    async (params) => {
      return await queryGeminiConfig(params);
    }
  );

  logger.debug('Registered tool: query_gemini_config');

  logger.info('All tools registered successfully');

  // Create stdio transport
  const transport = new StdioServerTransport();

  logger.info('Connecting to stdio transport...');

  // Connect server to transport
  await server.connect(transport);

  logger.info('✓ Gemini CLI Assistant MCP Server is running');
  logger.info('Tools available:');
  logger.info('  - search_gemini_docs: Search Gemini CLI documentation');
  logger.info('  - configure_gemini_cli: Edit Gemini CLI configuration');
  logger.info('  - query_gemini_config: Query Gemini CLI configuration');

  // Handle process termination
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await transport.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await transport.close();
    process.exit(0);
  });
}

// Start the server
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
