import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RollbackManager } from '../rollback-manager.js';
import fs from 'fs-extra';
import path from 'path';

// Mock fs-extra
jest.mock('fs-extra');
const mockedFs = jest.mocked(fs);

describe('RollbackManager', () => {
  let rollbackManager: RollbackManager;
  const projectRoot = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    rollbackManager = new RollbackManager(projectRoot, 3); // Max 3 entries for testing
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      const rm = new RollbackManager(projectRoot);
      expect(rm.getTotalTokenCost()).toBe(0);
      expect(rm.getHistory().size).toBe(0);
    });
  });

  describe('Snapshot management', () => {
    it('should save snapshot correctly', () => {
      const patch = {
        operation: 'insert',
        lineStart: 10,
        newContent: 'new code'
      };

      rollbackManager.saveSnapshot('test.luau', 'original content', patch);
      
      const history = rollbackManager.getHistory('test.luau');
      expect(history.size).toBe(1);
      
      const entries = history.get('test.luau');
      expect(entries).toHaveLength(1);
      expect(entries![0].previousContent).toBe('original content');
      expect(entries![0].patch.additions).toContain('Line 10: new code');
    });

    it('should limit history size', () => {
      const patch = { operation: 'insert', lineStart: 1, newContent: 'test' };
      
      // Add 4 snapshots (max is 3)
      for (let i = 0; i < 4; i++) {
        rollbackManager.saveSnapshot('test.luau', `content ${i}`, patch);
      }
      
      const history = rollbackManager.getHistory('test.luau');
      const entries = history.get('test.luau');
      expect(entries).toHaveLength(3);
      expect(entries![0].previousContent).toBe('content 3'); // Most recent
      expect(entries![2].previousContent).toBe('content 1'); // Oldest kept
    });

    it('should track different operations', () => {
      rollbackManager.saveSnapshot('test.luau', 'content', {
        operation: 'delete',
        lineStart: 5,
        lineEnd: 10
      });
      
      const entries = rollbackManager.getHistory('test.luau').get('test.luau');
      expect(entries![0].patch.deletions).toContain('Lines 5-10');
      
      rollbackManager.saveSnapshot('test.luau', 'content', {
        operation: 'replace',
        lineStart: 15,
        lineEnd: 20
      });
      
      const entries2 = rollbackManager.getHistory('test.luau').get('test.luau');
      expect(entries2![0].patch.modifications).toContain('Lines 15-20');
    });
  });

  describe('Rollback functionality', () => {
    beforeEach(() => {
      (mockedFs.writeFile as jest.Mock).mockResolvedValue(undefined);
    });

    it('should rollback to previous version', async () => {
      rollbackManager.saveSnapshot('test.luau', 'version 1', { operation: 'insert', lineStart: 1 });
      rollbackManager.saveSnapshot('test.luau', 'version 2', { operation: 'insert', lineStart: 2 });
      
      const result = await rollbackManager.rollback('test.luau', 1);
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('version 2');
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        path.join(projectRoot, 'test.luau'),
        'version 2'
      );
    });

    it('should remove used history entries', async () => {
      rollbackManager.saveSnapshot('test.luau', 'v1', { operation: 'insert', lineStart: 1 });
      rollbackManager.saveSnapshot('test.luau', 'v2', { operation: 'insert', lineStart: 2 });
      rollbackManager.saveSnapshot('test.luau', 'v3', { operation: 'insert', lineStart: 3 });
      
      await rollbackManager.rollback('test.luau', 2);
      
      const history = rollbackManager.getHistory('test.luau');
      const entries = history.get('test.luau');
      expect(entries).toHaveLength(1); // Only most recent left
    });

    it('should throw error for non-existent history', async () => {
      await expect(rollbackManager.rollback('nonexistent.luau'))
        .rejects.toThrow('Aucun historique de rollback');
    });

    it('should throw error for invalid version', async () => {
      rollbackManager.saveSnapshot('test.luau', 'content', { operation: 'insert', lineStart: 1 });
      
      await expect(rollbackManager.rollback('test.luau', 5))
        .rejects.toThrow('Version 5 non disponible. Maximum: 1');
    });
  });

  describe('History management', () => {
    it('should get history for specific file', () => {
      rollbackManager.saveSnapshot('file1.luau', 'content1', { operation: 'insert', lineStart: 1 });
      rollbackManager.saveSnapshot('file2.luau', 'content2', { operation: 'insert', lineStart: 1 });
      
      const history = rollbackManager.getHistory('file1.luau');
      expect(history.size).toBe(1);
      expect(history.has('file1.luau')).toBe(true);
      expect(history.has('file2.luau')).toBe(false);
    });

    it('should get all history', () => {
      rollbackManager.saveSnapshot('file1.luau', 'content1', { operation: 'insert', lineStart: 1 });
      rollbackManager.saveSnapshot('file2.luau', 'content2', { operation: 'insert', lineStart: 1 });
      
      const history = rollbackManager.getHistory();
      expect(history.size).toBe(2);
    });

    it('should clear history for specific file', () => {
      rollbackManager.saveSnapshot('file1.luau', 'content1', { operation: 'insert', lineStart: 1 });
      rollbackManager.saveSnapshot('file2.luau', 'content2', { operation: 'insert', lineStart: 1 });
      
      rollbackManager.clearHistory('file1.luau');
      
      const history = rollbackManager.getHistory();
      expect(history.has('file1.luau')).toBe(false);
      expect(history.has('file2.luau')).toBe(true);
    });

    it('should clear all history', () => {
      rollbackManager.saveSnapshot('file1.luau', 'content1', { operation: 'insert', lineStart: 1 });
      rollbackManager.saveSnapshot('file2.luau', 'content2', { operation: 'insert', lineStart: 1 });
      
      rollbackManager.clearHistory();
      
      expect(rollbackManager.getHistory().size).toBe(0);
    });
  });

  describe('Token cost tracking', () => {
    it('should calculate total token cost', () => {
      // 'test content' = 12 chars = 3 tokens
      rollbackManager.saveSnapshot('file1.luau', 'test content', { operation: 'insert', lineStart: 1 });
      // 'longer test content here' = 24 chars = 6 tokens
      rollbackManager.saveSnapshot('file2.luau', 'longer test content here', { operation: 'insert', lineStart: 1 });
      
      expect(rollbackManager.getTotalTokenCost()).toBe(9);
    });
  });

  describe('Import/Export', () => {
    it('should export history to JSON', () => {
      rollbackManager.saveSnapshot('test.luau', 'content', { 
        operation: 'insert', 
        lineStart: 1,
        newContent: 'test'
      });
      
      const json = rollbackManager.exportHistory();
      const parsed = JSON.parse(json);
      
      expect(parsed).toHaveProperty('test.luau');
      expect(parsed['test.luau']).toHaveLength(1);
      expect(parsed['test.luau'][0].previousContent).toBe('content');
    });

    it('should import history from JSON', () => {
      const historyData = {
        'imported.luau': [{
          timestamp: Date.now(),
          previousContent: 'imported content',
          patch: { additions: [], deletions: [], modifications: [] },
          tokenCost: 10
        }]
      };
      
      rollbackManager.importHistory(JSON.stringify(historyData));
      
      const history = rollbackManager.getHistory();
      expect(history.has('imported.luau')).toBe(true);
      expect(history.get('imported.luau')![0].previousContent).toBe('imported content');
    });

    it('should handle invalid JSON on import', () => {
      expect(() => rollbackManager.importHistory('invalid json'))
        .toThrow('Erreur lors de l\'import de l\'historique');
    });
  });
});