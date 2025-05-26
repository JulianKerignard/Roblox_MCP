/**
 * Patch operations and code modification management
 */

import { IPatchManager, PatchOperation, ValidationResult } from '../interfaces/managers.js';
import { validatePatchBeforeApply } from '../../syntax-rules.js';
import { syntaxEnforcer } from '../validation/syntax-enforcer.js';
import { IFileManager } from '../interfaces/managers.js';
import { IRollbackManager } from '../interfaces/managers.js';

export class PatchManager implements IPatchManager {
  private fileManager: IFileManager;
  private rollbackManager: IRollbackManager;
  private autoValidateEnabled: boolean = true;

  constructor(fileManager: IFileManager, rollbackManager: IRollbackManager) {
    this.fileManager = fileManager;
    this.rollbackManager = rollbackManager;
  }

  /**
   * Apply a patch to a file
   */
  async applyPatch(patch: PatchOperation): Promise<{ success: boolean; result: any }> {
    try {
      // Read current content
      const content = await this.fileManager.readFile(patch.scriptPath);
      const lines = content.split('\n');

      // Validate line numbers
      if (patch.lineStart < 1 || patch.lineStart > lines.length + 1) {
        throw new Error(`Invalid line number: ${patch.lineStart} (file has ${lines.length} lines)`);
      }

      // Save snapshot for rollback
      this.rollbackManager.saveSnapshot(patch.scriptPath, content, patch);

      // VALIDATION OBLIGATOIRE AVANT APPLICATION
      if (this.autoValidateEnabled) {
        // D'abord simuler le patch pour obtenir le contenu final
        let simulatedContent = content;
        const lines = content.split('\n');
        
        switch (patch.operation) {
          case "insert":
            if (patch.newContent) {
              const insertLines = patch.newContent.split('\n');
              const simLines = [...lines];
              simLines.splice(patch.lineStart - 1, 0, ...insertLines);
              simulatedContent = simLines.join('\n');
            }
            break;
          case "replace":
            if (patch.newContent) {
              const replaceLines = patch.newContent.split('\n');
              const endLine = patch.lineEnd || patch.lineStart;
              const simLines = [...lines];
              simLines.splice(patch.lineStart - 1, endLine - patch.lineStart + 1, ...replaceLines);
              simulatedContent = simLines.join('\n');
            }
            break;
          case "delete":
            const deleteEnd = patch.lineEnd || patch.lineStart;
            const simLines = [...lines];
            simLines.splice(patch.lineStart - 1, deleteEnd - patch.lineStart + 1);
            simulatedContent = simLines.join('\n');
            break;
        }
        
        // Valider avec le nouveau système
        const enforcedValidation = syntaxEnforcer.validateBeforeModification(
          content,
          simulatedContent,
          patch.operation
        );
        
        if (!enforcedValidation.isValid) {
          // Améliorer les messages d'erreur avec du contexte
          const enhancedValidation = syntaxEnforcer.enhanceErrorMessages(
            simulatedContent,
            enforcedValidation
          );
          
          // BLOQUER LA MODIFICATION
          const errorMsg = [
            "❌ MODIFICATION BLOQUÉE - ERREURS DE SYNTAXE DÉTECTÉES ❌",
            "",
            ...enhancedValidation.errors,
            "",
            "💡 SUGGESTIONS:",
            ...enhancedValidation.suggestions,
            "",
            "📊 ANALYSE DES BLOCS:",
            `   Expected ends: ${enhancedValidation.blockAnalysis.expectedEnds}`,
            `   Found ends: ${enhancedValidation.blockAnalysis.foundEnds}`
          ];
          
          throw new Error(errorMsg.join('\n'));
        }
        
        // Afficher les warnings s'il y en a
        if (enforcedValidation.warnings.length > 0) {
          console.warn('⚠️ Warnings détectés:', enforcedValidation.warnings);
        }
      }

      // Apply the patch
      let newLines = [...lines];
      let operationDescription = "";

      switch (patch.operation) {
        case "insert":
          if (!patch.newContent) {
            throw new Error("newContent required for insert operation");
          }
          const insertLines = patch.newContent.split('\n');
          newLines.splice(patch.lineStart - 1, 0, ...insertLines);
          operationDescription = `Inserted ${insertLines.length} line(s) at line ${patch.lineStart}`;
          break;

        case "replace":
          if (!patch.newContent) {
            throw new Error("newContent required for replace operation");
          }
          const replaceLines = patch.newContent.split('\n');
          const endLine = patch.lineEnd || patch.lineStart;
          newLines.splice(patch.lineStart - 1, endLine - patch.lineStart + 1, ...replaceLines);
          operationDescription = `Replaced lines ${patch.lineStart}-${endLine} with ${replaceLines.length} line(s)`;
          break;

        case "delete":
          const deleteEnd = patch.lineEnd || patch.lineStart;
          newLines.splice(patch.lineStart - 1, deleteEnd - patch.lineStart + 1);
          operationDescription = `Deleted lines ${patch.lineStart}-${deleteEnd}`;
          break;

        default:
          throw new Error(`Unknown operation: ${patch.operation}`);
      }

      // Write the modified content
      const newContent = newLines.join('\n');
      await this.fileManager.writeFile(patch.scriptPath, newContent);

      // Generate review
      const review = this.generateReview(lines, newLines, patch);

      return {
        success: true,
        result: {
          description: patch.description || operationDescription,
          details: operationDescription,
          linesCount: newLines.length,
          review
        }
      };

    } catch (error) {
      return {
        success: false,
        result: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Preview a patch without applying it
   */
  async previewPatch(patch: PatchOperation): Promise<string> {
    try {
      const content = await this.fileManager.readFile(patch.scriptPath);
      const lines = content.split('\n');
      
      // Validate line numbers
      if (patch.lineStart < 1 || patch.lineStart > lines.length + 1) {
        throw new Error(`Invalid line number: ${patch.lineStart}`);
      }

      let preview = `## 👁️ Preview of patch\n\n`;
      preview += `**File:** \`${patch.scriptPath}\`\n`;
      preview += `**Operation:** ${patch.operation}\n`;
      preview += `**Lines:** ${patch.lineStart}`;
      if (patch.lineEnd) {
        preview += `-${patch.lineEnd}`;
      }
      preview += `\n\n`;

      // Show context before
      const contextStart = Math.max(1, patch.lineStart - 5);
      const contextEnd = Math.min(lines.length, (patch.lineEnd || patch.lineStart) + 5);

      preview += "**Context before:**\n```luau\n";
      for (let i = contextStart; i <= contextEnd && i <= lines.length; i++) {
        const marker = (i >= patch.lineStart && i <= (patch.lineEnd || patch.lineStart)) ? '>' : ' ';
        preview += `${i.toString().padStart(3)} ${marker} ${lines[i - 1]}\n`;
      }
      preview += "```\n\n";

      // Show what will happen
      preview += "**After patch:**\n```luau\n";
      
      // Apply patch to a copy
      let previewLines = [...lines];
      
      switch (patch.operation) {
        case "insert":
          if (patch.newContent) {
            const insertLines = patch.newContent.split('\n');
            previewLines.splice(patch.lineStart - 1, 0, ...insertLines);
          }
          break;
          
        case "replace":
          if (patch.newContent) {
            const replaceLines = patch.newContent.split('\n');
            const endLine = patch.lineEnd || patch.lineStart;
            previewLines.splice(patch.lineStart - 1, endLine - patch.lineStart + 1, ...replaceLines);
          }
          break;
          
        case "delete":
          const deleteEnd = patch.lineEnd || patch.lineStart;
          previewLines.splice(patch.lineStart - 1, deleteEnd - patch.lineStart + 1);
          break;
      }

      // Show preview with context
      const newContextEnd = Math.min(previewLines.length, patch.lineStart + 10);
      for (let i = contextStart; i <= newContextEnd && i <= previewLines.length; i++) {
        preview += `${i.toString().padStart(3)}   ${previewLines[i - 1]}\n`;
      }
      preview += "```\n";
      
      // Valider la syntaxe du preview
      const previewContent = previewLines.join('\n');
      const validation = syntaxEnforcer.validateBeforeModification(
        content,
        previewContent,
        patch.operation
      );
      
      if (!validation.isValid) {
        const enhanced = syntaxEnforcer.enhanceErrorMessages(previewContent, validation);
        preview += "\n⚠️ **Validation Warnings:**\n";
        enhanced.errors.forEach(err => {
          preview += err + "\n";
        });
      }

      return preview;

    } catch (error) {
      throw new Error(`Cannot preview patch: ${error}`);
    }
  }

  /**
   * Validate patch before applying
   */
  validatePatchBeforeApply(content: string, patch: PatchOperation): ValidationResult {
    const validation = validatePatchBeforeApply(
      content,
      patch.newContent || '',
      patch.operation,
      patch.lineStart,
      patch.lineEnd
    );

    return {
      isValid: validation.valid,
      errors: validation.valid ? [] : validation.warnings.map((w: string) => ({
        file: patch.scriptPath,
        type: 'syntax' as const,
        message: w,
        severity: 'error' as const
      })),
      warnings: validation.suggestions.map((s: string) => ({
        file: patch.scriptPath,
        type: 'suggestion',
        message: s
      }))
    };
  }

  /**
   * Generate automatic review of changes
   */
  private generateReview(originalLines: string[], newLines: string[], patch: PatchOperation): string {
    const affectedStart = Math.max(1, patch.lineStart - 2);
    const affectedEnd = Math.min(newLines.length, (patch.lineEnd || patch.lineStart) + 2);
    
    let review = `## 📋 **Automatic Review**\n\n`;
    
    // Summary
    const originalCount = originalLines.length;
    const newCount = newLines.length;
    const deltaLines = newCount - originalCount;
    
    review += `### Change Summary\n`;
    review += `- **Lines before:** ${originalCount}\n`;
    review += `- **Lines after:** ${newCount}\n`;
    review += `- **Delta:** ${deltaLines > 0 ? '+' : ''}${deltaLines} line(s)\n\n`;
    
    // Show modified code with context
    review += `### Modified Code (with context)\n`;
    review += `\`\`\`luau\n`;
    
    for (let i = affectedStart; i <= Math.min(affectedEnd, newLines.length); i++) {
      const line = newLines[i - 1];
      const lineNum = i.toString().padStart(3, ' ');
      
      // Mark modified lines
      if (i >= patch.lineStart && i <= (patch.lineEnd || patch.lineStart)) {
        review += `${lineNum}* ${line}\n`; // * indicates modified
      } else {
        review += `${lineNum}  ${line}\n`;
      }
    }
    
    review += `\`\`\`\n`;
    
    return review;
  }

  /**
   * Set auto-validation state
   */
  setAutoValidation(enabled: boolean): void {
    this.autoValidateEnabled = enabled;
  }
}