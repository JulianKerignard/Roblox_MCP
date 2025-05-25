export interface AntiPattern {
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  pattern: RegExp;
  fix?: string;
  example?: string;
}

export const robloxAntiPatterns: AntiPattern[] = [
  // === PERFORMANCE KILLERS ===
  {
    name: "infinite-loop-no-wait",
    description: "Boucle infinie sans wait() - va faire crash le serveur",
    severity: "error",
    pattern: /while\s+true\s+do(?![\s\S]*?wait\s*\()/,
    fix: "Ajouter wait() ou task.wait() dans la boucle",
    example: "while true do\n    wait(0.1) -- Ajouter ceci!\n    -- code\nend"
  },
  
  {
    name: "repeat-no-wait",
    description: "Boucle repeat sans wait() - performance issue",
    severity: "error",
    pattern: /repeat(?![\s\S]*?wait\s*\()[\s\S]*?until/,
    fix: "Ajouter wait() dans la boucle repeat",
  },

  {
    name: "for-loop-excessive",
    description: "Boucle for avec plus de 10000 itérations sans yield",
    severity: "warning",
    pattern: /for\s+\w+\s*=\s*\d+\s*,\s*(\d{5,})/,
    fix: "Diviser en chunks ou ajouter task.wait() tous les 1000 items",
  },

  // === MEMORY LEAKS ===
  {
    name: "connection-not-disconnected",
    description: "Connection non déconnectée - memory leak potentiel",
    severity: "warning",
    pattern: /:Connect\s*\([^)]*\)(?![\s\S]{0,100}:Disconnect\(\))/,
    fix: "Stocker la connection et appeler :Disconnect() quand plus nécessaire",
    example: "local connection = event:Connect(function() end)\n-- Plus tard:\nconnection:Disconnect()"
  },

  {
    name: "instance-parent-nil",
    description: "Instance créée mais parent non défini immédiatement",
    severity: "info",
    pattern: /Instance\.new\s*\([^)]+\)(?!\.Parent|[\s\S]{0,20}\.Parent\s*=)/,
    fix: "Définir toutes les propriétés avant de définir Parent pour éviter les updates multiples",
    example: "local part = Instance.new('Part')\npart.Size = Vector3.new(4,1,2)\npart.Parent = workspace -- Toujours en dernier!"
  },

  // === DEPRECATED/DANGEREUX ===
  {
    name: "wait-deprecated",
    description: "wait() est déprécié, utiliser task.wait()",
    severity: "warning",
    pattern: /\bwait\s*\(/,
    fix: "Remplacer wait() par task.wait()",
  },

  {
    name: "spawn-deprecated",
    description: "spawn() est déprécié, utiliser task.spawn()",
    severity: "warning",
    pattern: /\bspawn\s*\(/,
    fix: "Remplacer spawn() par task.spawn()",
  },

  {
    name: "delay-deprecated",
    description: "delay() est déprécié, utiliser task.delay()",
    severity: "warning",
    pattern: /\bdelay\s*\(/,
    fix: "Remplacer delay() par task.delay()",
  },

  // === SÉCURITÉ ===
  {
    name: "loadstring-usage",
    description: "loadstring() est dangereux et désactivé par défaut",
    severity: "error",
    pattern: /\bloadstring\s*\(/,
    fix: "Éviter loadstring, utiliser des modules à la place",
  },

  {
    name: "remote-no-validation",
    description: "RemoteEvent/Function sans validation des données",
    severity: "warning",
    pattern: /OnServerEvent:Connect\s*\(\s*function\s*\([^)]*\)(?![\s\S]{0,50}(if|assert|type))/,
    fix: "Toujours valider les données reçues du client",
    example: "remoteEvent.OnServerEvent:Connect(function(player, data)\n    if type(data) ~= 'table' then return end\n    -- Valider plus...\nend)"
  },

  // === MAUVAISES PRATIQUES ===
  {
    name: "global-variable",
    description: "Variable globale détectée (pollution de l'environnement)",
    severity: "warning",
    pattern: /^(?!local\s+)\s*([a-zA-Z_]\w*)\s*=/m,
    fix: "Utiliser 'local' devant toutes les variables",
  },

  {
    name: "findfirstchild-chain",
    description: "Chaîne de FindFirstChild sans vérification nil",
    severity: "warning",
    pattern: /:FindFirstChild\([^)]+\):FindFirstChild/,
    fix: "Vérifier chaque FindFirstChild avant de continuer",
    example: "local child1 = parent:FindFirstChild('Name')\nif child1 then\n    local child2 = child1:FindFirstChild('SubName')\nend"
  },

  {
    name: "humanoid-died-memory",
    description: "Humanoid.Died sans cleanup peut causer des memory leaks",
    severity: "info",
    pattern: /Humanoid\.Died:Connect/,
    fix: "Nettoyer les connections quand le personnage est détruit",
  },

  // === PERFORMANCE SPECIFIQUE ROBLOX ===
  {
    name: "touched-no-debounce",
    description: "Touched event sans debounce - peut spam",
    severity: "warning",
    pattern: /\.Touched:Connect\s*\((?![\s\S]*debounce)/,
    fix: "Ajouter un debounce pour éviter le spam",
    example: "local debounce = false\npart.Touched:Connect(function(hit)\n    if debounce then return end\n    debounce = true\n    -- code\n    wait(1)\n    debounce = false\nend)"
  },

  {
    name: "getchildren-in-loop",
    description: "GetChildren/GetDescendants dans une boucle - très lent",
    severity: "warning",
    pattern: /(?:while|for|repeat)[\s\S]*?:(?:GetChildren|GetDescendants)\s*\(/,
    fix: "Mettre GetChildren en cache avant la boucle",
    example: "local children = parent:GetChildren() -- Cache\nfor i, child in ipairs(children) do\n    -- utiliser child\nend"
  },

  {
    name: "magnitude-squared",
    description: "Utiliser Magnitude pour comparer des distances",
    severity: "info",
    pattern: /\.Magnitude\s*[<>]=?\s*\d+/,
    fix: "Utiliser (position1 - position2).Magnitude <= distance",
    example: "-- Plus rapide:\nif (pos1 - pos2).Magnitude < 50 then"
  }
];

// Fonction pour analyser le code
export function detectAntiPatterns(code: string): Array<{pattern: AntiPattern, line: number, match: string}> {
  const detectedPatterns: Array<{pattern: AntiPattern, line: number, match: string}> = [];
  const lines = code.split('\n');
  
  for (const antiPattern of robloxAntiPatterns) {
    // Test sur le code complet pour certains patterns
    const globalMatch = code.match(antiPattern.pattern);
    if (globalMatch) {
      // Trouver la ligne
      let lineNumber = 1;
      let position = 0;
      for (let i = 0; i < lines.length; i++) {
        if (position <= globalMatch.index! && position + lines[i].length >= globalMatch.index!) {
          lineNumber = i + 1;
          break;
        }
        position += lines[i].length + 1; // +1 pour le \n
      }
      
      detectedPatterns.push({
        pattern: antiPattern,
        line: lineNumber,
        match: globalMatch[0].substring(0, 50) + (globalMatch[0].length > 50 ? '...' : '')
      });
    }
  }
  
  return detectedPatterns;
}

// Fonction pour obtenir des suggestions de fix
export function getAntiPatternSuggestions(patterns: ReturnType<typeof detectAntiPatterns>): string {
  if (patterns.length === 0) return '';
  
  let suggestions = '## ⚠️ **Anti-patterns détectés**\n\n';
  
  // Grouper par sévérité
  const byServerity = {
    error: patterns.filter(p => p.pattern.severity === 'error'),
    warning: patterns.filter(p => p.pattern.severity === 'warning'),
    info: patterns.filter(p => p.pattern.severity === 'info')
  };
  
  if (byServerity.error.length > 0) {
    suggestions += '### 🔴 **ERREURS CRITIQUES**\n';
    byServerity.error.forEach(({pattern, line, match}) => {
      suggestions += `\n**Ligne ${line}:** ${pattern.description}\n`;
      suggestions += `\`\`\`luau\n${match}\n\`\`\`\n`;
      if (pattern.fix) suggestions += `💡 **Fix:** ${pattern.fix}\n`;
      if (pattern.example) suggestions += `📝 **Exemple:**\n\`\`\`luau\n${pattern.example}\n\`\`\`\n`;
    });
  }
  
  if (byServerity.warning.length > 0) {
    suggestions += '\n### 🟡 **AVERTISSEMENTS**\n';
    byServerity.warning.forEach(({pattern, line}) => {
      suggestions += `- **Ligne ${line}:** ${pattern.description}`;
      if (pattern.fix) suggestions += ` → ${pattern.fix}`;
      suggestions += '\n';
    });
  }
  
  if (byServerity.info.length > 0) {
    suggestions += '\n### 🔵 **SUGGESTIONS**\n';
    byServerity.info.forEach(({pattern, line}) => {
      suggestions += `- **Ligne ${line}:** ${pattern.description}\n`;
    });
  }
  
  return suggestions;
}