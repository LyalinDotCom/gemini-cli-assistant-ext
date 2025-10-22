/**
 * Natural language configuration instruction parser
 */

import { logger } from '../utils/logger.js';

export interface ConfigChange {
  path: string;
  value: unknown;
  operation: 'set' | 'add' | 'remove' | 'toggle';
}

/**
 * Parse natural language configuration instructions
 *
 * Examples:
 * - "enable vim mode" -> set general.vimMode to true
 * - "disable auto update" -> set general.disableAutoUpdate to true
 * - "set theme to GitHub" -> set ui.theme to "GitHub"
 * - "add MCP server my-server with command node server.js" -> add to mcpServers
 * - "use model gemini-2.0-flash" -> set model.name to "gemini-2.0-flash"
 */
export function parseConfigInstruction(instruction: string): ConfigChange[] {
  const lowerInstruction = instruction.toLowerCase().trim();
  const originalInstruction = instruction.trim();
  const changes: ConfigChange[] = [];

  logger.debug(`Parsing instruction: "${instruction}"`);

  // Remove common articles and prepositions for better parsing
  const cleanedLower = lowerInstruction.replace(/\b(the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();

  // Pattern: enable/turn on X
  if (cleanedLower.match(/^(enable|turn on)\s+(.+)$/)) {
    const setting = cleanedLower.replace(/^(enable|turn on)\s+/, '');
    const path = mapSettingToPath(setting, true);
    if (path) {
      changes.push({ path, value: true, operation: 'set' });
    }
  }
  // Pattern: disable/turn off X
  else if (cleanedLower.match(/^(disable|turn off)\s+(.+)$/)) {
    const setting = cleanedLower.replace(/^(disable|turn off)\s+/, '');
    const path = mapSettingToPath(setting, false);
    if (path) {
      changes.push({ path, value: true, operation: 'set' });
    }
  }
  // Pattern: set X to Y
  else if (cleanedLower.match(/^set\s+(.+?)\s+to\s+(.+)$/)) {
    const lowerMatch = cleanedLower.match(/^set\s+(.+?)\s+to\s+(.+)$/);
    const originalMatch = originalInstruction.match(/^set\s+(?:the\s+|a\s+|an\s+)?(.+?)\s+to\s+(.+)$/i);
    if (lowerMatch && originalMatch) {
      const setting = lowerMatch[1].trim();
      const value = originalMatch[2].trim(); // Use original case for value
      const path = mapSettingToPath(setting);
      if (path) {
        changes.push({ path, value: parseValue(value), operation: 'set' });
      }
    }
  }
  // Pattern: use/select X Y (e.g., "use model gemini-2.0-flash")
  else if (cleanedLower.match(/^(use|select)\s+(.+?)\s+(.+)$/)) {
    const lowerMatch = cleanedLower.match(/^(use|select)\s+(.+?)\s+(.+)$/);
    const originalMatch = originalInstruction.match(/^(use|select)\s+(?:the\s+|a\s+|an\s+)?(.+?)\s+(.+)$/i);
    if (lowerMatch && originalMatch) {
      const setting = lowerMatch[2].trim();
      const value = originalMatch[3].trim(); // Use original case for value
      const path = mapSettingToPath(`${setting}`);
      if (path) {
        changes.push({ path, value: parseValue(value), operation: 'set' });
      }
    }
  }
  // Pattern: add MCP server
  else if (lowerInstruction.includes('add mcp server') || lowerInstruction.includes('add server')) {
    const serverChange = parseMCPServerAddition(instruction);
    if (serverChange) {
      changes.push(serverChange);
    }
  }

  if (changes.length === 0) {
    logger.warn(`Could not parse instruction: "${instruction}"`);
  } else {
    logger.debug(`Parsed ${changes.length} config changes`);
  }

  return changes;
}

/**
 * Map common setting names to configuration paths
 */
function mapSettingToPath(setting: string, isEnable?: boolean): string | null {
  const normalized = setting.replace(/[-\s]/g, '').toLowerCase();

  // Common settings map
  const settingsMap: Record<string, string> = {
    // General
    vimmode: 'general.vimMode',
    vim: 'general.vimMode',
    autoupdate: 'general.disableAutoUpdate',
    updates: 'general.disableAutoUpdate',
    promptcompletion: 'general.enablePromptCompletion',
    checkpointing: 'general.checkpointing.enabled',
    checkpoint: 'general.checkpointing.enabled',

    // UI
    theme: 'ui.theme',
    banner: 'ui.hideBanner',
    linenumbers: 'ui.showLineNumbers',
    citations: 'ui.showCitations',
    fullwidth: 'ui.useFullWidth',
    accessibility: 'ui.accessibility',

    // Model
    model: 'model.name',
    maxturns: 'model.maxSessionTurns',
    sessionturns: 'model.maxSessionTurns',

    // Tools
    sandbox: 'tools.sandbox',
    autoaccept: 'tools.autoAccept',
    interactiveshell: 'tools.shell.enableInteractiveShell',
    ripgrep: 'tools.useRipgrep',

    // Context
    gitignore: 'context.fileFiltering.respectGitIgnore',
    geminiignore: 'context.fileFiltering.respectGeminiIgnore',

    // Privacy
    telemetry: 'privacy.usageStatisticsEnabled',
    statistics: 'privacy.usageStatisticsEnabled',
  };

  let path = settingsMap[normalized];

  // Handle special cases for enable/disable
  if (isEnable !== undefined) {
    // For "disable auto update", we set disableAutoUpdate to true
    if (normalized.includes('update')) {
      return 'general.disableAutoUpdate';
    }
    // For other disable/enable, invert if the setting name contains "disable"
    if (path && path.includes('disable') && isEnable === true) {
      // "enable auto update" = set disableAutoUpdate to false
      return path;
    }
  }

  if (!path) {
    logger.warn(`Unknown setting: "${setting}"`);
  }

  return path || null;
}

/**
 * Parse a value from string
 */
function parseValue(value: string): unknown {
  const trimmed = value.trim();

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Remove quotes if present
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Return as string
  return trimmed;
}

/**
 * Parse MCP server addition instruction
 * Example: "add MCP server my-server with command node server.js"
 */
function parseMCPServerAddition(instruction: string): ConfigChange | null {
  // Extract server name
  const nameMatch = instruction.match(/server\s+([a-z0-9-_]+)/i);
  if (!nameMatch) {
    logger.warn('Could not extract server name from instruction');
    return null;
  }

  const serverName = nameMatch[1];

  // Extract command
  const commandMatch = instruction.match(/(?:command|run)\s+(.+?)(?:\s+with\s+args|\s+args:|\s*$)/i);
  if (!commandMatch) {
    logger.warn('Could not extract command from instruction');
    return null;
  }

  const command = commandMatch[1].trim();

  // Extract args if present
  const argsMatch = instruction.match(/args?:?\s+\[?(.+?)\]?\s*$/i);
  const args = argsMatch ? argsMatch[1].split(/[,\s]+/).map(a => a.trim()) : [];

  const serverConfig = {
    command,
    ...(args.length > 0 ? { args } : {}),
  };

  return {
    path: `mcpServers.${serverName}`,
    value: serverConfig,
    operation: 'add',
  };
}
