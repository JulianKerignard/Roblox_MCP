/**
 * Hook de validation post-écriture
 * S'exécute automatiquement après chaque modification de fichier
 */

import { syntaxEnforcer } from '../validation/syntax-enforcer.js';

export interface PostWriteHookResult {
  success: boolean;
  validationResult?: any;
  rollbackPerformed?: boolean;
  error?: string;
}

export class PostWriteValidator {
  private previousContents: Map<string, string> = new Map();

  /**
   * Enregistre le contenu avant modification
   */
  beforeWrite(filePath: string, content: string): void {
    this.previousContents.set(filePath, content);
  }

  /**
   * Valide après écriture et rollback si nécessaire
   */
  async afterWrite(
    filePath: string, 
    newContent: string,
    fileManager: any
  ): Promise<PostWriteHookResult> {
    // Ne valider que les fichiers Luau
    if (!filePath.endsWith('.luau') && !filePath.endsWith('.lua')) {
      return { success: true };
    }

    const previousContent = this.previousContents.get(filePath) || '';
    
    // Valider le nouveau contenu
    const validation = syntaxEnforcer.validateBeforeModification(
      previousContent,
      newContent,
      'write'
    );

    if (!validation.isValid) {
      // ROLLBACK AUTOMATIQUE
      console.error('❌ ERREUR DE SYNTAXE DÉTECTÉE - ROLLBACK AUTOMATIQUE');
      console.error('Erreurs:', validation.errors);
      
      try {
        // Restaurer le contenu précédent
        await fileManager.writeFile(filePath, previousContent);
        
        return {
          success: false,
          validationResult: validation,
          rollbackPerformed: true,
          error: `Syntaxe invalide détectée. Rollback effectué. Erreurs:\n${validation.errors.join('\n')}`
        };
      } catch (rollbackError) {
        return {
          success: false,
          validationResult: validation,
          rollbackPerformed: false,
          error: `Erreur critique: Syntaxe invalide ET échec du rollback!`
        };
      }
    }

    // Nettoyer la mémoire
    this.previousContents.delete(filePath);

    return {
      success: true,
      validationResult: validation
    };
  }

  /**
   * Message d'avertissement pour Claude
   */
  getWarningMessage(): string {
    return `
⚠️ AVERTISSEMENT SYSTÈME ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️ VALIDATION SYNTAXIQUE ACTIVÉE 🛡️

Toute modification avec une syntaxe invalide sera:
1. ❌ AUTOMATIQUEMENT REJETÉE
2. 🔄 ROLLBACK au contenu précédent
3. 📊 Un rapport d'erreur détaillé sera affiché

RÈGLES OBLIGATOIRES:
• Chaque 'function' DOIT avoir son 'end'
• Chaque 'if' DOIT avoir son 'end'
• Chaque 'for' DOIT avoir son 'end'
• Chaque 'while' DOIT avoir son 'end'
• Chaque parenthèse '(' DOIT avoir sa ')'
• Chaque accolade '{' DOIT avoir sa '}'

💡 CONSEIL: Utilisez TOUJOURS preview_patch avant d'appliquer!

━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;
  }
}

export const postWriteValidator = new PostWriteValidator();