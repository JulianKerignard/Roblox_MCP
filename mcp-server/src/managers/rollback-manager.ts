/**
 * Rollback and version history management
 */

import { IRollbackManager, RollbackEntry } from '../interfaces/managers.js';
import fs from 'fs-extra';
import path from 'path';

export class RollbackManager implements IRollbackManager {
  private rollbackHistory: Map<string, RollbackEntry[]> = new Map();
  private readonly maxRollbackEntries: number;
  private readonly projectRoot: string;

  constructor(projectRoot: string, maxRollbackEntries: number = 5) {
    this.projectRoot = projectRoot;
    this.maxRollbackEntries = maxRollbackEntries;
  }

  /**
   * Save a snapshot before modification
   */
  saveSnapshot(filePath: string, previousContent: string, patch: any): void {
    const history = this.rollbackHistory.get(filePath) || [];
    
    // Calculate diff for efficient storage
    const additions: string[] = [];
    const deletions: string[] = [];
    const modifications: string[] = [];
    
    // Simple diff tracking (could be improved with a proper diff algorithm)
    if (patch.operation === 'insert') {
      additions.push(`Line ${patch.lineStart}: ${patch.newContent}`);
    } else if (patch.operation === 'delete') {
      deletions.push(`Lines ${patch.lineStart}-${patch.lineEnd || patch.lineStart}`);
    } else if (patch.operation === 'replace') {
      modifications.push(`Lines ${patch.lineStart}-${patch.lineEnd || patch.lineStart}`);
    }
    
    const entry: RollbackEntry = {
      timestamp: Date.now(),
      previousContent,
      patch: { additions, deletions, modifications },
      tokenCost: Math.ceil(previousContent.length / 4) // Rough token estimate
    };
    
    history.unshift(entry);
    
    // Limit history size
    if (history.length > this.maxRollbackEntries) {
      history.pop();
    }
    
    this.rollbackHistory.set(filePath, history);
  }

  /**
   * Rollback to a previous version
   */
  async rollback(filePath: string, version: number = 1): Promise<{ success: boolean; content: string }> {
    const history = this.rollbackHistory.get(filePath);
    
    if (!history || history.length === 0) {
      throw new Error(`Aucun historique de rollback pour ${filePath}`);
    }
    
    if (version > history.length) {
      throw new Error(`Version ${version} non disponible. Maximum: ${history.length}`);
    }
    
    const entry = history[version - 1];
    const fullPath = path.join(this.projectRoot, filePath);
    
    try {
      await fs.writeFile(fullPath, entry.previousContent);
      
      // Remove used history entries
      this.rollbackHistory.set(filePath, history.slice(version));
      
      return {
        success: true,
        content: entry.previousContent
      };
    } catch (error) {
      throw new Error(`Erreur lors du rollback: ${error}`);
    }
  }

  /**
   * Get rollback history
   */
  getHistory(filePath?: string): Map<string, RollbackEntry[]> {
    if (filePath) {
      const history = this.rollbackHistory.get(filePath);
      return new Map([[filePath, history || []]]);
    }
    return new Map(this.rollbackHistory);
  }

  /**
   * Clear rollback history
   */
  clearHistory(filePath?: string): void {
    if (filePath) {
      this.rollbackHistory.delete(filePath);
    } else {
      this.rollbackHistory.clear();
    }
  }

  /**
   * Get total token cost of stored history
   */
  getTotalTokenCost(): number {
    let total = 0;
    this.rollbackHistory.forEach(history => {
      history.forEach(entry => {
        total += entry.tokenCost;
      });
    });
    return total;
  }

  /**
   * Export history to JSON for persistence
   */
  exportHistory(): string {
    const obj: { [key: string]: RollbackEntry[] } = {};
    this.rollbackHistory.forEach((value, key) => {
      obj[key] = value;
    });
    return JSON.stringify(obj, null, 2);
  }

  /**
   * Import history from JSON
   */
  importHistory(json: string): void {
    try {
      const obj = JSON.parse(json);
      this.rollbackHistory.clear();
      Object.entries(obj).forEach(([key, value]) => {
        this.rollbackHistory.set(key, value as RollbackEntry[]);
      });
    } catch (error) {
      throw new Error(`Erreur lors de l'import de l'historique: ${error}`);
    }
  }
}