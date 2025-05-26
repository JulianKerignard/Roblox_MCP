/**
 * Token usage tracking and management
 */

import { ITokenManager, TokenUsage } from '../interfaces/managers.js';

export class TokenManager implements ITokenManager {
  private tokenUsage: TokenUsage = {
    totalTokensUsed: 0,
    contextWindowUsed: 0,
    contextWindowMax: 200000,
    operationTokens: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(contextWindowMax: number = 200000) {
    this.tokenUsage.contextWindowMax = contextWindowMax;
  }

  /**
   * Update token usage with new content
   */
  updateUsage(content: string): void {
    const estimatedTokens = this.estimateTokens(content);
    this.tokenUsage.operationTokens = estimatedTokens;
    this.tokenUsage.totalTokensUsed += estimatedTokens;
    this.tokenUsage.contextWindowUsed = Math.min(
      this.tokenUsage.contextWindowUsed + estimatedTokens,
      this.tokenUsage.contextWindowMax
    );
  }

  /**
   * Estimate tokens from content (rough approximation)
   */
  estimateTokens(content: string): number {
    // Approximation: ~1 token per 4 characters
    return Math.ceil(content.length / 4);
  }

  /**
   * Get formatted usage report
   */
  getUsageReport(): string {
    const percentage = (this.tokenUsage.contextWindowUsed / this.tokenUsage.contextWindowMax) * 100;
    return `\n\n---\n📊 **Tokens:** ${this.tokenUsage.operationTokens} | ` +
           `**Total:** ${this.tokenUsage.totalTokensUsed} | ` +
           `**Contexte:** ${percentage.toFixed(1)}% ` +
           `(${this.tokenUsage.contextWindowUsed}/${this.tokenUsage.contextWindowMax})`;
  }

  /**
   * Get detailed usage statistics
   */
  getDetailedStats(): TokenUsage {
    return { ...this.tokenUsage };
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.tokenUsage.cacheHits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.tokenUsage.cacheMisses++;
  }

  /**
   * Reset token usage
   */
  reset(): void {
    this.tokenUsage = {
      totalTokensUsed: 0,
      contextWindowUsed: 0,
      contextWindowMax: this.tokenUsage.contextWindowMax,
      operationTokens: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Check if approaching context limit
   */
  isNearLimit(threshold: number = 0.9): boolean {
    return (this.tokenUsage.contextWindowUsed / this.tokenUsage.contextWindowMax) > threshold;
  }

  /**
   * Get remaining tokens
   */
  getRemainingTokens(): number {
    return this.tokenUsage.contextWindowMax - this.tokenUsage.contextWindowUsed;
  }
}