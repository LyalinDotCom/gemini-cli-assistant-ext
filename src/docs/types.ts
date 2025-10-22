/**
 * Type definitions for documentation system
 */

export interface DocDocument {
  id: string;
  title: string;
  category: string;
  path: string;
  liveUrl: string;
  githubUrl: string;
  sourceUrl: string;
  content: string;
  headings: string[];
  lastModified?: string;
}

export interface DocIndex {
  documents: DocDocument[];
  version: string;
  buildDate: string;
}

export interface SearchResult {
  document: DocDocument;
  excerpt: string;
  relevanceScore: number;
  matchedHeadings: string[];
}

export interface SearchOptions {
  query: string;
  category?: string;
  maxResults?: number;
  minScore?: number;
}
