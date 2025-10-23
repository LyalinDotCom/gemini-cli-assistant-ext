#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger, LogLevel } from './utils/logger.js';
import packageJson from '../package.json' with { type: 'json' };
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
import {
  updateGeminiDocs,
  updateDocsInputSchema,
  updateDocsOutputSchema,
} from './tools/docUpdater.js';

// Set log level from environment
if (process.env.DEBUG === 'true') {
  logger.setLevel(LogLevel.DEBUG);
}

/**
 * Main server initialization
 */
async function main() {
  const rawArgs = process.argv.slice(2);
  const firstArg = rawArgs[0];

  if (firstArg && !firstArg.startsWith('-')) {
    if (firstArg === 'mcp') {
      process.argv.splice(2, 1);
    } else {
      console.error(`Unknown command: ${firstArg}`);
      console.log('Usage:');
      console.log('  gemini-cli-assistant mcp          Start the MCP server');
      console.log('  gemini-cli-assistant --help       Show help information');
      console.log('  gemini-cli-assistant --version    Show the package version');
      process.exit(1);
    }
  }

  const serverName =
    (packageJson?.name as string | undefined) ?? 'gemini-cli-assistant';
  const serverVersion =
    (packageJson?.version as string | undefined) ?? '0.0.0';

  if (process.argv.includes('--version')) {
    console.log(serverVersion);
    return;
  }

  if (process.argv.includes('--help')) {
    console.log(`${serverName} MCP server (v${serverVersion})`);
    console.log('Commands:');
    console.log('  mcp        Start the MCP server over stdio');
    console.log('');
    console.log('Flags:');
    console.log('  --help     Show this message');
    console.log('  --version  Print the package version');
    console.log('');
    console.log('Use via npx: npx -y github:LyalinDotCom/gemini-cli-assistant-ext mcp');
    return;
  }

  logger.info(`Starting ${serverName} MCP Server (v${serverVersion})...`);

  // Create MCP server instance
  const server = new McpServer({
    name: serverName,
    version: serverVersion,
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

  // Register documentation refresh tool
  server.registerTool(
    'update_gemini_docs',
    {
      title: 'Refresh Gemini CLI Documentation Cache',
      description:
        'Downloads the latest documentation from geminicli.com/llms.txt and rebuilds the local search index.',
      inputSchema: updateDocsInputSchema,
      outputSchema: updateDocsOutputSchema,
    },
    async () => {
      return await updateGeminiDocs();
    }
  );

  logger.debug('Registered tool: update_gemini_docs');

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
  logger.info('  - update_gemini_docs: Refresh local documentation cache');

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
