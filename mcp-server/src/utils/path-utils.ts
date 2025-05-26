/**
 * Utilities for handling cross-platform path issues
 * Especially important for WSL environments where Windows paths mix with Unix paths
 */

import path from 'path';
import { platform } from 'os';

/**
 * Normalize path separators to forward slashes
 * This prevents issues where Claude confuses Windows backslashes with Unix forward slashes
 */
export function normalizePath(filePath: string): string {
  // Replace all backslashes with forward slashes
  return filePath.replace(/\\/g, '/');
}

/**
 * Convert path to platform-specific format
 */
export function toPlatformPath(filePath: string): string {
  if (platform() === 'win32') {
    return filePath.replace(/\//g, '\\');
  }
  return filePath;
}

/**
 * Ensure path uses forward slashes for consistency
 * This is the preferred format for all internal operations
 */
export function toUnixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Clean and normalize a path
 * - Removes duplicate slashes
 * - Normalizes to forward slashes
 * - Resolves . and ..
 */
export function cleanPath(filePath: string): string {
  // First normalize to forward slashes
  let cleaned = normalizePath(filePath);
  
  // Remove duplicate slashes
  cleaned = cleaned.replace(/\/+/g, '/');
  
  // Use path.posix for consistent Unix-style handling
  cleaned = path.posix.normalize(cleaned);
  
  return cleaned;
}

/**
 * Join paths with proper normalization
 */
export function joinPath(...paths: string[]): string {
  // Join using forward slashes
  const joined = paths.join('/');
  return cleanPath(joined);
}

/**
 * Get relative path with forward slashes
 */
export function getRelativePath(from: string, to: string): string {
  const relative = path.relative(from, to);
  return normalizePath(relative);
}

/**
 * Check if a path is absolute
 */
export function isAbsolutePath(filePath: string): boolean {
  // Check both Unix and Windows absolute paths
  return path.isAbsolute(filePath) || /^[a-zA-Z]:[\\/]/.test(filePath);
}

/**
 * Ensure path starts with the project root
 */
export function ensureRelativePath(filePath: string, projectRoot: string): string {
  const normalized = normalizePath(filePath);
  const normalizedRoot = normalizePath(projectRoot);
  
  // If already relative, return as-is
  if (!isAbsolutePath(normalized)) {
    return normalized;
  }
  
  // If it starts with project root, make it relative
  if (normalized.startsWith(normalizedRoot)) {
    return normalized.slice(normalizedRoot.length).replace(/^\//, '');
  }
  
  // Otherwise, try to compute relative path
  return getRelativePath(projectRoot, filePath);
}

/**
 * Fix common path mistakes Claude makes
 */
export function fixClaudePath(filePath: string): string {
  let fixed = filePath;
  
  // Remove quotes if present
  fixed = fixed.replace(/^["']|["']$/g, '');
  
  // Fix double backslashes (escaped backslashes)
  fixed = fixed.replace(/\\\\/g, '\\');
  
  // Normalize to forward slashes
  fixed = normalizePath(fixed);
  
  // Remove ./ at the beginning
  fixed = fixed.replace(/^\.\//, '');
  
  return fixed;
}

/**
 * Validate that a path is safe (no directory traversal)
 */
export function isSafePath(filePath: string, projectRoot: string): boolean {
  const normalized = path.resolve(projectRoot, filePath);
  const normalizedRoot = path.resolve(projectRoot);
  
  // Check that resolved path is still within project root
  return normalized.startsWith(normalizedRoot);
}

/**
 * Extract file info from various path formats Claude might use
 */
export function parseClaudePath(input: string): {
  filePath: string;
  lineNumber?: number;
} {
  // Match patterns like "file.lua:123" or "file.lua line 123"
  const lineMatch = input.match(/^(.+?)(?::(\d+)|[\s]+line[\s]+(\d+))$/i);
  
  if (lineMatch) {
    return {
      filePath: fixClaudePath(lineMatch[1]),
      lineNumber: parseInt(lineMatch[2] || lineMatch[3])
    };
  }
  
  return {
    filePath: fixClaudePath(input)
  };
}

/**
 * Path normalizer for use in file managers
 */
export class PathNormalizer {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = normalizePath(projectRoot);
  }

  /**
   * Normalize any input path
   */
  normalize(filePath: string): string {
    const cleaned = fixClaudePath(filePath);
    
    // If absolute, try to make relative to project
    if (isAbsolutePath(cleaned)) {
      return ensureRelativePath(cleaned, this.projectRoot);
    }
    
    return cleaned;
  }

  /**
   * Get full path from relative
   */
  getFullPath(relativePath: string): string {
    const normalized = this.normalize(relativePath);
    return joinPath(this.projectRoot, normalized);
  }

  /**
   * Validate path is within project
   */
  isValid(filePath: string): boolean {
    const normalized = this.normalize(filePath);
    return isSafePath(normalized, this.projectRoot);
  }
}