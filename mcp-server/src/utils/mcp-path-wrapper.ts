/**
 * MCP Tool wrapper that automatically fixes path issues
 * This prevents Claude from getting confused with Windows vs Unix paths
 */

import { fixClaudePath, parseClaudePath } from './path-utils.js';

/**
 * Wrap MCP tool handlers to automatically fix path arguments
 */
export function wrapToolHandler<T extends (...args: any[]) => any>(
  handler: T,
  pathArgNames: string[] = ['scriptPath', 'filePath', 'path']
): T {
  return (async (...args: any[]) => {
    const [toolArgs] = args;
    
    if (toolArgs && typeof toolArgs === 'object') {
      // Fix any path arguments
      for (const argName of pathArgNames) {
        if (argName in toolArgs && typeof toolArgs[argName] === 'string') {
          // Parse the path (might include line numbers)
          const parsed = parseClaudePath(toolArgs[argName]);
          toolArgs[argName] = parsed.filePath;
          
          // If line number was extracted, add it as separate arg
          if (parsed.lineNumber && !('lineNumber' in toolArgs)) {
            toolArgs.lineNumber = parsed.lineNumber;
          }
        }
      }
    }
    
    return handler(...args);
  }) as T;
}

/**
 * Middleware for MCP server that fixes paths in all requests
 */
export class MCPPathMiddleware {
  private pathFields = [
    'scriptPath',
    'filePath', 
    'path',
    'targetFile',
    'sourcePath',
    'destinationPath'
  ];

  /**
   * Process request arguments to fix paths
   */
  processArgs(args: any): { processed: any; corrections: string[] } {
    if (!args || typeof args !== 'object') {
      return { processed: args, corrections: [] };
    }

    const processed = { ...args };
    const corrections: string[] = [];

    for (const field of this.pathFields) {
      if (field in processed && typeof processed[field] === 'string') {
        const original = processed[field];
        const parsed = parseClaudePath(original);
        processed[field] = parsed.filePath;
        
        // Track if we made a correction
        if (original !== parsed.filePath) {
          corrections.push(`🔧 Path auto-corrected: "${original}" → "${parsed.filePath}"`);
        }
        
        // Add line number if found and not already present
        if (parsed.lineNumber && !processed.lineNumber) {
          processed.lineNumber = parsed.lineNumber;
        }
      }
    }

    return { processed, corrections };
  }

  /**
   * Log path corrections for debugging
   */
  logCorrection(original: string, corrected: string): void {
    if (original !== corrected) {
      console.error(`🔧 Path corrected: "${original}" → "${corrected}"`);
    }
  }
}

/**
 * Error messages that suggest path issues
 */
export const PATH_ERROR_MESSAGES = {
  notFound: (path: string) => 
    `File not found: ${path}\n` +
    `Note: Paths should use forward slashes (/) and be relative to project root.\n` +
    `Example: "src/server/main.server.luau"`,
    
  invalidPath: (path: string) =>
    `Invalid path: ${path}\n` +
    `Paths must be within the project directory and use forward slashes.`,
    
  absolutePath: (path: string) =>
    `Absolute paths are not allowed: ${path}\n` +
    `Please use a relative path from the project root.`
};

/**
 * Helper to format path-related errors with helpful messages
 */
export function formatPathError(error: Error, originalPath?: string): Error {
  const message = error.message.toLowerCase();
  
  if (message.includes('not found') || message.includes('no such file')) {
    return new Error(PATH_ERROR_MESSAGES.notFound(originalPath || 'unknown'));
  }
  
  if (message.includes('invalid') && originalPath) {
    return new Error(PATH_ERROR_MESSAGES.invalidPath(originalPath));
  }
  
  // Add hint about path format to any path-related error
  if (originalPath && originalPath.includes('\\')) {
    error.message += '\n💡 Hint: Use forward slashes (/) instead of backslashes (\\)';
  }
  
  return error;
}