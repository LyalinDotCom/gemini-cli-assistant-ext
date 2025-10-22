/**
 * Documentation index loader
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { DocIndex } from './types.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedIndex: DocIndex | null = null;

/**
 * Load the documentation index
 * The index is built at build time by the build-docs script
 */
export function loadDocIndex(): DocIndex {
  if (cachedIndex) {
    return cachedIndex;
  }

  try {
    // Index file is in the docs directory at project root
    const indexPath = join(__dirname, '../../docs/index.json');
    const indexData = readFileSync(indexPath, 'utf-8');
    cachedIndex = JSON.parse(indexData) as DocIndex;

    logger.info(`Loaded doc index: ${cachedIndex.documents.length} documents`);
    logger.debug(`Index version: ${cachedIndex.version}, built: ${cachedIndex.buildDate}`);

    return cachedIndex;
  } catch (error) {
    logger.error('Failed to load documentation index:', error);
    throw new Error(
      'Documentation index not found. Please run "npm run build:docs" to generate it.'
    );
  }
}

/**
 * Get all available categories
 */
export function getCategories(index: DocIndex): string[] {
  const categories = new Set(index.documents.map((doc) => doc.category));
  return Array.from(categories).sort();
}

/**
 * Get document count by category
 */
export function getCategoryStats(index: DocIndex): Record<string, number> {
  const stats: Record<string, number> = {};

  for (const doc of index.documents) {
    stats[doc.category] = (stats[doc.category] || 0) + 1;
  }

  return stats;
}

/**
 * Reload the index (clears cache)
 */
export function reloadDocIndex(): DocIndex {
  cachedIndex = null;
  return loadDocIndex();
}
