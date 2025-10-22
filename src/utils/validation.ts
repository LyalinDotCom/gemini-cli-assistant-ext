/**
 * Validation utilities
 */

import { z } from 'zod';
import { logger } from './logger.js';

/**
 * Validates data against a Zod schema and returns validation result
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      const errorMessage = result.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      logger.warn('Validation failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Validation error:', message);
    return { success: false, error: message };
  }
}

/**
 * Validates that a path is safe (no path traversal)
 */
export function validateSafePath(path: string): boolean {
  // Check for path traversal attempts
  if (path.includes('..') || path.includes('~')) {
    return false;
  }
  // Check for absolute paths that might be suspicious
  if (path.startsWith('/etc') || path.startsWith('/System')) {
    return false;
  }
  return true;
}

/**
 * Validates JSON string
 */
export function validateJSON(json: string): { success: true; data: unknown } | { success: false; error: string } {
  try {
    const data = JSON.parse(json);
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Invalid JSON: ${message}` };
  }
}
