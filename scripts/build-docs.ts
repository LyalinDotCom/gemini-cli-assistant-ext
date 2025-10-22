#!/usr/bin/env tsx

/**
 * Build script to sync Gemini CLI documentation
 *
 * 1. Downloads the consolidated documentation from geminicli.com/llms.txt
 * 2. Stores a local copy in docs/llms.txt
 * 3. Parses the file into logical documents and writes docs/index.json for search
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import {
  extractHeadings,
  normalizeDocLink,
  type NormalizedDocLink,
} from '../src/docs/urlMapper.js';
import type { DocDocument, DocIndex } from '../src/docs/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(PROJECT_ROOT, 'docs');
const LLMS_SOURCE_URL = 'https://geminicli.com/llms.txt';
const LLMS_LOCAL_PATH = join(OUTPUT_DIR, 'llms.txt');
const INDEX_PATH = join(OUTPUT_DIR, 'index.json');

interface HeadingSection {
  title: string;
  link: NormalizedDocLink;
  content: string;
}

function downloadText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (!res) {
          reject(new Error(`No response when requesting ${url}`));
          return;
        }

        const status = res.statusCode ?? 0;

        if (status >= 300 && status < 400 && res.headers.location) {
          const redirected = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          downloadText(redirected).then(resolve).catch(reject);
          return;
        }

        if (status < 200 || status >= 300) {
          reject(new Error(`Failed to download ${url}: HTTP ${status}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf-8'));
        });
        res.on('error', (error) => {
          reject(error);
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

function parseSections(llmsContent: string): HeadingSection[] {
  const headingRegex = /^# \[(.+?)\]\((https?:\/\/[^\s)]+)\)\s*$/gm;
  const matches: Array<{ index: number; length: number; title: string; url: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(llmsContent)) !== null) {
    matches.push({
      index: match.index ?? 0,
      length: match[0].length,
      title: match[1].trim(),
      url: match[2].trim(),
    });
  }

  if (matches.length === 0) {
    console.warn('No documentation sections were found in llms.txt');
    return [];
  }

  const sections: HeadingSection[] = [];

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];

    const start = current.index + current.length;
    const end = next ? next.index : llmsContent.length;
    let sectionContent = llmsContent.slice(start, end).trim();

    if (i === 0) {
      const preamble = llmsContent.slice(0, current.index).trim();
      if (preamble) {
        sectionContent = `${preamble}\n\n${sectionContent}`.trim();
      }
    }

    const link = normalizeDocLink(current.title, current.url);

    sections.push({
      title: current.title,
      link,
      content: sectionContent,
    });
  }

  return sections;
}

function buildDocuments(sections: HeadingSection[]): DocDocument[] {
  return sections.map((section) => ({
    id: section.link.id,
    title: section.title,
    category: section.link.category,
    path: section.link.path,
    liveUrl: section.link.liveUrl,
    githubUrl: section.link.githubUrl,
    sourceUrl: section.link.sourceUrl,
    content: section.content,
    headings: extractHeadings(section.content),
  }));
}

async function buildDocs(): Promise<void> {
  console.log('Downloading llms.txt from geminicli.com...');
  const llmsContent = await downloadText(LLMS_SOURCE_URL);
  console.log('✓ Download complete');

  mkdirSync(OUTPUT_DIR, { recursive: true });

  writeFileSync(LLMS_LOCAL_PATH, llmsContent, 'utf-8');
  console.log(`Saved llms copy to ${LLMS_LOCAL_PATH}`);

  const sections = parseSections(llmsContent);
  const documents = buildDocuments(sections);
  console.log(`Discovered ${documents.length} documentation sections`);

  const index: DocIndex = {
    documents,
    version: '2.0.0',
    buildDate: new Date().toISOString(),
  };

  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`Wrote search index to ${INDEX_PATH}`);

  const categoryCounts = documents.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.category] = (acc[doc.category] ?? 0) + 1;
    return acc;
  }, {});

  console.log('Category breakdown:');
  for (const [category, count] of Object.entries(categoryCounts).sort()) {
    console.log(`  - ${category}: ${count}`);
  }

  console.log('\n✓ Documentation sync finished');
}

buildDocs().catch((error) => {
  console.error('Failed to build documentation bundle:', error);
  process.exitCode = 1;
});
