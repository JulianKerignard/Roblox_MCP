import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import fs from 'fs-extra';

const execAsync = promisify(exec);

interface CompileResult {
  success: boolean;
  errors: CompileError[];
  warnings: CompileWarning[];
  output: string;
}

interface CompileError {
  file: string;
  line: number;
  column?: number;
  message: string;
  code?: string;
}

interface CompileWarning {
  file: string;
  line: number;
  message: string;
}

export class LuauCompiler {
  private projectRoot: string;
  
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }
  
  /**
   * Simule une compilation Luau en utilisant luau-analyze ou une validation syntaxique
   */
  async compileCheck(filePath?: string): Promise<CompileResult> {
    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];
    let output = '';
    
    try {
      // Option 1: Si luau-analyze est installé
      const luauPath = await this.findLuauAnalyze();
      if (luauPath) {
        return await this.runLuauAnalyze(filePath);
      }
      
      // Option 2: Utiliser Rojo pour une vérification
      const rojoCheck = await this.runRojoCheck();
      if (rojoCheck) {
        return rojoCheck;
      }
      
      // Option 3: Parser syntaxique personnalisé
      return await this.customSyntaxCheck(filePath);
      
    } catch (error) {
      return {
        success: false,
        errors: [{
          file: filePath || 'unknown',
          line: 0,
          message: `Erreur de compilation: ${error}`
        }],
        warnings: [],
        output: `Erreur: ${error}`
      };
    }
  }
  
  /**
   * Cherche luau-analyze dans le système
   */
  private async findLuauAnalyze(): Promise<string | null> {
    try {
      // Vérifier si luau-analyze est dans PATH
      const { stdout } = await execAsync('which luau-analyze || where luau-analyze');
      return stdout.trim();
    } catch {
      // Vérifier dans node_modules
      const localPath = path.join(this.projectRoot, 'node_modules', '.bin', 'luau-analyze');
      if (await fs.pathExists(localPath)) {
        return localPath;
      }
      return null;
    }
  }
  
  /**
   * Exécute luau-analyze
   */
  private async runLuauAnalyze(filePath?: string): Promise<CompileResult> {
    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];
    
    try {
      const command = filePath 
        ? `luau-analyze "${filePath}"`
        : `luau-analyze src/**/*.luau`;
        
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectRoot
      });
      
      // Parser la sortie de luau-analyze
      const lines = (stdout + stderr).split('\n');
      for (const line of lines) {
        // Format typique: file.luau(10,5): Error: message
        const errorMatch = line.match(/(.+?)\((\d+),(\d+)\):\s*(Error|Warning):\s*(.+)/);
        if (errorMatch) {
          const [, file, lineNum, col, type, message] = errorMatch;
          if (type === 'Error') {
            errors.push({
              file,
              line: parseInt(lineNum),
              column: parseInt(col),
              message
            });
          } else {
            warnings.push({
              file,
              line: parseInt(lineNum),
              message
            });
          }
        }
      }
      
      return {
        success: errors.length === 0,
        errors,
        warnings,
        output: stdout + stderr
      };
      
    } catch (error: any) {
      // Même en cas d'erreur, parser la sortie
      const output = error.stdout || '' + error.stderr || '';
      return {
        success: false,
        errors: [{
          file: filePath || 'project',
          line: 0,
          message: output || error.message
        }],
        warnings,
        output
      };
    }
  }
  
  /**
   * Utilise Rojo pour vérifier la syntaxe
   */
  private async runRojoCheck(): Promise<CompileResult | null> {
    try {
      // Tenter un build Rojo sans écrire le fichier
      const { stderr } = await execAsync('rojo build default.project.json --output /dev/null', {
        cwd: this.projectRoot
      });
      
      if (stderr && stderr.includes('error')) {
        return {
          success: false,
          errors: [{
            file: 'project',
            line: 0,
            message: stderr
          }],
          warnings: [],
          output: stderr
        };
      }
      
      return {
        success: true,
        errors: [],
        warnings: [],
        output: 'Rojo build successful'
      };
      
    } catch {
      return null;
    }
  }
  
  /**
   * Vérification syntaxique personnalisée plus avancée
   */
  private async customSyntaxCheck(filePath?: string): Promise<CompileResult> {
    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];
    
    const files = filePath 
      ? [filePath]
      : await this.getAllLuauFiles();
    
    for (const file of files) {
      const content = await fs.readFile(path.join(this.projectRoot, file), 'utf-8');
      const fileErrors = this.checkLuauSyntax(content, file);
      errors.push(...fileErrors.errors);
      warnings.push(...fileErrors.warnings);
    }
    
    return {
      success: errors.length === 0,
      errors,
      warnings,
      output: this.formatCompileOutput(errors, warnings)
    };
  }
  
  /**
   * Vérification syntaxique avancée d'un fichier Luau
   */
  private checkLuauSyntax(content: string, filePath: string): { errors: CompileError[], warnings: CompileWarning[] } {
    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];
    const lines = content.split('\n');
    
    // Stack pour les structures de blocs
    const blockStack: Array<{type: string, line: number}> = [];
    const bracketStack: Array<{char: string, line: number, col: number}> = [];
    
    // État du parser
    let inString = false;
    let inMultiLineString = false;
    let stringChar = '';
    let multiLineStringLevel = 0;
    
    lines.forEach((line, lineIndex) => {
      const lineNum = lineIndex + 1;
      let col = 0;
      
      // Vérifier les strings multi-lignes
      const multiLineStart = line.match(/\[(=*)\[/);
      if (multiLineStart && !inString) {
        inMultiLineString = true;
        multiLineStringLevel = multiLineStart[1].length;
      }
      
      const multiLineEnd = line.match(/\](=*)\]/);
      if (multiLineEnd && inMultiLineString && multiLineEnd[1].length === multiLineStringLevel) {
        inMultiLineString = false;
      }
      
      if (inMultiLineString) return;
      
      // Analyser caractère par caractère
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        col = i + 1;
        
        // Ignorer les commentaires
        if (!inString && char === '-' && nextChar === '-') {
          break;
        }
        
        // Gérer les strings
        if ((char === '"' || char === "'") && (i === 0 || line[i-1] !== '\\')) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
        }
        
        // Vérifier la syntaxe hors strings
        if (!inString) {
          // Vérifier les brackets
          if (char === '(' || char === '{' || char === '[') {
            bracketStack.push({char, line: lineNum, col});
          } else if (char === ')' || char === '}' || char === ']') {
            const expected = char === ')' ? '(' : char === '}' ? '{' : '[';
            if (bracketStack.length === 0) {
              errors.push({
                file: filePath,
                line: lineNum,
                column: col,
                message: `'${char}' inattendu sans '${expected}' correspondant`,
                code: 'E001'
              });
            } else {
              const last = bracketStack[bracketStack.length - 1];
              if (last.char !== expected) {
                errors.push({
                  file: filePath,
                  line: lineNum,
                  column: col,
                  message: `'${char}' ne correspond pas à '${last.char}' ligne ${last.line}`,
                  code: 'E002'
                });
              } else {
                bracketStack.pop();
              }
            }
          }
        }
      }
      
      // Vérifier les blocs (hors strings)
      if (!inString && !inMultiLineString) {
        const trimmed = line.trim();
        
        // Détection des débuts de blocs
        const blockStarters = [
          { pattern: /\bfunction\s+\w+/, type: 'function' },
          { pattern: /\bfunction\s*\(/, type: 'function' },
          { pattern: /\bif\s+.+\s+then/, type: 'if' },
          { pattern: /\bfor\s+.+\s+do/, type: 'for' },
          { pattern: /\bwhile\s+.+\s+do/, type: 'while' },
          { pattern: /\brepeat\b/, type: 'repeat' },
          { pattern: /\bdo\b/, type: 'do' }
        ];
        
        for (const starter of blockStarters) {
          if (starter.pattern.test(trimmed)) {
            // Ignorer si c'est une ligne simple (then return, etc.)
            if (!trimmed.includes('then return') && 
                !trimmed.includes('then break') &&
                !trimmed.includes('do return') &&
                !trimmed.includes('do break')) {
              blockStack.push({type: starter.type, line: lineNum});
            }
          }
        }
        
        // Détection des fins de blocs
        if (/\bend\b/.test(trimmed)) {
          if (blockStack.length === 0) {
            errors.push({
              file: filePath,
              line: lineNum,
              message: "'end' sans bloc correspondant",
              code: 'E003'
            });
          } else {
            blockStack.pop();
          }
        }
        
        if (/\buntil\b/.test(trimmed)) {
          const last = blockStack[blockStack.length - 1];
          if (!last || last.type !== 'repeat') {
            errors.push({
              file: filePath,
              line: lineNum,
              message: "'until' sans 'repeat' correspondant",
              code: 'E004'
            });
          } else {
            blockStack.pop();
          }
        }
        
        // Détection des patterns dangereux
        if (/\bwait\s*\(/.test(trimmed)) {
          warnings.push({
            file: filePath,
            line: lineNum,
            message: "Utiliser task.wait() au lieu de wait()"
          });
        }
        
        // Variables non déclarées (simple check)
        const assignmentMatch = trimmed.match(/^(\w+)\s*=/);
        if (assignmentMatch && !trimmed.startsWith('local ')) {
          const varName = assignmentMatch[1];
          if (!['_G', 'game', 'script', 'workspace'].includes(varName)) {
            warnings.push({
              file: filePath,
              line: lineNum,
              message: `Variable globale potentielle: ${varName}. Utilisez 'local'`
            });
          }
        }
      }
    });
    
    // Vérifications finales
    if (blockStack.length > 0) {
      blockStack.forEach(block => {
        errors.push({
          file: filePath,
          line: block.line,
          message: `Bloc '${block.type}' non fermé (manque 'end')`,
          code: 'E005'
        });
      });
    }
    
    if (bracketStack.length > 0) {
      bracketStack.forEach(bracket => {
        errors.push({
          file: filePath,
          line: bracket.line,
          column: bracket.col,
          message: `'${bracket.char}' non fermé`,
          code: 'E006'
        });
      });
    }
    
    return { errors, warnings };
  }
  
  /**
   * Récupère tous les fichiers Luau du projet
   */
  private async getAllLuauFiles(): Promise<string[]> {
    const files: string[] = [];
    
    async function scanDir(dir: string, base: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(base, fullPath);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await scanDir(fullPath, base);
        } else if (entry.isFile() && (entry.name.endsWith('.luau') || entry.name.endsWith('.lua'))) {
          files.push(relativePath);
        }
      }
    }
    
    await scanDir(path.join(this.projectRoot, 'src'), this.projectRoot);
    return files;
  }
  
  /**
   * Formate la sortie de compilation
   */
  private formatCompileOutput(errors: CompileError[], warnings: CompileWarning[]): string {
    let output = '';
    
    if (errors.length === 0 && warnings.length === 0) {
      output = '✅ Compilation réussie! Aucune erreur détectée.\n';
    } else {
      if (errors.length > 0) {
        output += `❌ ${errors.length} erreur(s) de compilation:\n\n`;
        errors.forEach(err => {
          output += `${err.file}:${err.line}${err.column ? ':' + err.column : ''}: error ${err.code || ''}: ${err.message}\n`;
        });
        output += '\n';
      }
      
      if (warnings.length > 0) {
        output += `⚠️  ${warnings.length} avertissement(s):\n\n`;
        warnings.forEach(warn => {
          output += `${warn.file}:${warn.line}: warning: ${warn.message}\n`;
        });
      }
    }
    
    return output;
  }
}

/**
 * Tool pour MCP - Simule une compilation
 */
export async function compileCheckTool(projectPath: string = process.cwd(), targetFile?: string): Promise<string> {
  const compiler = new LuauCompiler(projectPath);
  const result = await compiler.compileCheck(targetFile);
  
  let output = '🔨 VÉRIFICATION DE COMPILATION LUAU\n';
  output += '=====================================\n\n';
  
  if (result.success) {
    output += '✅ **COMPILATION RÉUSSIE**\n\n';
    output += 'Aucune erreur de syntaxe détectée!\n';
  } else {
    output += '❌ **ÉCHEC DE COMPILATION**\n\n';
    output += result.output;
  }
  
  if (result.warnings.length > 0) {
    output += `\n⚠️  ${result.warnings.length} avertissement(s) détecté(s)\n`;
  }
  
  // Exemple de sortie similaire à un vrai compilateur
  if (!result.success) {
    output += '\n```\n';
    output += 'Build failed with errors.\n';
    output += `Error summary: ${result.errors.length} error(s), ${result.warnings.length} warning(s)\n`;
    output += '```';
  }
  
  return output;
}