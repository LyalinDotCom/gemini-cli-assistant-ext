/**
 * Configuration editor with validation
 */

import { loadConfig, saveConfig, backupConfig, getConfigPath, type ConfigScope } from './loader.js';
import { parseConfigInstruction, type ConfigChange } from './parser.js';
import { logger } from '../utils/logger.js';

export interface ConfigEditResult {
  success: boolean;
  changes: Array<{
    path: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  configPath: string;
  preview: string;
  warnings: string[];
  backupPath?: string;
}

/**
 * Apply a configuration change to a config object
 */
function applyChange(
  config: Record<string, unknown>,
  change: ConfigChange
): { oldValue: unknown; newValue: unknown } {
  const pathParts = change.path.split('.');
  let current: any = config;

  // Navigate to the parent object
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  const finalKey = pathParts[pathParts.length - 1];
  const oldValue = current[finalKey];

  // Apply the operation
  switch (change.operation) {
    case 'set':
      current[finalKey] = change.value;
      break;

    case 'add':
      if (typeof current[finalKey] === 'object' && !Array.isArray(current[finalKey]) && current[finalKey] !== null) {
        // Merge into object
        current[finalKey] = { ...(current[finalKey] as Record<string, unknown>), ...(change.value as Record<string, unknown>) };
      } else if (Array.isArray(current[finalKey])) {
        // Add to array
        current[finalKey].push(change.value);
      } else {
        // Set as new value
        current[finalKey] = change.value;
      }
      break;

    case 'remove':
      delete current[finalKey];
      break;

    case 'toggle':
      current[finalKey] = !current[finalKey];
      break;
  }

  return { oldValue, newValue: current[finalKey] };
}

/**
 * Generate a human-readable preview of changes
 */
function generatePreview(
  changes: Array<{ path: string; oldValue: unknown; newValue: unknown }>
): string {
  const lines: string[] = [];

  for (const change of changes) {
    const oldStr = JSON.stringify(change.oldValue);
    const newStr = JSON.stringify(change.newValue);

    if (change.oldValue === undefined) {
      lines.push(`✓ Add ${change.path} = ${newStr}`);
    } else {
      lines.push(`✓ Update ${change.path}: ${oldStr} → ${newStr}`);
    }
  }

  return lines.join('\n');
}

/**
 * Validate configuration changes and generate warnings
 */
function validateChanges(changes: ConfigChange[]): string[] {
  const warnings: string[] = [];

  for (const change of changes) {
    // Warn about experimental settings
    if (change.path.startsWith('experimental.')) {
      warnings.push(`Setting ${change.path} is experimental and may change in future versions`);
    }

    // Warn about security-sensitive settings
    if (change.path.includes('trust') || change.path.includes('autoAccept')) {
      warnings.push(`Setting ${change.path} has security implications`);
    }

    // Warn about sandbox changes
    if (change.path === 'tools.sandbox') {
      warnings.push('Changing sandbox settings requires restarting Gemini CLI');
    }

    // Warn about model changes
    if (change.path.startsWith('model.')) {
      warnings.push('Model changes will apply to new conversations');
    }
  }

  return warnings;
}

/**
 * Edit Gemini CLI configuration based on natural language instruction
 */
export async function editConfig(
  instruction: string,
  scope: ConfigScope,
  dryRun: boolean = false,
  projectDir?: string
): Promise<ConfigEditResult> {
  try {
    logger.info(`Editing ${scope} config: "${instruction}" (dryRun: ${dryRun})`);

    // Parse the instruction
    const changes = parseConfigInstruction(instruction);

    if (changes.length === 0) {
      return {
        success: false,
        changes: [],
        configPath: '',
        preview: 'Could not parse instruction. Please rephrase or specify the exact setting path.',
        warnings: [
          'Try patterns like:',
          '  - "enable vim mode"',
          '  - "set theme to GitHub"',
          '  - "use model gemini-2.0-flash"',
          '  - "disable auto update"',
        ],
      };
    }

    // Load existing config (or create empty one)
    let config = loadConfig(scope, projectDir);
    if (!config) {
      config = {};
      logger.info(`Creating new ${scope} configuration`);
    }

    // Create a working copy
    const newConfig = JSON.parse(JSON.stringify(config));

    // Apply changes
    const appliedChanges: Array<{ path: string; oldValue: unknown; newValue: unknown }> = [];

    for (const change of changes) {
      const result = applyChange(newConfig, change);
      appliedChanges.push({
        path: change.path,
        oldValue: result.oldValue,
        newValue: result.newValue,
      });
    }

    // Generate preview
    const preview = generatePreview(appliedChanges);

    // Validate and collect warnings
    const warnings = validateChanges(changes);

    // If dry run, don't save
    if (dryRun) {
      logger.info('Dry run - changes not saved');
      return {
        success: true,
        changes: appliedChanges,
        configPath: '',
        preview,
        warnings: [...warnings, 'DRY RUN: Changes not saved'],
      };
    }

    // Create backup before saving
    const backupPath = backupConfig(scope, projectDir);

    // Save the new configuration
    saveConfig(newConfig, scope, projectDir);

    logger.info(`Successfully updated ${scope} configuration`);

    return {
      success: true,
      changes: appliedChanges,
      configPath: getConfigPath(scope, projectDir),
      preview,
      warnings,
      ...(backupPath ? { backupPath } : {}),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Config edit error:', errorMessage);

    return {
      success: false,
      changes: [],
      configPath: '',
      preview: `Error: ${errorMessage}`,
      warnings: [],
    };
  }
}
