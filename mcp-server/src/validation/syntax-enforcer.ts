/**
 * Système de validation syntaxique OBLIGATOIRE pour empêcher les erreurs
 */

interface SyntaxValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  blockAnalysis: {
    expectedEnds: number;
    foundEnds: number;
    unclosedBlocks: { type: string; line: number }[];
  };
}

export class SyntaxEnforcer {
  private readonly blockPatterns = {
    // Patterns pour détecter l'ouverture de blocs (avec support types Luau)
    function: /^\s*(?:local\s+)?function\s+\w+(?:<[^>]+>)?\s*\(|^\s*\w+\s*=\s*function(?:<[^>]+>)?\s*\(/,
    anonymousFunction: /function(?:<[^>]+>)?\s*\(/,
    typedFunction: /^\s*(?:local\s+)?\w+\s*:\s*(?:\([^)]*\)\s*->\s*[^=]+\s*)?=\s*function/,
    methodFunction: /^\s*function\s+\w+:\w+(?:<[^>]+>)?\s*\(/,
    if: /^\s*if\s+.+\s+then\s*$/,
    for: /^\s*for\s+.+\s+do\s*$/,
    while: /^\s*while\s+.+\s+do\s*$/,
    repeat: /^\s*repeat\s*$/,
    do: /^\s*do\s*$/,
  };

  private readonly endPattern = /^\s*end\s*(?:[,;)]|$)/;
  private readonly untilPattern = /^\s*until\s+/;
  
  // Patterns pour la syntaxe de types Luau
  private readonly typePatterns = {
    typeAlias: /^\s*(?:export\s+)?type\s+\w+(?:<[^>]+>)?\s*=/,
    typeAnnotation: /::\s*[^=]+(?:=|$)/,
    genericType: /<[^>]+>/,
    functionType: /\([^)]*\)\s*->\s*[^=]+/,
    unionType: /\w+\s*\|\s*\w+/,
    intersectionType: /\w+\s*&\s*\w+/,
    tableType: /\{[^}]*\}/,
  };

  /**
   * Valide OBLIGATOIREMENT la syntaxe avant toute modification
   */
  validateBeforeModification(
    originalContent: string,
    modifiedContent: string,
    operation: string
  ): SyntaxValidationResult {
    const result: SyntaxValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      blockAnalysis: {
        expectedEnds: 0,
        foundEnds: 0,
        unclosedBlocks: []
      }
    };

    // Analyser le contenu modifié
    const analysis = this.analyzeBlocks(modifiedContent);
    result.blockAnalysis = analysis;

    // Vérifier l'équilibre des blocs
    if (analysis.expectedEnds !== analysis.foundEnds) {
      result.isValid = false;
      const diff = analysis.expectedEnds - analysis.foundEnds;
      
      if (diff > 0) {
        result.errors.push(
          `❌ ERREUR CRITIQUE: Il manque ${diff} 'end' dans le code!`
        );
        result.errors.push(
          `   Attendu: ${analysis.expectedEnds} 'end'`
        );
        result.errors.push(
          `   Trouvé: ${analysis.foundEnds} 'end'`
        );
        
        // Ajouter des détails sur les blocs non fermés
        for (const block of analysis.unclosedBlocks) {
          result.errors.push(
            `   ⚠️ Bloc '${block.type}' non fermé à la ligne ${block.line}`
          );
        }
        
        result.suggestions.push(
          "💡 SOLUTION: Ajoutez les 'end' manquants avant de continuer"
        );
      } else {
        result.errors.push(
          `❌ ERREUR: Trop de 'end' (${-diff} en trop)`
        );
        result.suggestions.push(
          "💡 SOLUTION: Supprimez les 'end' en trop"
        );
      }
    }

    // Vérifier les parenthèses et accolades
    const bracketCheck = this.checkBrackets(modifiedContent);
    if (!bracketCheck.isValid) {
      result.isValid = false;
      result.errors.push(...bracketCheck.errors);
    }
    
    // Vérifier la syntaxe des types Luau
    const typeCheck = this.checkTypeSyntax(modifiedContent);
    if (!typeCheck.isValid) {
      result.isValid = false;
      result.errors.push(...typeCheck.errors);
    }
    result.warnings.push(...typeCheck.warnings);

    // Ajouter des warnings pour les mauvaises pratiques
    this.checkBadPractices(modifiedContent, result);

    return result;
  }

  /**
   * Analyse les blocs de code et compte les 'end' nécessaires
   */
  private analyzeBlocks(content: string): {
    expectedEnds: number;
    foundEnds: number;
    unclosedBlocks: { type: string; line: number }[];
  } {
    const lines = content.split('\n');
    const blockStack: { type: string; line: number }[] = [];
    let expectedEnds = 0;
    let foundEnds = 0;
    
    // États pour gérer les strings et commentaires
    let inMultiLineString = false;
    let inMultiLineComment = false;
    let multiLineStringLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // Vérifier les strings multi-lignes [[ ]]
      // Vérifier d'abord si c'est un commentaire multi-ligne
      if (!inMultiLineComment && line.includes('[[') && !line.includes('--[[')) {
        const startIndex = line.indexOf('[[');
        if (startIndex !== -1) {
          // Vérifier le nombre de = avant [[
          let equalCount = 0;
          let checkIdx = startIndex - 1;
          while (checkIdx >= 0 && line[checkIdx] === '=') {
            equalCount++;
            checkIdx--;
          }
          
          // Si ce n'est pas précédé par --, c'est une string multi-ligne
          if (checkIdx < 0 || line[checkIdx] !== '-') {
            inMultiLineString = true;
            multiLineStringLevel = equalCount;
          }
        }
      }
      
      if (inMultiLineString && line.includes(']]')) {
        const endIndex = line.indexOf(']]');
        if (endIndex !== -1) {
          // Vérifier le nombre de = avant ]]
          let equalCount = 0;
          let checkIdx = endIndex - 1;
          while (checkIdx >= 0 && line[checkIdx] === '=') {
            equalCount++;
            checkIdx--;
          }
          
          if (equalCount === multiLineStringLevel) {
            inMultiLineString = false;
          }
        }
      }
      
      // Si on est dans une string multi-ligne, ignorer cette ligne
      if (inMultiLineString) continue;
      
      // Vérifier les commentaires multi-lignes --[[ ]]
      if (line.includes('--[[')) {
        inMultiLineComment = true;
      }
      if (line.includes(']]') && inMultiLineComment) {
        inMultiLineComment = false;
        continue;
      }
      
      // Si on est dans un commentaire multi-ligne, ignorer
      if (inMultiLineComment) continue;

      // Ignorer les commentaires simples
      const commentIndex = line.indexOf('--');
      const cleanLine = commentIndex !== -1 ? line.substring(0, commentIndex) : line;
      
      // Ignorer les strings simples pour l'analyse des blocs
      const lineWithoutStrings = this.removeStringsFromLine(cleanLine);

      // Vérifier l'ouverture de blocs
      for (const [blockType, pattern] of Object.entries(this.blockPatterns)) {
        if (pattern.test(lineWithoutStrings)) {
          if (blockType !== 'anonymousFunction' || !lineWithoutStrings.includes('end')) {
            blockStack.push({ type: blockType, line: lineNum });
            expectedEnds++;
          }
        }
      }

      // Vérifier les 'end'
      if (this.endPattern.test(lineWithoutStrings)) {
        foundEnds++;
        if (blockStack.length > 0) {
          blockStack.pop();
        }
      }

      // Vérifier 'until' pour 'repeat'
      if (this.untilPattern.test(lineWithoutStrings)) {
        const lastBlock = blockStack[blockStack.length - 1];
        if (lastBlock && lastBlock.type === 'repeat') {
          blockStack.pop();
          expectedEnds--; // repeat...until n'a pas besoin de 'end'
        }
      }
    }

    return {
      expectedEnds,
      foundEnds,
      unclosedBlocks: [...blockStack]
    };
  }
  
  /**
   * Enlève les strings d'une ligne pour éviter les faux positifs
   */
  private removeStringsFromLine(line: string): string {
    let result = '';
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : '';
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        result += ' '; // Remplacer par espace pour garder la longueur
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        result += ' ';
      } else if (inString) {
        result += ' ';
      } else {
        result += char;
      }
    }
    
    return result;
  }

  /**
   * Vérifie l'équilibre des parenthèses et accolades
   */
  private checkBrackets(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const stack: { char: string; line: number; col: number }[] = [];
    const pairs: { [key: string]: string } = {
      '(': ')',
      '{': '}',
      '[': ']'
    };

    const lines = content.split('\n');
    let inString = false;
    let stringChar = '';
    let inMultiLineString = false;
    let multiLineStringLevel = 0;
    let inMultiLineComment = false;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      
      // Gestion des strings multi-lignes
      if (!inMultiLineComment && !inString && line.includes('[[') && !line.includes('--[[')) {
        const startIndex = line.indexOf('[[');
        if (startIndex !== -1) {
          let equalCount = 0;
          let checkIdx = startIndex - 1;
          while (checkIdx >= 0 && line[checkIdx] === '=') {
            equalCount++;
            checkIdx--;
          }
          
          if (checkIdx < 0 || line[checkIdx] !== '-') {
            inMultiLineString = true;
            multiLineStringLevel = equalCount;
          }
        }
      }
      
      if (inMultiLineString && line.includes(']]')) {
        const endIndex = line.indexOf(']]');
        if (endIndex !== -1) {
          let equalCount = 0;
          let checkIdx = endIndex - 1;
          while (checkIdx >= 0 && line[checkIdx] === '=') {
            equalCount++;
            checkIdx--;
          }
          
          if (equalCount === multiLineStringLevel) {
            inMultiLineString = false;
            continue;
          }
        }
      }
      
      // Gestion des commentaires multi-lignes
      if (line.includes('--[[') && !inString && !inMultiLineString) {
        inMultiLineComment = true;
      }
      if (line.includes(']]') && inMultiLineComment) {
        inMultiLineComment = false;
        continue;
      }
      
      // Si on est dans une string ou commentaire multi-ligne, ignorer
      if (inMultiLineString || inMultiLineComment) continue;
      
      for (let colIdx = 0; colIdx < line.length; colIdx++) {
        const char = line[colIdx];
        const prevChar = colIdx > 0 ? line[colIdx - 1] : '';
        const prevPrevChar = colIdx > 1 ? line[colIdx - 2] : '';

        // Gestion des chaînes avec meilleur support des échappements
        if ((char === '"' || char === "'") && !inString) {
          // Vérifier si c'est vraiment le début d'une string (pas échappé)
          if (prevChar !== '\\' || (prevChar === '\\' && prevPrevChar === '\\')) {
            inString = true;
            stringChar = char;
            continue;
          }
        } else if (inString && char === stringChar) {
          // Vérifier si c'est vraiment la fin de la string
          let escapeCount = 0;
          let checkIdx = colIdx - 1;
          while (checkIdx >= 0 && line[checkIdx] === '\\') {
            escapeCount++;
            checkIdx--;
          }
          // Si nombre pair de \, alors le caractère n'est pas échappé
          if (escapeCount % 2 === 0) {
            inString = false;
            continue;
          }
        }

        if (inString) continue;
        
        // Ignorer si on est dans un commentaire simple
        if (colIdx > 0 && line[colIdx - 1] === '-' && char === '-') {
          break; // Arrêter l'analyse de cette ligne
        }

        // Vérifier les ouvertures (sauf si c'est pour une string multi-ligne)
        if (char === '[' && colIdx < line.length - 1 && line[colIdx + 1] === '[') {
          continue; // Ignorer [[ pour les strings multi-lignes
        }
        
        if (char in pairs) {
          stack.push({ char, line: lineIdx + 1, col: colIdx + 1 });
        }
        // Vérifier les fermetures
        else if (Object.values(pairs).includes(char)) {
          if (char === ']' && colIdx < line.length - 1 && line[colIdx + 1] === ']') {
            continue; // Ignorer ]] pour les strings multi-lignes
          }
          
          if (stack.length === 0) {
            errors.push(
              `❌ '${char}' inattendu à la ligne ${lineIdx + 1}, colonne ${colIdx + 1}`
            );
          } else {
            const last = stack.pop()!;
            const expected = pairs[last.char];
            if (char !== expected) {
              errors.push(
                `❌ '${char}' inattendu à la ligne ${lineIdx + 1}. Attendu: '${expected}' pour fermer '${last.char}' de la ligne ${last.line}`
              );
            }
          }
        }
      }
    }

    // Vérifier les éléments non fermés
    for (const item of stack) {
      errors.push(
        `❌ '${item.char}' non fermé à la ligne ${item.line}, colonne ${item.col}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Vérifie les mauvaises pratiques
   */
  private checkBadPractices(content: string, result: SyntaxValidationResult): void {
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Variables globales potentielles
      if (/^\s*\w+\s*=/.test(line) && !line.includes('local') && !line.includes('.')) {
        result.warnings.push(
          `⚠️ Ligne ${lineNum}: Variable globale potentielle. Utilisez 'local'`
        );
      }

      // wait() déprécié
      if (/\bwait\s*\(/.test(line) && !line.includes('task.wait')) {
        result.warnings.push(
          `⚠️ Ligne ${lineNum}: wait() est déprécié. Utilisez task.wait()`
        );
      }

      // spawn() déprécié
      if (/\bspawn\s*\(/.test(line) && !line.includes('task.spawn')) {
        result.warnings.push(
          `⚠️ Ligne ${lineNum}: spawn() est déprécié. Utilisez task.spawn()`
        );
      }
    }
  }
  
  /**
   * Vérifie la syntaxe des types Luau
   */
  private checkTypeSyntax(content: string): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const lineWithoutStrings = this.removeStringsFromLine(line);
      
      // Vérifier les annotations de type ::
      if (lineWithoutStrings.includes('::')) {
        const typeAnnotationMatch = lineWithoutStrings.match(/::\s*([^=\n]+)/);
        if (typeAnnotationMatch) {
          const typeExpr = typeAnnotationMatch[1].trim();
          
          // Vérifier les generics mal formés
          const genericMatch = typeExpr.match(/<([^>]*)>/g);
          if (genericMatch) {
            for (const generic of genericMatch) {
              if (generic.includes('<') && !generic.includes('>')) {
                errors.push(`❌ Ligne ${lineNum}: Generic type mal fermé: ${generic}`);
              }
            }
          }
          
          // Vérifier les types de fonction
          if (typeExpr.includes('->')) {
            const funcTypeMatch = typeExpr.match(/\(([^)]*)\)\s*->\s*(.+)/);
            if (!funcTypeMatch) {
              errors.push(`❌ Ligne ${lineNum}: Syntaxe de type de fonction invalide`);
            }
          }
        }
      }
      
      // Vérifier les déclarations de type
      if (this.typePatterns.typeAlias.test(lineWithoutStrings)) {
        // Vérifier que le type a une définition valide
        const typeDefMatch = lineWithoutStrings.match(/type\s+(\w+)(?:<([^>]+)>)?\s*=\s*(.+)/);
        if (typeDefMatch) {
          const typeName = typeDefMatch[1];
          const generics = typeDefMatch[2];
          const definition = typeDefMatch[3];
          
          // Vérifier les paramètres génériques
          if (generics) {
            const genericParams = generics.split(',').map(g => g.trim());
            for (const param of genericParams) {
              if (!/^\w+$/.test(param)) {
                errors.push(`❌ Ligne ${lineNum}: Paramètre générique invalide: ${param}`);
              }
            }
          }
          
          // Vérifier que la définition n'est pas vide
          if (!definition || definition.trim() === '') {
            errors.push(`❌ Ligne ${lineNum}: Type ${typeName} sans définition`);
          }
        }
      }
      
      // Vérifier les fonctions génériques
      const genericFuncMatch = lineWithoutStrings.match(/function\s+(\w+)?(?:<([^>]+)>)?\s*\(/);
      if (genericFuncMatch && genericFuncMatch[2]) {
        const generics = genericFuncMatch[2];
        // Vérifier que les génériques sont bien formés
        if (generics.includes('<<') || generics.includes('>>')) {
          errors.push(`❌ Ligne ${lineNum}: Génériques mal formés dans la fonction`);
        }
      }
      
      // Vérifier les if expressions (nouvelle feature Luau)
      const ifExprMatch = lineWithoutStrings.match(/=\s*if\s+(.+)\s+then\s+(.+)\s+else\s+(.+)/);
      if (ifExprMatch) {
        // C'est une syntaxe valide en Luau moderne
        warnings.push(`💡 Ligne ${lineNum}: Utilisation de if expression (syntaxe Luau moderne)`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Force la validation avant l'application d'un patch
   */
  enforceValidation(
    originalContent: string,
    patch: any
  ): { canApply: boolean; validation: SyntaxValidationResult; fixedContent?: string } {
    // Simuler l'application du patch
    const simulatedContent = this.simulatePatch(originalContent, patch);
    
    // Valider le résultat
    const validation = this.validateBeforeModification(
      originalContent,
      simulatedContent,
      'patch'
    );

    if (!validation.isValid) {
      // Tenter une correction automatique
      const fixedContent = this.attemptAutoFix(simulatedContent, validation);
      if (fixedContent) {
        const revalidation = this.validateBeforeModification(
          originalContent,
          fixedContent,
          'patch-fixed'
        );
        
        if (revalidation.isValid) {
          return {
            canApply: true,
            validation: revalidation,
            fixedContent
          };
        }
      }
    }

    return {
      canApply: validation.isValid,
      validation
    };
  }

  /**
   * Simule l'application d'un patch
   */
  private simulatePatch(content: string, patch: any): string {
    // Cette méthode devrait simuler l'application du patch
    // Pour l'instant, retournons le contenu tel quel
    // TODO: Implémenter la simulation de patch
    return content;
  }

  /**
   * Tente de corriger automatiquement les erreurs simples
   */
  private attemptAutoFix(content: string, validation: SyntaxValidationResult): string | null {
    if (validation.blockAnalysis.expectedEnds > validation.blockAnalysis.foundEnds) {
      // Ajouter les 'end' manquants à la fin
      const missingEnds = validation.blockAnalysis.expectedEnds - validation.blockAnalysis.foundEnds;
      let fixed = content.trimRight();
      
      for (let i = 0; i < missingEnds; i++) {
        fixed += '\nend';
      }
      
      return fixed;
    }
    
    return null;
  }
  
  /**
   * Génère un snippet de code avec contexte pour les erreurs
   */
  private generateCodeSnippet(
    content: string, 
    lineNum: number, 
    errorMessage: string,
    contextLines: number = 3
  ): string {
    const lines = content.split('\n');
    const startLine = Math.max(0, lineNum - contextLines - 1);
    const endLine = Math.min(lines.length, lineNum + contextLines);
    
    let snippet = '\n```luau\n';
    
    for (let i = startLine; i < endLine; i++) {
      const currentLineNum = i + 1;
      const line = lines[i] || '';
      const isErrorLine = currentLineNum === lineNum;
      
      // Numéro de ligne avec padding
      const lineNumStr = currentLineNum.toString().padStart(4, ' ');
      
      if (isErrorLine) {
        snippet += `→ ${lineNumStr} | ${line}\n`;
        // Ajouter une flèche sous la ligne d'erreur
        const arrowPadding = ' '.repeat(lineNumStr.length + 3);
        snippet += `  ${arrowPadding}^^^ ${errorMessage}\n`;
      } else {
        snippet += `  ${lineNumStr} | ${line}\n`;
      }
    }
    
    snippet += '```\n';
    return snippet;
  }
  
  /**
   * Améliore les messages d'erreur avec du contexte
   */
  enhanceErrorMessages(
    content: string,
    validation: SyntaxValidationResult
  ): SyntaxValidationResult {
    const enhancedResult = { ...validation };
    enhancedResult.errors = [];
    
    // Améliorer les erreurs de blocs non fermés
    if (validation.blockAnalysis.unclosedBlocks.length > 0) {
      for (const block of validation.blockAnalysis.unclosedBlocks) {
        const errorMsg = `Missing 'end' for ${block.type} block`;
        const snippet = this.generateCodeSnippet(content, block.line, errorMsg);
        enhancedResult.errors.push(
          `❌ ERREUR: ${errorMsg} à la ligne ${block.line}${snippet}`
        );
      }
    }
    
    // Ajouter les autres erreurs avec contexte si possible
    for (const error of validation.errors) {
      // Extraire le numéro de ligne de l'erreur si présent
      const lineMatch = error.match(/ligne (\d+)/i);
      if (lineMatch) {
        const lineNum = parseInt(lineMatch[1]);
        const cleanError = error.replace(/❌\s*/, '').replace(/à la ligne \d+.*/, '').trim();
        const snippet = this.generateCodeSnippet(content, lineNum, cleanError);
        enhancedResult.errors.push(`❌ ${cleanError} à la ligne ${lineNum}${snippet}`);
      } else {
        enhancedResult.errors.push(error);
      }
    }
    
    return enhancedResult;
  }
}

// Export singleton
export const syntaxEnforcer = new SyntaxEnforcer();