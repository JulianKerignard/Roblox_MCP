/**
 * SYSTÈME DE VALIDATION SYNTAXIQUE STRICTE
 * Empêche les erreurs de syntaxe Luau comme les 'end' manquants
 */

interface SyntaxValidationResult {
  valid: boolean;
  errors: SyntaxError[];
  warnings: SyntaxWarning[];
  suggestions: string[];
  preview?: string;
  bracketAnalysis?: BracketAnalysis;
}

interface SyntaxError {
  line: number;
  column?: number;
  message: string;
  severity: 'critical' | 'error';
  fix?: string;
}

interface SyntaxWarning {
  line: number;
  message: string;
  fix?: string;
}

interface BracketAnalysis {
  blocks: BlockInfo[];
  mismatches: MismatchInfo[];
  summary: {
    totalBlocks: number;
    unclosedBlocks: number;
    extraEnds: number;
  };
}

interface BlockInfo {
  type: 'function' | 'if' | 'for' | 'while' | 'repeat' | 'do' | 'table';
  openLine: number;
  closeLine?: number;
  content: string;
  isClosed: boolean;
}

interface MismatchInfo {
  expectedAt: number;
  foundAt?: number;
  type: string;
  message: string;
}

export class LuauSyntaxValidator {
  private readonly blockKeywords = {
    'function': 'end',
    'if': 'end',
    'for': 'end',
    'while': 'end',
    'do': 'end',
    'repeat': 'until',
    '{': '}'
  };

  /**
   * VALIDATION PRINCIPALE - OBLIGATOIRE AVANT TOUTE MODIFICATION
   */
  public validateCode(code: string): SyntaxValidationResult {
    const errors: SyntaxError[] = [];
    const warnings: SyntaxWarning[] = [];
    const suggestions: string[] = [];
    
    // Analyse complète des blocs
    const bracketAnalysis = this.analyzeBlocks(code);
    
    // Convertir l'analyse en erreurs
    if (bracketAnalysis.summary.unclosedBlocks > 0) {
      bracketAnalysis.mismatches.forEach(mismatch => {
        errors.push({
          line: mismatch.expectedAt,
          message: mismatch.message,
          severity: 'critical',
          fix: `Ajouter '${mismatch.type}' à la ligne ${mismatch.expectedAt}`
        });
      });
    }

    // Vérifications supplémentaires
    const additionalChecks = this.performAdditionalChecks(code);
    errors.push(...additionalChecks.errors);
    warnings.push(...additionalChecks.warnings);

    // Générer des suggestions
    if (errors.length > 0) {
      suggestions.push(...this.generateSuggestions(code, errors));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      bracketAnalysis
    };
  }

  /**
   * ANALYSE DÉTAILLÉE DES BLOCS
   */
  private analyzeBlocks(code: string): BracketAnalysis {
    const lines = code.split('\n');
    const blocks: BlockInfo[] = [];
    const blockStack: BlockInfo[] = [];
    const mismatches: MismatchInfo[] = [];

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      
      // Ignorer les commentaires
      if (trimmed.startsWith('--')) return;

      // Détecter les ouvertures de blocs
      if (/\bfunction\b/.test(trimmed) && !trimmed.includes('end')) {
        const block: BlockInfo = {
          type: 'function',
          openLine: lineNum,
          content: trimmed,
          isClosed: false
        };
        blocks.push(block);
        blockStack.push(block);
      }
      
      if (/\bif\b.*\bthen\b/.test(trimmed) && !trimmed.includes('end')) {
        const block: BlockInfo = {
          type: 'if',
          openLine: lineNum,
          content: trimmed,
          isClosed: false
        };
        blocks.push(block);
        blockStack.push(block);
      }

      if (/\bfor\b.*\bdo\b/.test(trimmed) && !trimmed.includes('end')) {
        const block: BlockInfo = {
          type: 'for',
          openLine: lineNum,
          content: trimmed,
          isClosed: false
        };
        blocks.push(block);
        blockStack.push(block);
      }

      if (/\bwhile\b.*\bdo\b/.test(trimmed) && !trimmed.includes('end')) {
        const block: BlockInfo = {
          type: 'while',
          openLine: lineNum,
          content: trimmed,
          isClosed: false
        };
        blocks.push(block);
        blockStack.push(block);
      }

      if (/\brepeat\b/.test(trimmed)) {
        const block: BlockInfo = {
          type: 'repeat',
          openLine: lineNum,
          content: trimmed,
          isClosed: false
        };
        blocks.push(block);
        blockStack.push(block);
      }

      // Détecter les fermetures
      if (/\bend\b/.test(trimmed)) {
        if (blockStack.length > 0) {
          const lastBlock = blockStack[blockStack.length - 1];
          if (lastBlock.type !== 'repeat') {
            lastBlock.closeLine = lineNum;
            lastBlock.isClosed = true;
            blockStack.pop();
          }
        } else {
          mismatches.push({
            expectedAt: lineNum,
            type: 'end',
            message: `'end' supplémentaire trouvé à la ligne ${lineNum} sans bloc correspondant`
          });
        }
      }

      if (/\buntil\b/.test(trimmed)) {
        if (blockStack.length > 0 && blockStack[blockStack.length - 1].type === 'repeat') {
          const lastBlock = blockStack.pop()!;
          lastBlock.closeLine = lineNum;
          lastBlock.isClosed = true;
        } else {
          mismatches.push({
            expectedAt: lineNum,
            type: 'until',
            message: `'until' trouvé à la ligne ${lineNum} sans 'repeat' correspondant`
          });
        }
      }
    });

    // Vérifier les blocs non fermés
    blockStack.forEach(unclosedBlock => {
      const expectedClosing = unclosedBlock.type === 'repeat' ? 'until' : 'end';
      mismatches.push({
        expectedAt: unclosedBlock.openLine,
        type: expectedClosing,
        message: `Bloc '${unclosedBlock.type}' ouvert à la ligne ${unclosedBlock.openLine} n'est pas fermé. Il manque '${expectedClosing}'`
      });
    });

    return {
      blocks,
      mismatches,
      summary: {
        totalBlocks: blocks.length,
        unclosedBlocks: blockStack.length,
        extraEnds: mismatches.filter(m => m.message.includes('supplémentaire')).length
      }
    };
  }

  /**
   * VÉRIFICATIONS ADDITIONNELLES
   */
  private performAdditionalChecks(code: string): { errors: SyntaxError[], warnings: SyntaxWarning[] } {
    const errors: SyntaxError[] = [];
    const warnings: SyntaxWarning[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Vérifier les parenthèses
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        errors.push({
          line: lineNum,
          message: `Parenthèses non équilibrées: ${openParens} '(' et ${closeParens} ')'`,
          severity: 'error'
        });
      }

      // Vérifier les accolades
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      if (openBraces !== closeBraces && !line.includes('--')) {
        warnings.push({
          line: lineNum,
          message: `Accolades potentiellement non équilibrées sur cette ligne`
        });
      }

      // Détecter les erreurs courantes
      if (/\bfunction\s*\(/.test(line) && !/\bend\b/.test(line)) {
        warnings.push({
          line: lineNum,
          message: `Fonction anonyme détectée - assurez-vous qu'elle a un 'end' correspondant`
        });
      }

      // Vérifier les virgules dans les tables
      if (line.includes('}') && lines[index - 1]?.trim().endsWith(',')) {
        warnings.push({
          line: lineNum - 1,
          message: `Virgule superflue avant la fermeture de table`,
          fix: `Retirer la virgule à la fin de la ligne ${lineNum - 1}`
        });
      }
    });

    return { errors, warnings };
  }

  /**
   * GÉNÉRER DES SUGGESTIONS DE CORRECTION
   */
  private generateSuggestions(code: string, errors: SyntaxError[]): string[] {
    const suggestions: string[] = [];
    const lines = code.split('\n');

    // Analyser les erreurs pour des suggestions spécifiques
    errors.forEach(error => {
      if (error.message.includes("n'est pas fermé")) {
        suggestions.push(`💡 Ajoutez '${error.fix}' après la ligne ${error.line}`);
        
        // Trouver l'indentation appropriée
        const blockLine = lines[error.line - 1];
        const indent = blockLine.match(/^\s*/)?.[0] || '';
        suggestions.push(`💡 Code suggéré: ${indent}end`);
      }

      if (error.message.includes("supplémentaire")) {
        suggestions.push(`💡 Supprimez le 'end' à la ligne ${error.line} ou vérifiez s'il manque un bloc d'ouverture`);
      }
    });

    // Suggestions générales
    if (errors.length > 0) {
      suggestions.push("\n📝 Conseils généraux:");
      suggestions.push("- Vérifiez que chaque 'function', 'if', 'for', 'while' a son 'end'");
      suggestions.push("- Vérifiez que chaque 'repeat' a son 'until'");
      suggestions.push("- Utilisez l'indentation pour mieux voir la structure");
      suggestions.push("- Comptez visuellement les blocs ouverts et fermés");
    }

    return suggestions;
  }

  /**
   * PREVIEW D'UN PATCH AVANT APPLICATION
   */
  public previewPatch(originalCode: string, patch: any): SyntaxValidationResult {
    // Appliquer le patch temporairement
    const lines = originalCode.split('\n');
    let previewCode: string;

    switch (patch.operation) {
      case 'insert':
        lines.splice(patch.lineStart - 1, 0, ...(patch.newContent?.split('\n') || []));
        previewCode = lines.join('\n');
        break;
      
      case 'replace':
        const endLine = patch.lineEnd || patch.lineStart;
        lines.splice(
          patch.lineStart - 1, 
          endLine - patch.lineStart + 1,
          ...(patch.newContent?.split('\n') || [])
        );
        previewCode = lines.join('\n');
        break;
      
      case 'delete':
        const deleteEnd = patch.lineEnd || patch.lineStart;
        lines.splice(patch.lineStart - 1, deleteEnd - patch.lineStart + 1);
        previewCode = lines.join('\n');
        break;
      
      default:
        previewCode = originalCode;
    }

    // Valider le code résultant
    const result = this.validateCode(previewCode);
    result.preview = previewCode;
    
    return result;
  }

  /**
   * VALIDATION STRICTE POUR PATCH
   */
  public validatePatchContent(patchContent: string): SyntaxValidationResult {
    // Validation spécifique pour le contenu d'un patch
    const result = this.validateCode(patchContent);
    
    // Vérifications supplémentaires pour les patches
    if (patchContent.includes('function') && !patchContent.includes('end')) {
      result.errors.push({
        line: 1,
        message: "Le patch contient une fonction sans 'end' correspondant",
        severity: 'critical',
        fix: "Ajoutez 'end' à la fin de la fonction"
      });
      result.valid = false;
    }

    return result;
  }
}

// Export singleton pour usage global
export const syntaxValidator = new LuauSyntaxValidator();