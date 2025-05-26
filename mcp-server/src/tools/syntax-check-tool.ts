/**
 * Outil de vérification syntaxique pour Claude
 * Permet de vérifier la syntaxe AVANT de faire des modifications
 */

import { syntaxEnforcer } from '../validation/syntax-enforcer.js';

export interface SyntaxCheckRequest {
  scriptPath: string;
  content?: string;  // Si fourni, vérifie ce contenu. Sinon, lit le fichier
  operation?: 'check' | 'count_blocks' | 'find_unclosed';
}

export interface BlockCount {
  functions: number;
  ends: number;
  ifs: number;
  fors: number;
  whiles: number;
  dos: number;
  repeats: number;
  untils: number;
  openParens: number;
  closeParens: number;
  openBraces: number;
  closeBraces: number;
}

export class SyntaxCheckTool {
  
  /**
   * Vérifie la syntaxe d'un fichier ou d'un contenu
   */
  async checkSyntax(request: SyntaxCheckRequest, fileManager: any): Promise<string> {
    const operation = request.operation || 'check';
    
    // Obtenir le contenu à vérifier
    let content: string;
    if (request.content) {
      content = request.content;
    } else {
      try {
        content = await fileManager.readFile(request.scriptPath);
      } catch (error) {
        return `❌ Erreur: Impossible de lire le fichier ${request.scriptPath}`;
      }
    }

    switch (operation) {
      case 'count_blocks':
        return this.countBlocks(content, request.scriptPath);
        
      case 'find_unclosed':
        return this.findUnclosedBlocks(content, request.scriptPath);
        
      case 'check':
      default:
        return this.fullSyntaxCheck(content, request.scriptPath);
    }
  }

  /**
   * Compte tous les blocs et structures
   */
  private countBlocks(content: string, filePath: string): string {
    const lines = content.split('\n');
    const count: BlockCount = {
      functions: 0,
      ends: 0,
      ifs: 0,
      fors: 0,
      whiles: 0,
      dos: 0,
      repeats: 0,
      untils: 0,
      openParens: 0,
      closeParens: 0,
      openBraces: 0,
      closeBraces: 0
    };

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Ignorer les commentaires
      if (trimmed.startsWith('--')) continue;
      
      // Compter les structures
      if (/\bfunction\s*\(/.test(line)) count.functions++;
      if (/\bend\b/.test(line)) count.ends++;
      if (/\bif\b.*\bthen\b/.test(line)) count.ifs++;
      if (/\bfor\b.*\bdo\b/.test(line)) count.fors++;
      if (/\bwhile\b.*\bdo\b/.test(line)) count.whiles++;
      if (/\bdo\b\s*$/.test(line)) count.dos++;
      if (/\brepeat\b/.test(line)) count.repeats++;
      if (/\buntil\b/.test(line)) count.untils++;
      
      // Compter les parenthèses et accolades
      for (const char of line) {
        if (char === '(') count.openParens++;
        if (char === ')') count.closeParens++;
        if (char === '{') count.openBraces++;
        if (char === '}') count.closeBraces++;
      }
    }

    // Calculer les blocs attendus
    const expectedEnds = count.functions + count.ifs + count.fors + count.whiles + count.dos;
    const balance = expectedEnds - count.ends;

    let result = `📊 **Analyse des blocs: ${filePath}**\n\n`;
    result += `- **Functions:** ${count.functions}\n`;
    result += `- **End statements:** ${count.ends}\n`;
    result += `- **If blocks:** ${count.ifs}\n`;
    result += `- **For loops:** ${count.fors}\n`;
    result += `- **While loops:** ${count.whiles}\n`;
    result += `- **Do blocks:** ${count.dos}\n`;
    result += `- **Repeat/until:** ${count.repeats}/${count.untils}\n`;
    result += `- **Parenthèses:** ${count.openParens} ( et ${count.closeParens} )\n`;
    result += `- **Accolades:** ${count.openBraces} { et ${count.closeBraces} }\n`;
    result += `\n`;

    if (balance === 0) {
      result += `✅ **Blocs équilibrés!** (${expectedEnds} blocs, ${count.ends} ends)\n`;
    } else if (balance > 0) {
      result += `❌ **Il manque ${balance} 'end'!**\n`;
      result += `   Attendu: ${expectedEnds} 'end'\n`;
      result += `   Trouvé: ${count.ends} 'end'\n`;
    } else {
      result += `❌ **Il y a ${-balance} 'end' en trop!**\n`;
    }

    if (count.openParens !== count.closeParens) {
      result += `\n⚠️ **Parenthèses déséquilibrées:** ${count.openParens} ( vs ${count.closeParens} )`;
    }
    
    if (count.openBraces !== count.closeBraces) {
      result += `\n⚠️ **Accolades déséquilibrées:** ${count.openBraces} { vs ${count.closeBraces} }`;
    }

    return result;
  }

  /**
   * Trouve les blocs non fermés
   */
  private findUnclosedBlocks(content: string, filePath: string): string {
    const validation = syntaxEnforcer.validateBeforeModification('', content, 'check');
    
    let result = `🔍 **Recherche des blocs non fermés: ${filePath}**\n\n`;
    
    if (validation.blockAnalysis.unclosedBlocks.length === 0) {
      result += `✅ Tous les blocs sont correctement fermés!\n`;
    } else {
      result += `❌ **${validation.blockAnalysis.unclosedBlocks.length} bloc(s) non fermé(s):**\n\n`;
      
      for (const block of validation.blockAnalysis.unclosedBlocks) {
        result += `- **${block.type}** à la ligne ${block.line}\n`;
      }
      
      result += `\n💡 **Solution:** Ajoutez ${validation.blockAnalysis.unclosedBlocks.length} 'end' pour fermer ces blocs.`;
    }
    
    return result;
  }

  /**
   * Vérification complète de la syntaxe
   */
  private fullSyntaxCheck(content: string, filePath: string): string {
    const validation = syntaxEnforcer.validateBeforeModification('', content, 'check');
    
    let result = `🔍 **Vérification syntaxique: ${filePath}**\n\n`;
    
    if (validation.isValid) {
      result += `✅ **SYNTAXE VALIDE!**\n\n`;
      result += `- Blocs équilibrés: ${validation.blockAnalysis.expectedEnds} blocs, ${validation.blockAnalysis.foundEnds} ends\n`;
      result += `- Pas d'erreurs détectées\n`;
    } else {
      result += `❌ **SYNTAXE INVALIDE!**\n\n`;
      result += `**Erreurs:**\n`;
      for (const error of validation.errors) {
        result += `- ${error}\n`;
      }
      
      if (validation.blockAnalysis.unclosedBlocks.length > 0) {
        result += `\n**Blocs non fermés:**\n`;
        for (const block of validation.blockAnalysis.unclosedBlocks) {
          result += `- ${block.type} à la ligne ${block.line}\n`;
        }
      }
      
      if (validation.suggestions.length > 0) {
        result += `\n**Suggestions:**\n`;
        for (const suggestion of validation.suggestions) {
          result += `- ${suggestion}\n`;
        }
      }
    }
    
    if (validation.warnings.length > 0) {
      result += `\n⚠️ **Avertissements:**\n`;
      for (const warning of validation.warnings) {
        result += `- ${warning}\n`;
      }
    }
    
    return result;
  }
}

export const syntaxCheckTool = new SyntaxCheckTool();