/**
 * Gestionnaire intelligent d'erreurs pour guider Claude automatiquement
 */

export interface ErrorPattern {
  pattern: RegExp;
  errorType: string;
  approach: string;
  steps: string[];
  warnings: string[];
}

/**
 * Patterns d'erreurs courants et leurs solutions
 */
export const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /Expected\s*<eof>,\s*got\s*['"]?end['"]?/i,
    errorType: "end_extra",
    approach: "MINIMAL - Retirer seulement le 'end' en trop",
    steps: [
      "Lire le fichier complet avec read_script",
      "Utiliser syntax_helper action: 'count_blocks' pour identifier le déséquilibre",
      "Localiser le 'end' en trop (souvent à la fin du fichier)",
      "Supprimer UNIQUEMENT ce 'end' avec patch_script operation: 'delete'"
    ],
    warnings: [
      "NE PAS réorganiser le code",
      "NE PAS ajouter de nouvelles fonctions",
      "NE PAS faire plusieurs patches",
      "Retirer SEULEMENT le 'end' en trop"
    ]
  },
  {
    pattern: /['"]?end['"]?\s*expected\s*\(to close/i,
    errorType: "end_missing",
    approach: "MINIMAL - Ajouter seulement le 'end' manquant",
    steps: [
      "Lire le fichier complet avec read_script",
      "Identifier quelle structure n'est pas fermée (function, if, for, etc.)",
      "Utiliser syntax_helper action: 'get_template' pour le bon format",
      "Ajouter UNIQUEMENT le 'end' manquant à la bonne indentation"
    ],
    warnings: [
      "NE PAS modifier le code existant",
      "NE PAS refactoriser",
      "Ajouter SEULEMENT le 'end' manquant"
    ]
  },
  {
    pattern: /unexpected symbol near ['"]?}['"]?/i,
    errorType: "brace_error",
    approach: "CIBLÉ - Corriger seulement l'erreur de syntaxe des accolades",
    steps: [
      "Lire la zone autour de l'erreur",
      "Vérifier si c'est une virgule manquante dans une table",
      "Corriger UNIQUEMENT le problème d'accolade"
    ],
    warnings: [
      "Les tables Lua nécessitent des virgules entre les éléments",
      "NE PAS restructurer toute la table"
    ]
  },
  {
    pattern: /attempt to (index|call) (a )?nil value/i,
    errorType: "nil_reference",
    approach: "DIAGNOSTIC - Identifier pourquoi la valeur est nil",
    steps: [
      "Chercher où la variable est déclarée avec search_in_scripts",
      "Vérifier l'ordre de déclaration (pas de référence anticipée)",
      "Ajouter une vérification nil si nécessaire"
    ],
    warnings: [
      "NE PAS réorganiser tout le fichier",
      "Vérifier seulement l'ordre de déclaration"
    ]
  },
  {
    pattern: /syntax error/i,
    errorType: "generic_syntax",
    approach: "ANALYTIQUE - Diagnostiquer avant de corriger",
    steps: [
      "Utiliser compile_check pour voir toutes les erreurs",
      "Utiliser syntax_helper action: 'validate_syntax'",
      "Corriger UNE erreur à la fois",
      "Recompiler après chaque correction"
    ],
    warnings: [
      "NE JAMAIS faire plusieurs corrections en même temps",
      "Toujours vérifier l'impact de chaque changement"
    ]
  }
];

/**
 * Analyser une erreur et retourner l'approche recommandée
 */
export function analyzeError(errorMessage: string): {
  pattern: ErrorPattern | null;
  directive: string;
  autoInstructions: string[];
} {
  // Chercher le pattern correspondant
  const matchedPattern = ERROR_PATTERNS.find(p => p.pattern.test(errorMessage));
  
  if (!matchedPattern) {
    return {
      pattern: null,
      directive: "Erreur non reconnue - Approche analytique requise",
      autoInstructions: [
        "Utiliser read_script pour comprendre le contexte",
        "Utiliser compile_check pour voir toutes les erreurs",
        "Corriger une erreur à la fois"
      ]
    };
  }

  // Construire la directive automatique
  const directive = `
## 🎯 DIRECTIVE AUTOMATIQUE: ${matchedPattern.errorType.toUpperCase()}

### Approche: ${matchedPattern.approach}

### ⚠️ RÈGLES CRITIQUES:
${matchedPattern.warnings.map(w => `- ${w}`).join('\n')}

### 📋 Étapes OBLIGATOIRES:
${matchedPattern.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### 🚫 INTERDICTIONS:
- NE PAS faire de refactoring
- NE PAS corriger ce qui n'est pas cassé
- NE PAS faire plusieurs patches d'affilée
- TOUJOURS utiliser preview_patch avant d'appliquer
`;

  return {
    pattern: matchedPattern,
    directive,
    autoInstructions: matchedPattern.steps
  };
}

/**
 * Générer un rapport d'analyse d'erreur pour Claude
 */
export function generateErrorAnalysisReport(
  errorMessage: string,
  filePath?: string,
  lineNumber?: number
): string {
  const analysis = analyzeError(errorMessage);
  
  let report = `## 🔍 Analyse automatique de l'erreur\n\n`;
  report += `**Erreur:** ${errorMessage}\n`;
  
  if (filePath) {
    report += `**Fichier:** ${filePath}\n`;
  }
  
  if (lineNumber) {
    report += `**Ligne:** ${lineNumber}\n`;
  }
  
  report += `\n${analysis.directive}\n`;
  
  // Ajouter des exemples de commandes
  report += `\n### 💻 Commandes à exécuter:\n\n`;
  
  if (filePath) {
    report += `1. \`read_script("${filePath}")\`\n`;
    report += `2. \`syntax_helper(action: "count_blocks", scriptPath: "${filePath}")\`\n`;
    report += `3. Analyser et appliquer UN SEUL patch ciblé\n`;
  }
  
  return report;
}

/**
 * Vérifier si Claude suit les directives
 */
export function validateApproach(
  errorType: string,
  plannedActions: string[]
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  // Vérifier les actions interdites
  const forbiddenPatterns = [
    { pattern: /create_script/i, message: "Création de fichier non nécessaire" },
    { pattern: /multiple.*patch/i, message: "Patches multiples détectés" },
    { pattern: /refactor/i, message: "Refactoring non autorisé pour cette erreur" },
    { pattern: /reorganize/i, message: "Réorganisation non nécessaire" }
  ];
  
  plannedActions.forEach(action => {
    forbiddenPatterns.forEach(forbidden => {
      if (forbidden.pattern.test(action)) {
        violations.push(forbidden.message);
      }
    });
  });
  
  return {
    valid: violations.length === 0,
    violations
  };
}

/**
 * Intercepteur pour les erreurs Roblox communes
 */
export const ROBLOX_SPECIFIC_ERRORS = {
  "attempt to index nil with 'Parent'": {
    hint: "L'objet a probablement été détruit. Ajouter une vérification: if object and object.Parent then",
    doNot: "NE PAS restructurer tout le code"
  },
  "Players.*.PlayerScripts": {
    hint: "Erreur côté client. Vérifier que les services sont bien initialisés",
    doNot: "NE PAS modifier la logique serveur"
  },
  "is not a valid member of": {
    hint: "L'objet n'existe pas encore. Utiliser :WaitForChild() ou vérifier l'existence",
    doNot: "NE PAS créer l'objet manuellement"
  }
};