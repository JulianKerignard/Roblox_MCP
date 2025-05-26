/**
 * Règles de syntaxe intégrées au serveur MCP pour guider Claude Desktop
 */

export const SYNTAX_RULES = {
  MANDATORY_WORKFLOW: `
🔴 RÈGLE OBLIGATOIRE POUR CLAUDE:

AVANT de modifier du code, TOUJOURS:
1. Utiliser 'search_in_scripts' pour trouver le code existant
2. Utiliser 'read_script' pour lire le fichier COMPLET
3. Utiliser 'syntax_helper action: "count_blocks"' pour analyser la structure
4. Utiliser 'preview_patch' avant d'appliquer les changements

JAMAIS écrire de code sans avoir d'abord cherché et lu!
`,

  PATCH_BEST_PRACTICES: `
⚠️ RÈGLES CRITIQUES POUR LES PATCHES:

1. TOUJOURS lire le fichier ENTIER avant de patcher
2. Compter TOUS les 'end' nécessaires:
   - function → end
   - if...then → end
   - for...do → end
   - while...do → end
   - repeat → until

3. Vérifier 10 lignes au-dessus et en-dessous du patch
4. Utiliser 'syntax_helper' pour valider AVANT de patcher
`,

  COMMON_MISTAKES: [
    {
      pattern: "Ajouter une fonction sans 'end'",
      solution: "Utiliser syntax_helper action: 'get_template', templateName: 'addFunction'"
    },
    {
      pattern: "Oublier les virgules dans les tables",
      solution: "Chaque élément sauf le dernier doit avoir une virgule"
    },
    {
      pattern: "Mélanger les accolades et les 'end'",
      solution: "Les tables utilisent {}, les blocs utilisent 'end'"
    }
  ]
};

/**
 * Vérification automatique avant patch
 */
export function validatePatchBeforeApply(
  fileContent: string,
  patchContent: string,
  operation: string,
  lineStart: number,
  lineEnd?: number
): { valid: boolean; warnings: string[]; suggestions: string[] } {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let valid = true;

  // Analyser le contenu du patch
  const patchLines = patchContent.split('\n');
  
  // Compter les éléments dans le patch
  let openBlocks = 0;
  let closeBlocks = 0;
  let openBraces = 0;
  let closeBraces = 0;

  patchLines.forEach(line => {
    const trimmed = line.trim();
    
    // Détecter les ouvertures de blocs
    if (/\b(function|if.*then|for.*do|while.*do)\b/.test(trimmed)) {
      openBlocks++;
    }
    
    // Détecter les fermetures
    if (/\bend\b/.test(trimmed)) {
      closeBlocks++;
    }
    
    // Compter les accolades
    openBraces += (line.match(/\{/g) || []).length;
    closeBraces += (line.match(/\}/g) || []).length;
  });

  // Vérifications pour l'opération 'insert'
  if (operation === 'insert') {
    if (openBlocks > closeBlocks) {
      warnings.push(`Le patch ouvre ${openBlocks} blocs mais n'en ferme que ${closeBlocks}`);
      suggestions.push(`Ajouter ${openBlocks - closeBlocks} 'end' à la fin du patch`);
      valid = false;
    }
    
    if (openBraces > closeBraces) {
      warnings.push(`Le patch ouvre ${openBraces} accolades mais n'en ferme que ${closeBraces}`);
      suggestions.push(`Ajouter ${openBraces - closeBraces} '}' pour fermer les tables`);
      valid = false;
    }
  }

  // Vérifications pour l'opération 'replace'
  if (operation === 'replace' && lineEnd) {
    // Compter ce qui est supprimé
    const fileLines = fileContent.split('\n');
    const removedLines = fileLines.slice(lineStart - 1, lineEnd);
    
    let removedOpenBlocks = 0;
    let removedCloseBlocks = 0;
    
    removedLines.forEach(line => {
      const trimmed = line.trim();
      if (/\b(function|if.*then|for.*do|while.*do)\b/.test(trimmed)) {
        removedOpenBlocks++;
      }
      if (/\bend\b/.test(trimmed)) {
        removedCloseBlocks++;
      }
    });
    
    // Calculer le delta
    const deltaOpen = openBlocks - removedOpenBlocks;
    const deltaClose = closeBlocks - removedCloseBlocks;
    
    if (deltaOpen !== deltaClose) {
      warnings.push(`Le remplacement change l'équilibre des blocs`);
      suggestions.push(`Vérifier que le nombre de 'end' correspond aux blocs ouverts`);
      valid = false;
    }
  }

  // Vérifications générales
  if (patchContent.includes('wait(')) {
    warnings.push("Utilisation de wait() détectée");
    suggestions.push("Remplacer wait() par task.wait()");
  }

  if (/\bgame\.Players\.\w+/.test(patchContent)) {
    warnings.push("Accès direct à un joueur spécifique");
    suggestions.push("Utiliser game.Players:GetPlayerByName() ou vérifier que le joueur existe");
  }

  return { valid, warnings, suggestions };
}

/**
 * Message système à injecter dans chaque réponse d'outil
 */
export function getSyntaxReminder(toolName: string): string {
  const criticalTools = ['write_script', 'patch_script', 'create_script'];
  
  if (criticalTools.includes(toolName)) {
    return `\n\n${SYNTAX_RULES.MANDATORY_WORKFLOW}`;
  }
  
  return '';
}

/**
 * Vérifier si Claude suit les bonnes pratiques
 */
export function checkWorkflowCompliance(
  toolHistory: string[],
  currentTool: string
): { compliant: boolean; message?: string } {
  const modifyingTools = ['write_script', 'patch_script', 'create_script'];
  
  if (modifyingTools.includes(currentTool)) {
    // Vérifier les 5 derniers outils utilisés
    const recentTools = toolHistory.slice(-5);
    
    const hasSearch = recentTools.some(tool => 
      tool.includes('search_in_scripts') || 
      tool.includes('get_project_structure')
    );
    
    const hasRead = recentTools.some(tool => 
      tool.includes('read_script')
    );
    
    if (!hasSearch || !hasRead) {
      return {
        compliant: false,
        message: "⚠️ ATTENTION: Vous n'avez pas suivi le workflow obligatoire!\n" +
                 "Utilisez 'search_in_scripts' et 'read_script' AVANT de modifier!"
      };
    }
  }
  
  return { compliant: true };
}