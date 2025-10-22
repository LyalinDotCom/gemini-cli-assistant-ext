/**
 * Documentation search engine with TF-IDF ranking
 */

import type { DocDocument, SearchResult, SearchOptions } from './types.js';
import { logger } from '../utils/logger.js';

/**
 * Simple tokenizer for search
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

/**
 * Calculate TF-IDF score for a document
 */
function countRelevantTokens(tokens: string[], relevantTokens: Set<string>): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const token of tokens) {
    if (relevantTokens.size > 0 && !relevantTokens.has(token)) {
      continue;
    }
    counts[token] = (counts[token] ?? 0) + 1;
  }

  return counts;
}

function calculateScore(
  queryTokens: string[],
  tokenCounts: Record<string, number>,
  totalTokens: number,
  docFrequencies: Record<string, number>,
  totalDocs: number
): number {
  if (totalTokens === 0 || totalDocs === 0) {
    return 0;
  }

  let score = 0;

  for (const queryToken of queryTokens) {
    const tf = (tokenCounts[queryToken] ?? 0) / totalTokens;
    if (tf === 0) {
      continue;
    }

    const idf = Math.log(totalDocs / ((docFrequencies[queryToken] ?? 0) + 1));
    score += tf * idf;
  }

  return score;
}

/**
 * Extract relevant excerpt from document content around matched terms
 * For high-relevance matches, returns full content to avoid needing URL fetches
 */
function extractExcerpt(
  content: string,
  queryTokens: string[],
  precomputedTokens?: string[],
  maxLength = 4000
): string {
  const tokens = precomputedTokens ?? tokenize(content);
  const words = content.split(/\s+/);

  // Find the first occurrence of any query token
  let matchIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (queryTokens.includes(tokens[i])) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) {
    // No match found, return beginning
    const excerpt = words.slice(0, 200).join(' ');
    return excerpt.length < content.length ? excerpt + '...' : excerpt;
  }

  // For good matches, return more context - increase from 25 to 200 words on each side
  const contextWords = 200;
  const start = Math.max(0, matchIndex - contextWords);
  const end = Math.min(words.length, matchIndex + contextWords);

  let excerpt = words.slice(start, end).join(' ');

  // Add ellipsis if truncated
  if (start > 0) excerpt = '...' + excerpt;
  if (end < words.length) excerpt = excerpt + '...';

  // Truncate to max length (now 4000 instead of 300)
  if (excerpt.length > maxLength) {
    excerpt = excerpt.substring(0, maxLength) + '...';
  }

  return excerpt;
}

/**
 * Find headings that match the query
 */
function findMatchedHeadings(headings: string[], queryTokens: string[]): string[] {
  const matched: string[] = [];

  for (const heading of headings) {
    const headingTokens = tokenize(heading);
    if (queryTokens.some((qt) => headingTokens.includes(qt))) {
      matched.push(heading);
    }
  }

  return matched;
}

/**
 * Search documents using TF-IDF ranking
 */
export function searchDocuments(
  documents: DocDocument[],
  options: SearchOptions
): SearchResult[] {
  const {
    query,
    category,
    maxResults = 10,
    minScore = 0.01,
  } = options;

  logger.debug(`Searching for: "${query}"`, { category, maxResults });

  // Tokenize query
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    logger.warn('No valid query tokens');
    return [];
  }

  const queryTokenSet = new Set(queryTokens);

  // Filter by category if specified
  let filteredDocs = documents;
  if (category) {
    filteredDocs = documents.filter((doc) => doc.category === category);
    logger.debug(`Filtered to ${filteredDocs.length} docs in category: ${category}`);
  }

  if (filteredDocs.length === 0) {
    logger.info('No documents available after filtering');
    return [];
  }

  const totalDocs = filteredDocs.length;

  const contentTokensList = filteredDocs.map((doc) => tokenize(doc.content));
  const titleTokensList = filteredDocs.map((doc) => tokenize(doc.title));
  const headingTokensList = filteredDocs.map((doc) => tokenize(doc.headings.join(' ')));

  const contentCountsList = contentTokensList.map((tokens) =>
    countRelevantTokens(tokens, queryTokenSet)
  );
  const titleCountsList = titleTokensList.map((tokens) =>
    countRelevantTokens(tokens, queryTokenSet)
  );
  const headingCountsList = headingTokensList.map((tokens) =>
    countRelevantTokens(tokens, queryTokenSet)
  );

  const docFrequencies: Record<string, number> = {};
  for (const counts of contentCountsList) {
    for (const token of Object.keys(counts)) {
      docFrequencies[token] = (docFrequencies[token] ?? 0) + 1;
    }
  }

  const safeLength = (tokens: string[]): number => (tokens.length === 0 ? 1 : tokens.length);

  // Calculate scores for each document
  const results: SearchResult[] = [];

  filteredDocs.forEach((doc, index) => {
    const baseScore = calculateScore(
      queryTokens,
      contentCountsList[index],
      safeLength(contentTokensList[index]),
      docFrequencies,
      totalDocs
    );

    const titleBoost =
      calculateScore(
        queryTokens,
        titleCountsList[index],
        safeLength(titleTokensList[index]),
        docFrequencies,
        totalDocs
      ) * 3;

    const headingBoost =
      calculateScore(
        queryTokens,
        headingCountsList[index],
        safeLength(headingTokensList[index]),
        docFrequencies,
        totalDocs
      ) * 2;

    const score = baseScore + titleBoost + headingBoost;

    // Only include if score is above minimum
    if (score >= minScore) {
      const excerpt = extractExcerpt(
        doc.content,
        queryTokens,
        contentTokensList[index]
      );
      const matchedHeadings = findMatchedHeadings(doc.headings, queryTokens);

      results.push({
        document: doc,
        excerpt,
        relevanceScore: score,
        matchedHeadings,
      });
    }
  });

  // Sort by relevance score (descending)
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Limit results
  const limitedResults = results.slice(0, maxResults);

  logger.info(`Found ${results.length} results, returning top ${limitedResults.length}`);

  return limitedResults;
}
