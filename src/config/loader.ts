/**
 * Gemini CLI configuration file loader
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

export type ConfigScope = 'user' | 'project';

/**
 * Get the path to a Gemini CLI settings file
 */
export function getConfigPath(scope: ConfigScope, projectDir?: string): string {
  if (scope === 'user') {
    return join(homedir(), '.gemini', 'settings.json');
  } else {
    // Project scope
    const baseDir = projectDir || process.cwd();
    return join(baseDir, '.gemini', 'settings.json');
  }
}

/**
 * Load configuration from file
 * Returns null if file doesn't exist
 */
export function loadConfig(scope: ConfigScope, projectDir?: string): Record<string, unknown> | null {
  const configPath = getConfigPath(scope, projectDir);

  try {
    if (!existsSync(configPath)) {
      logger.debug(`Config file not found: ${configPath}`);
      return null;
    }

    const content = readFileSync(configPath, 'utf-8');

    // Handle empty files
    if (!content.trim()) {
      logger.warn(`Config file is empty: ${configPath}`);
      return {};
    }

    const config = JSON.parse(content);
    logger.debug(`Loaded config from: ${configPath}`);
    return config;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load config from ${configPath}:`, message);
    throw new Error(`Failed to load configuration: ${message}`);
  }
}

/**
 * Save configuration to file
 * Creates directory and file if they don't exist
 */
export function saveConfig(
  config: Record<string, unknown>,
  scope: ConfigScope,
  projectDir?: string
): void {
  const configPath = getConfigPath(scope, projectDir);

  try {
    // Create directory if it doesn't exist
    const dir = dirname(configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      logger.debug(`Created config directory: ${dir}`);
    }

    // Write config file with pretty formatting
    const content = JSON.stringify(config, null, 2);
    writeFileSync(configPath, content, 'utf-8');

    logger.info(`Saved config to: ${configPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to save config to ${configPath}:`, message);
    throw new Error(`Failed to save configuration: ${message}`);
  }
}

/**
 * Create a backup of a configuration file
 */
export function backupConfig(scope: ConfigScope, projectDir?: string): string | null {
  const configPath = getConfigPath(scope, projectDir);

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${configPath}.backup-${timestamp}`;

    const content = readFileSync(configPath, 'utf-8');
    writeFileSync(backupPath, content, 'utf-8');

    logger.info(`Created backup: ${backupPath}`);
    return backupPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to create backup:`, message);
    return null;
  }
}

/**
 * Check if a configuration file exists
 */
export function configExists(scope: ConfigScope, projectDir?: string): boolean {
  const configPath = getConfigPath(scope, projectDir);
  return existsSync(configPath);
}
