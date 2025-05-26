/**
 * File operations and project structure management
 */

import { IFileManager, FileInfo } from '../interfaces/managers.js';
import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { PathNormalizer, normalizePath, joinPath } from '../utils/path-utils.js';

export class FileManager implements IFileManager {
  private projectRoot: string;
  private projectStructure: Map<string, FileInfo> = new Map();
  private fileWatcher: any = null;
  private pathNormalizer: PathNormalizer;

  constructor(projectRoot: string) {
    this.projectRoot = normalizePath(projectRoot);
    this.pathNormalizer = new PathNormalizer(this.projectRoot);
  }

  /**
   * Initialize file watching
   */
  async initialize(): Promise<void> {
    await this.scanProject();
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<string> {
    // Normalize the path to handle Windows/Unix differences
    const normalizedPath = this.pathNormalizer.normalize(filePath);
    const fullPath = this.pathNormalizer.getFullPath(normalizedPath);
    
    if (!await fs.pathExists(fullPath)) {
      throw new Error(`File not found: ${normalizedPath}`);
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  }

  /**
   * Write file content
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.projectRoot, filePath);
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(fullPath));
    
    // Write file
    await fs.writeFile(fullPath, content);
    
    // Update cache
    await this.updateFileCache(filePath);
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.projectRoot, filePath);
    
    if (!await fs.pathExists(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    await fs.remove(fullPath);
    
    // Remove from cache
    this.projectStructure.delete(filePath);
  }

  /**
   * Create a new script file
   */
  async createFile(filePath: string, content: string, scriptType: string): Promise<void> {
    // Determine file extension based on type
    let finalPath = filePath;
    
    if (!filePath.endsWith('.luau') && !filePath.endsWith('.lua')) {
      // Add appropriate extension
      switch (scriptType.toLowerCase()) {
        case 'server':
          finalPath = filePath.replace(/\.[^.]*$/, '') + '.server.luau';
          break;
        case 'client':
          finalPath = filePath.replace(/\.[^.]*$/, '') + '.client.luau';
          break;
        case 'module':
        case 'shared':
          finalPath = filePath.replace(/\.[^.]*$/, '') + '.luau';
          break;
        default:
          finalPath = filePath + '.luau';
      }
    }

    await this.writeFile(finalPath, content);
  }

  /**
   * Search for pattern in files
   */
  async searchInFiles(pattern: string, caseSensitive: boolean = false): Promise<string[]> {
    const results: string[] = [];
    const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');

    for (const [filePath, fileInfo] of this.projectStructure) {
      if (regex.test(fileInfo.content)) {
        results.push(filePath);
      }
    }

    return results;
  }

  /**
   * Get project structure
   */
  getProjectStructure(): Map<string, FileInfo> {
    return new Map(this.projectStructure);
  }

  /**
   * Scan project and build structure
   */
  private async scanProject(): Promise<void> {
    const pattern = path.join(this.projectRoot, 'src/**/*.{luau,lua}').replace(/\\/g, '/');
    const files = await glob(pattern);

    this.projectStructure.clear();

    for (const file of files) {
      const relativePath = path.relative(this.projectRoot, file).replace(/\\/g, '/');
      await this.updateFileCache(relativePath);
    }
  }

  /**
   * Update file in cache
   */
  private async updateFileCache(filePath: string): Promise<void> {
    const fullPath = path.join(this.projectRoot, filePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);
      const type = this.determineScriptType(filePath);

      this.projectStructure.set(filePath, {
        path: filePath,
        content,
        type,
        lastModified: stats.mtimeMs
      });
    } catch (error) {
      // File might have been deleted
      this.projectStructure.delete(filePath);
    }
  }

  /**
   * Determine script type from path
   */
  private determineScriptType(filePath: string): 'server' | 'client' | 'shared' | 'module' {
    if (filePath.includes('.server.')) return 'server';
    if (filePath.includes('.client.')) return 'client';
    if (filePath.includes('/server/')) return 'server';
    if (filePath.includes('/client/')) return 'client';
    if (filePath.includes('/shared/')) return 'shared';
    return 'module';
  }

  /**
   * Get file info
   */
  getFileInfo(filePath: string): FileInfo | undefined {
    return this.projectStructure.get(filePath);
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.projectRoot, filePath);
    return await fs.pathExists(fullPath);
  }

  /**
   * Get all files of a specific type
   */
  getFilesByType(type: 'server' | 'client' | 'shared' | 'module'): FileInfo[] {
    const files: FileInfo[] = [];
    
    for (const fileInfo of this.projectStructure.values()) {
      if (fileInfo.type === type) {
        files.push(fileInfo);
      }
    }

    return files;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
  }
}