import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { extractHeadings, extractTitle, normalizeDocLink, type NormalizedDocLink } from './urlMapper.js';
import type { DocDocument, DocIndex } from './types.js';

const DEFAULT_SOURCE_URL = 'https://geminicli.com/llms.txt';
const DEFAULT_README_URL =
  'https://raw.githubusercontent.com/google-gemini/gemini-cli/refs/heads/main/README.md';

interface HeadingSection {
  title: string;
  content: string;
  link: NormalizedDocLink;
}

export interface UpdateDocsResult {
  documentCount: number;
  categories: Record<string, number>;
  llmsPath: string;
  indexPath: string;
  readmePath: string;
  buildDate: string;
  version: string;
}

export interface UpdateDocsOptions {
  sourceUrl?: string;
  readmeUrl?: string;
  projectRoot?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT_ROOT = join(__dirname, '..', '..');

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
    throw new Error('No documentation sections were found in llms.txt');
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
      content: sectionContent,
      link,
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

export async function updateDocsIndex(options: UpdateDocsOptions = {}): Promise<UpdateDocsResult> {
  const projectRoot = options.projectRoot ?? DEFAULT_PROJECT_ROOT;
  const docsDir = join(projectRoot, 'docs');
  const llmsPath = join(docsDir, 'llms.txt');
  const indexPath = join(docsDir, 'index.json');
  const readmePath = join(docsDir, 'gemini-cli-readme.md');

  const llmsContent = await downloadText(options.sourceUrl ?? DEFAULT_SOURCE_URL);
  const readmeContent = await downloadText(options.readmeUrl ?? DEFAULT_README_URL);

  await mkdir(docsDir, { recursive: true });
  await writeFile(llmsPath, llmsContent, 'utf-8');
  await writeFile(readmePath, readmeContent, 'utf-8');

  const sections = parseSections(llmsContent);
  const documents = buildDocuments(sections);

  const readmeDoc: DocDocument = {
    id: 'gemini-cli-readme',
    title: extractTitle(readmeContent) || 'Gemini CLI README',
    category: 'general',
    path: 'gemini-cli-readme.md',
    liveUrl: 'https://github.com/google-gemini/gemini-cli/blob/main/README.md',
    githubUrl: 'https://github.com/google-gemini/gemini-cli/blob/main/README.md',
    sourceUrl: options.readmeUrl ?? DEFAULT_README_URL,
    content: readmeContent,
    headings: extractHeadings(readmeContent),
  };

  documents.unshift(readmeDoc);

  const index: DocIndex = {
    documents,
    version: '2.0.0',
    buildDate: new Date().toISOString(),
  };

  await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

  const categories = documents.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.category] = (acc[doc.category] ?? 0) + 1;
    return acc;
  }, {});

  return {
    documentCount: documents.length,
    categories,
    llmsPath,
    indexPath,
    readmePath,
    buildDate: index.buildDate,
    version: index.version,
  };
}
