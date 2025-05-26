import { describe, it, expect, beforeEach } from '@jest/globals';
import { TokenManager } from '../token-manager.js';

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  beforeEach(() => {
    tokenManager = new TokenManager(100000); // 100k limit for testing
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      const tm = new TokenManager();
      const stats = tm.getDetailedStats();
      expect(stats.contextWindowMax).toBe(200000);
      expect(stats.totalTokensUsed).toBe(0);
      expect(stats.contextWindowUsed).toBe(0);
    });

    it('should accept custom context window limit', () => {
      const stats = tokenManager.getDetailedStats();
      expect(stats.contextWindowMax).toBe(100000);
    });
  });

  describe('Token estimation', () => {
    it('should estimate tokens correctly', () => {
      // ~1 token per 4 characters
      expect(tokenManager.estimateTokens('hello')).toBe(2); // 5/4 = 1.25, ceil = 2
      expect(tokenManager.estimateTokens('a'.repeat(100))).toBe(25); // 100/4 = 25
      expect(tokenManager.estimateTokens('')).toBe(0);
    });
  });

  describe('Usage tracking', () => {
    it('should update usage correctly', () => {
      tokenManager.updateUsage('hello world'); // 11 chars = 3 tokens
      const stats = tokenManager.getDetailedStats();
      expect(stats.operationTokens).toBe(3);
      expect(stats.totalTokensUsed).toBe(3);
      expect(stats.contextWindowUsed).toBe(3);
    });

    it('should accumulate usage', () => {
      tokenManager.updateUsage('hello'); // 2 tokens
      tokenManager.updateUsage('world'); // 2 tokens
      const stats = tokenManager.getDetailedStats();
      expect(stats.totalTokensUsed).toBe(4);
      expect(stats.contextWindowUsed).toBe(4);
    });

    it('should cap context window at maximum', () => {
      const longText = 'a'.repeat(500000); // Would be 125k tokens
      tokenManager.updateUsage(longText);
      const stats = tokenManager.getDetailedStats();
      expect(stats.contextWindowUsed).toBe(100000); // Capped at max
      expect(stats.totalTokensUsed).toBe(125000); // Total still tracks actual
    });
  });

  describe('Cache tracking', () => {
    it('should track cache hits and misses', () => {
      tokenManager.recordCacheHit();
      tokenManager.recordCacheHit();
      tokenManager.recordCacheMiss();
      
      const stats = tokenManager.getDetailedStats();
      expect(stats.cacheHits).toBe(2);
      expect(stats.cacheMisses).toBe(1);
    });
  });

  describe('Limit detection', () => {
    it('should detect when near limit', () => {
      expect(tokenManager.isNearLimit()).toBe(false);
      
      // Use 85k tokens (85% of 100k)
      tokenManager.updateUsage('a'.repeat(340000)); // 85k tokens
      expect(tokenManager.isNearLimit(0.8)).toBe(true);
      expect(tokenManager.isNearLimit(0.9)).toBe(false);
    });

    it('should calculate remaining tokens', () => {
      expect(tokenManager.getRemainingTokens()).toBe(100000);
      
      tokenManager.updateUsage('a'.repeat(40000)); // 10k tokens
      expect(tokenManager.getRemainingTokens()).toBe(90000);
    });
  });

  describe('Usage report', () => {
    it('should generate formatted report', () => {
      tokenManager.updateUsage('hello world');
      const report = tokenManager.getUsageReport();
      
      expect(report).toContain('**Tokens:** 3');
      expect(report).toContain('**Total:** 3');
      expect(report).toContain('**Contexte:** 0.0%');
    });

    it('should show percentage correctly', () => {
      tokenManager.updateUsage('a'.repeat(40000)); // 10k tokens = 10%
      const report = tokenManager.getUsageReport();
      expect(report).toContain('10.0%');
    });
  });

  describe('Reset functionality', () => {
    it('should reset all counters', () => {
      // Add some usage
      tokenManager.updateUsage('test data');
      tokenManager.recordCacheHit();
      tokenManager.recordCacheMiss();
      
      // Reset
      tokenManager.reset();
      
      const stats = tokenManager.getDetailedStats();
      expect(stats.totalTokensUsed).toBe(0);
      expect(stats.contextWindowUsed).toBe(0);
      expect(stats.operationTokens).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
      expect(stats.contextWindowMax).toBe(100000); // Max should not reset
    });
  });
});