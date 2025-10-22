/**
 * Maps local documentation file paths to live GitHub documentation URLs
 */

const BASE_LIVE_URL = 'https://geminicli.com/docs';
const BASE_GITHUB_URL = 'https://github.com/google-gemini/gemini-cli/blob/main/docs';
const DOCS_PREFIX = 'docs/';

/**
 * Convert a local file path to a live documentation URL
 *
 * Examples:
 * - cli/commands.md -> https://geminicli.com/docs/cli/commands/
 * - index.md -> https://geminicli.com/docs/
 * - get-started/installation.md -> https://geminicli.com/docs/get-started/installation/
 */
export function localPathToLiveUrl(localPath: string): string {
  // Remove leading slash if present
  let path = localPath.startsWith('/') ? localPath.slice(1) : localPath;

  // Remove .md extension
  path = path.replace(/\.md$/, '');

  // Handle index files
  if (path === 'index' || path.endsWith('/index')) {
    path = path.replace(/\/?index$/, '');
  }

  // Build URL
  const url = path ? `${BASE_LIVE_URL}/${path}/` : `${BASE_LIVE_URL}/`;

  return url;
}

/**
 * Convert a local file path to GitHub source URL
 */
export function localPathToGitHubUrl(localPath: string): string {
  // Remove leading slash if present
  const path = localPath.startsWith('/') ? localPath.slice(1) : localPath;

  return `${BASE_GITHUB_URL}/${path}`;
}

/**
 * Extract category from file path
 * Examples:
 * - cli/commands.md -> cli
 * - get-started/installation.md -> get-started
 * - index.md -> general
 */
export function extractCategory(localPath: string): string {
  const parts = localPath.split('/');

  // If it's a top-level file, category is 'general'
  if (parts.length === 1) {
    return 'general';
  }

  // Otherwise, use the first directory
  return parts[0];
}

/**
 * Extract title from markdown content (first H1 heading)
 */
export function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }

  // Fallback: use filename
  return 'Untitled';
}

/**
 * Extract all headings from markdown content
 */
export function extractHeadings(content: string): string[] {
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const headings: string[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    if (match[1]) {
      headings.push(match[1].trim());
    }
  }

  return headings;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'doc';
}

function normalizeDocsPath(pathname: string): string {
  let path = pathname.replace(/^\/+/, '');

  if (path === '' || path === DOCS_PREFIX || path === 'docs' || path === 'docs.md') {
    return 'index.md';
  }

  if (path.startsWith(DOCS_PREFIX)) {
    path = path.slice(DOCS_PREFIX.length);
  }

  if (path === '' || path === 'index') {
    return 'index.md';
  }

  if (!path.endsWith('.md')) {
    return `${path}.md`;
  }

  return path;
}

export interface NormalizedDocLink {
  id: string;
  path: string;
  liveUrl: string;
  githubUrl: string;
  category: string;
  sourceUrl: string;
}

/**
 * Normalize a documentation link found in llms.txt
 */
export function normalizeDocLink(title: string, rawUrl: string): NormalizedDocLink {
  const sourceUrl = rawUrl.replace(/^http:\/\//, 'https://');

  try {
    const url = new URL(sourceUrl);

    if (url.hostname.includes('geminicli.com')) {
      const localPath = normalizeDocsPath(url.pathname);

      return {
        id: localPath,
        path: localPath,
        liveUrl: localPathToLiveUrl(localPath),
        githubUrl: localPathToGitHubUrl(localPath),
        category: extractCategory(localPath),
        sourceUrl,
      };
    }
  } catch {
    // Fall through to default handling below
  }

  const fallbackSlug = slugify(title);

  return {
    id: fallbackSlug,
    path: fallbackSlug,
    liveUrl: sourceUrl,
    githubUrl: sourceUrl,
    category: 'general',
    sourceUrl,
  };
}
