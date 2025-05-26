import { promises as fs } from 'fs';
import * as path from 'path';

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalScripts: number;
    clientScripts: number;
    serverScripts: number;
    sharedModules: number;
    syntaxErrors: number;
    missingDependencies: number;
    securityIssues: number;
  };
}

interface ValidationError {
  file: string;
  line?: number;
  type: 'syntax' | 'dependency' | 'security' | 'structure';
  message: string;
  severity: 'error' | 'critical';
}

interface ValidationWarning {
  file: string;
  line?: number;
  type: string;
  message: string;
}

export class GameValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];
  private scripts: Map<string, string> = new Map();
  
  async validateGame(projectPath: string): Promise<ValidationResult> {
    this.errors = [];
    this.warnings = [];
    this.scripts.clear();
    
    // 1. Collecter tous les scripts
    await this.collectScripts(projectPath);
    
    // 2. Valider la structure du projet
    this.validateProjectStructure(projectPath);
    
    // 3. Valider chaque script
    for (const [filePath, content] of this.scripts) {
      await this.validateScript(filePath, content);
    }
    
    // 4. Valider les dépendances entre scripts
    this.validateDependencies();
    
    // 5. Vérifier la sécurité
    this.validateSecurity();
    
    // 6. Générer le résumé
    const summary = this.generateSummary();
    
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      summary
    };
  }
  
  private async collectScripts(dir: string, baseDir: string = dir): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await this.collectScripts(fullPath, baseDir);
      } else if (entry.name.endsWith('.luau') || entry.name.endsWith('.lua')) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const relativePath = path.relative(baseDir, fullPath);
        this.scripts.set(relativePath, content);
      }
    }
  }
  
  private validateProjectStructure(projectPath: string): void {
    const requiredFolders = ['src/client', 'src/server', 'src/shared'];
    
    for (const folder of requiredFolders) {
      const folderPath = path.join(projectPath, folder);
      if (!this.folderExists(folderPath)) {
        this.warnings.push({
          file: folder,
          type: 'structure',
          message: `Dossier manquant: ${folder}. Structure Rojo standard recommandée.`
        });
      }
    }
    
    // Vérifier default.project.json ou default.project.luau
    const rojoConfigJson = path.join(projectPath, 'default.project.json');
    const rojoConfigLuau = path.join(projectPath, 'default.project.luau');
    
    if (!this.fileExists(rojoConfigJson) && !this.fileExists(rojoConfigLuau)) {
      this.errors.push({
        file: 'default.project.json ou default.project.luau',
        type: 'structure',
        message: 'Fichier de configuration Rojo manquant',
        severity: 'critical'
      });
    }
  }
  
  private async validateScript(filePath: string, content: string): Promise<void> {
    const lines = content.split('\n');
    
    // 1. Validation syntaxique basique
    this.validateSyntax(filePath, lines);
    
    // 2. Validation des requires
    this.validateRequires(filePath, lines);
    
    // 3. Validation des patterns dangereux
    this.validatePatterns(filePath, lines);
    
    // 4. Validation spécifique au type de script
    if (filePath.includes('.client.')) {
      this.validateClientScript(filePath, lines);
    } else if (filePath.includes('.server.')) {
      this.validateServerScript(filePath, lines);
    }
  }
  
  private validateSyntax(filePath: string, lines: string[]): void {
    let blockStack: string[] = [];
    let bracketStack: string[] = [];
    const blockStarters = ['function', 'if', 'for', 'while', 'repeat', 'do', 'then'];
    const blockEnders = ['end', 'until'];
    
    // Pour un parsing plus robuste
    let inString = false;
    let stringChar = '';
    let inComment = false;
    
    lines.forEach((line, index) => {
      let i = 0;
      inComment = false;
      
      while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        // Gestion des commentaires
        if (!inString && char === '-' && nextChar === '-') {
          inComment = true;
          break; // Ignorer le reste de la ligne
        }
        
        // Gestion des strings
        if (!inComment) {
          if ((char === '"' || char === "'") && line[i-1] !== '\\') {
            if (!inString) {
              inString = true;
              stringChar = char;
            } else if (char === stringChar) {
              inString = false;
            }
          }
          
          // Si on n'est pas dans une string, analyser la syntaxe
          if (!inString) {
            // Vérifier les brackets
            if (char === '(' || char === '{' || char === '[') {
              bracketStack.push(char);
            } else if (char === ')' || char === '}' || char === ']') {
              const expected = char === ')' ? '(' : char === '}' ? '{' : '[';
              if (bracketStack.length === 0 || bracketStack[bracketStack.length - 1] !== expected) {
                this.errors.push({
                  file: filePath,
                  line: index + 1,
                  type: 'syntax',
                  message: `'${char}' sans '${expected}' correspondant`,
                  severity: 'error'
                });
              } else {
                bracketStack.pop();
              }
            }
          }
        }
        
        i++;
      }
      
      // Vérifier les mots-clés de bloc (hors strings et commentaires)
      if (!inComment && !inString) {
        const trimmed = line.trim();
        
        // Détecter les débuts de blocs
        for (const starter of blockStarters) {
          const pattern = new RegExp(`\\b${starter}\\b`);
          if (pattern.test(trimmed)) {
            // Cas spéciaux
            if (starter === 'then' && trimmed.includes('then return')) continue;
            if (starter === 'then' && trimmed.includes('then break')) continue;
            if (starter === 'do' && trimmed.includes('end')) continue; // do...end sur une ligne
            
            blockStack.push(starter);
          }
        }
        
        // Détecter les fins de blocs
        if (/\bend\b/.test(trimmed)) {
          if (blockStack.length === 0) {
            this.errors.push({
              file: filePath,
              line: index + 1,
              type: 'syntax',
              message: `'end' sans bloc correspondant`,
              severity: 'error'
            });
          } else {
            blockStack.pop();
          }
        }
      }
    });
    
    // Vérifier les stacks finaux
    if (blockStack.length > 0) {
      this.errors.push({
        file: filePath,
        type: 'syntax',
        message: `${blockStack.length} bloc(s) non fermé(s): ${blockStack.join(', ')}`,
        severity: 'error'
      });
    }
    
    if (bracketStack.length > 0) {
      this.errors.push({
        file: filePath,
        type: 'syntax',
        message: `${bracketStack.length} parenthèse(s)/accolade(s) non fermée(s): ${bracketStack.join(', ')}`,
        severity: 'error'
      });
    }
  }
  
  private validateRequires(filePath: string, lines: string[]): void {
    const requirePattern = /require\s*\(\s*([^)]+)\s*\)/g;
    const validPaths = new Set<string>();
    
    // Construire les chemins valides depuis les scripts collectés
    for (const scriptPath of this.scripts.keys()) {
      if (scriptPath.endsWith('.luau') || scriptPath.endsWith('.lua')) {
        const moduleName = path.basename(scriptPath, path.extname(scriptPath));
        validPaths.add(moduleName);
      }
    }
    
    lines.forEach((line, index) => {
      let match;
      while ((match = requirePattern.exec(line)) !== null) {
        const requirePath = match[1].trim();
        
        // Ignorer les requires de services Roblox
        if (requirePath.includes('game:GetService') || 
            requirePath.includes('script.Parent') ||
            requirePath.includes('ReplicatedStorage')) {
          continue;
        }
        
        // Vérifier si c'est un chemin relatif
        if (requirePath.includes('.') && !requirePath.includes('game.')) {
          const moduleName = requirePath.split('.').pop()?.replace(/["']/g, '');
          if (moduleName && !validPaths.has(moduleName)) {
            this.warnings.push({
              file: filePath,
              line: index + 1,
              type: 'dependency',
              message: `Module potentiellement manquant: ${moduleName}`
            });
          }
        }
      }
    });
  }
  
  private validatePatterns(filePath: string, lines: string[]): void {
    const dangerousPatterns = [
      { pattern: /\bwait\s*\(/, message: 'Utiliser task.wait() au lieu de wait()' },
      { pattern: /\bspawn\s*\(/, message: 'Utiliser task.spawn() au lieu de spawn()' },
      { pattern: /\bdelay\s*\(/, message: 'Utiliser task.delay() au lieu de delay()' },
      { pattern: /\bloadstring\s*\(/, message: 'loadstring() est dangereux et désactivé par défaut' },
      { pattern: /\b_G\b/, message: 'Éviter les variables globales _G' },
      { pattern: /while\s+true\s+do(?!.*wait)/, message: 'Boucle infinie sans wait détectée' }
    ];
    
    lines.forEach((line, index) => {
      for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(line) && !line.trim().startsWith('--')) {
          this.warnings.push({
            file: filePath,
            line: index + 1,
            type: 'pattern',
            message
          });
        }
      }
    });
  }
  
  private validateClientScript(filePath: string, lines: string[]): void {
    const hasPlayerGui = lines.some(line => line.includes('PlayerGui'));
    const hasUserInput = lines.some(line => line.includes('UserInputService'));
    
    // Vérifier l'accès aux services serveur depuis le client
    const serverOnlyServices = ['DataStoreService', 'MessagingService', 'TeleportService'];
    lines.forEach((line, index) => {
      for (const service of serverOnlyServices) {
        if (line.includes(service) && !line.trim().startsWith('--')) {
          this.errors.push({
            file: filePath,
            line: index + 1,
            type: 'security',
            message: `Accès interdit au service ${service} depuis un script client`,
            severity: 'critical'
          });
        }
      }
    });
  }
  
  private validateServerScript(filePath: string, lines: string[]): void {
    // Vérifier les RemoteEvents/Functions non validés
    const hasRemoteValidation = lines.some(line => 
      line.includes('typeof') || 
      line.includes('type(') || 
      line.includes('assert(')
    );
    
    const hasRemoteEvent = lines.some(line => 
      line.includes('RemoteEvent') || 
      line.includes('RemoteFunction')
    );
    
    if (hasRemoteEvent && !hasRemoteValidation) {
      this.warnings.push({
        file: filePath,
        type: 'security',
        message: 'RemoteEvent/Function sans validation apparente des entrées'
      });
    }
  }
  
  private validateDependencies(): void {
    // Vérifier les dépendances circulaires
    const dependencies = new Map<string, Set<string>>();
    
    for (const [filePath, content] of this.scripts) {
      const deps = new Set<string>();
      const requirePattern = /require\s*\([^)]+\)/g;
      let match;
      
      while ((match = requirePattern.exec(content)) !== null) {
        // Extraire le nom du module
        const moduleMatch = match[0].match(/["']([^"']+)["']/);
        if (moduleMatch) {
          deps.add(moduleMatch[1]);
        }
      }
      
      dependencies.set(filePath, deps);
    }
    
    // Détecter les cycles (simplifié)
    for (const [file, deps] of dependencies) {
      for (const dep of deps) {
        const depDeps = dependencies.get(dep);
        if (depDeps?.has(file)) {
          this.warnings.push({
            file,
            type: 'dependency',
            message: `Dépendance circulaire potentielle avec ${dep}`
          });
        }
      }
    }
  }
  
  private validateSecurity(): void {
    for (const [filePath, content] of this.scripts) {
      // Vérifier les backdoors potentielles
      const suspiciousPatterns = [
        { pattern: /require\s*\(\s*\d+\s*\)/, message: 'Require avec ID numérique (possible backdoor)' },
        { pattern: /getfenv|setfenv/, message: 'Manipulation d\'environnement détectée' },
        { pattern: /HttpService.*GetAsync/, message: 'Requête HTTP externe détectée' }
      ];
      
      suspiciousPatterns.forEach(({ pattern, message }) => {
        if (new RegExp(pattern).test(content)) {
          this.errors.push({
            file: filePath,
            type: 'security',
            message,
            severity: 'critical'
          });
        }
      });
    }
  }
  
  private generateSummary() {
    const scripts = Array.from(this.scripts.keys());
    
    return {
      totalScripts: scripts.length,
      clientScripts: scripts.filter(s => s.includes('.client.')).length,
      serverScripts: scripts.filter(s => s.includes('.server.')).length,
      sharedModules: scripts.filter(s => s.includes('/shared/')).length,
      syntaxErrors: this.errors.filter(e => e.type === 'syntax').length,
      missingDependencies: this.errors.filter(e => e.type === 'dependency').length,
      securityIssues: this.errors.filter(e => e.type === 'security').length
    };
  }
  
  private fileExists(filePath: string): boolean {
    try {
      return require('fs').existsSync(filePath);
    } catch {
      return false;
    }
  }
  
  private folderExists(folderPath: string): boolean {
    try {
      return require('fs').existsSync(folderPath) && 
             require('fs').statSync(folderPath).isDirectory();
    } catch {
      return false;
    }
  }
}

// Fonction pour intégration MCP
export async function validateGameTool(projectPath: string = process.cwd()): Promise<string> {
  const validator = new GameValidator();
  const result = await validator.validateGame(projectPath);
  
  let output = '🎮 VALIDATION DU PROJET ROBLOX\n';
  output += '================================\n\n';
  
  // Résumé
  output += '📊 RÉSUMÉ:\n';
  output += `- Scripts analysés: ${result.summary.totalScripts}\n`;
  output += `  - Client: ${result.summary.clientScripts}\n`;
  output += `  - Server: ${result.summary.serverScripts}\n`;
  output += `  - Shared: ${result.summary.sharedModules}\n\n`;
  
  // Status global
  if (result.valid) {
    output += '✅ PROJET VALIDE - Aucune erreur critique détectée!\n\n';
  } else {
    output += `❌ PROJET INVALIDE - ${result.errors.length} erreur(s) détectée(s)\n\n`;
  }
  
  // Erreurs
  if (result.errors.length > 0) {
    output += '🚨 ERREURS:\n';
    result.errors.forEach(error => {
      output += `\n[${error.severity.toUpperCase()}] ${error.file}`;
      if (error.line) output += `:${error.line}`;
      output += `\n  Type: ${error.type}\n  Message: ${error.message}\n`;
    });
    output += '\n';
  }
  
  // Warnings
  if (result.warnings.length > 0) {
    output += `⚠️  AVERTISSEMENTS (${result.warnings.length}):\n`;
    result.warnings.forEach(warning => {
      output += `\n${warning.file}`;
      if (warning.line) output += `:${warning.line}`;
      output += `\n  Type: ${warning.type}\n  Message: ${warning.message}\n`;
    });
  }
  
  // Recommandations
  output += '\n💡 RECOMMANDATIONS:\n';
  if (result.summary.syntaxErrors > 0) {
    output += '- Corriger les erreurs de syntaxe avant de tester\n';
  }
  if (result.summary.securityIssues > 0) {
    output += '- Réviser la sécurité des RemoteEvents/Functions\n';
  }
  if (result.warnings.some(w => w.type === 'pattern')) {
    output += '- Migrer vers les APIs modernes (task library)\n';
  }
  
  return output;
}

// Export for compatibility
export default validateGameTool;