#!/usr/bin/env tsx

/**
 * Build script to sync Gemini CLI documentation
 *
 * 1. Downloads the consolidated documentation from geminicli.com/llms.txt
 * 2. Stores a local copy in docs/llms.txt
 * 3. Parses the file into logical documents and writes docs/index.json for search
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { updateDocsIndex } from '../src/docs/updater.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

async function buildDocs(): Promise<void> {
  console.log('Downloading llms.txt and project README from geminicli.com repositories...');
  const result = await updateDocsIndex({ projectRoot: PROJECT_ROOT });
  console.log('✓ Download complete and index rebuilt');
  console.log(`Saved llms copy to ${result.llmsPath}`);
  console.log(`Saved project README to ${result.readmePath}`);
  console.log(`Wrote search index to ${result.indexPath}`);
  console.log(`Discovered ${result.documentCount} documentation sections`);

  console.log('Category breakdown:');
  for (const [category, count] of Object.entries(result.categories).sort()) {
    console.log(`  - ${category}: ${count}`);
  }

  console.log('\n✓ Documentation sync finished');
}

buildDocs().catch((error) => {
  console.error('Failed to build documentation bundle:', error);
  process.exitCode = 1;
});
