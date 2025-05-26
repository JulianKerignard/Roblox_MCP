/**
 * Interfaces for all manager classes
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Common types
export interface FileInfo {
  path: string;
  content: string;
  type: 'server' | 'client' | 'shared' | 'module';
  lastModified: number;
}

export interface PatchOperation {
  scriptPath: string;
  operation: "insert" | "replace" | "delete";
  lineStart: number;
  lineEnd?: number;
  newContent?: string;
  description?: string;
}

export interface RollbackEntry {
  timestamp: number;
  previousContent: string;
  patch: {
    additions: string[];
    deletions: string[];
    modifications: string[];
  };
  tokenCost: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  file: string;
  line?: number;
  type: 'syntax' | 'structure' | 'security';
  message: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  file: string;
  line?: number;
  type: string;
  message: string;
}

export interface TokenUsage {
  totalTokensUsed: number;
  contextWindowUsed: number;
  contextWindowMax: number;
  operationTokens: number;
  cacheHits: number;
  cacheMisses: number;
}

// Manager interfaces
export interface IPatchManager {
  applyPatch(patch: PatchOperation): Promise<{ success: boolean; result: any }>;
  previewPatch(patch: PatchOperation): Promise<string>;
  validatePatchBeforeApply(content: string, patch: PatchOperation): ValidationResult;
}

export interface IRollbackManager {
  saveSnapshot(filePath: string, content: string, patch: any): void;
  rollback(filePath: string, version?: number): Promise<{ success: boolean; content: string }>;
  getHistory(filePath?: string): Map<string, RollbackEntry[]>;
  clearHistory(filePath?: string): void;
}

export interface IValidationManager {
  validateFile(filePath: string, content: string): Promise<ValidationResult>;
  validateProject(projectPath: string): Promise<ValidationResult>;
  checkAntiPatterns(content: string): ValidationWarning[];
  validateSyntax(content: string): ValidationResult;
}

export interface IFileManager {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  createFile(filePath: string, content: string, scriptType: string): Promise<void>;
  searchInFiles(pattern: string, caseSensitive?: boolean): Promise<string[]>;
  getProjectStructure(): Map<string, FileInfo>;
}

export interface ITokenManager {
  updateUsage(content: string): void;
  getUsageReport(): string;
  estimateTokens(content: string): number;
  reset(): void;
}

export interface IErrorHandler {
  analyzeError(errorMessage: string): { pattern: any; directive: string; autoInstructions: string[] };
  generateReport(errorMessage: string, filePath?: string, lineNumber?: number): string;
  getSuggestedFixes(errorType: string): string[];
}