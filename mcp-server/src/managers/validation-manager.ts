/**
 * Code validation and anti-pattern detection
 */

import { IValidationManager, ValidationResult, ValidationError, ValidationWarning } from '../interfaces/managers.js';
import fs from 'fs-extra';
import path from 'path';
import { detectAntiPatterns } from '../../antipatterns.js';
import { countSyntaxElements, validateSyntaxBalance } from '../../patch-templates.js';

export class ValidationManager implements IValidationManager {
  private projectRoot: string;
  private autoValidateEnabled: boolean = true;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Enable/disable auto-validation
   */
  setAutoValidation(enabled: boolean): void {
    this.autoValidateEnabled = enabled;
  }

  /**
   * Validate a single file
   */
  async validateFile(filePath: string, content: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Syntax validation
    const syntaxResult = this.validateSyntax(content);
    errors.push(...syntaxResult.errors);
    warnings.push(...syntaxResult.warnings);

    // Anti-pattern detection
    const antiPatterns = this.checkAntiPatterns(content);
    warnings.push(...antiPatterns);

    // Security checks
    const securityIssues = this.checkSecurity(content, filePath);
    errors.push(...securityIssues);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate entire project
   */
  async validateProject(projectPath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check project structure
    const structureErrors = await this.validateProjectStructure(projectPath);
    errors.push(...structureErrors);

    // Validate all Luau files
    const files = await this.findLuauFiles(projectPath);
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const result = await this.validateFile(file, content);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      } catch (error) {
        errors.push({
          file,
          type: 'structure',
          message: `Impossible de lire le fichier: ${error}`,
          severity: 'error'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check for anti-patterns
   */
  checkAntiPatterns(content: string): ValidationWarning[] {
    const issues = detectAntiPatterns(content);
    return issues.map((issue: any) => ({
      file: 'current',
      line: issue.line,
      type: 'antipattern',
      message: issue.message
    }));
  }

  /**
   * Validate Luau syntax
   */
  validateSyntax(content: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const lines = content.split('\n');

    // Count syntax elements
    const counts = countSyntaxElements(content);
    const balance = validateSyntaxBalance(content);

    if (!balance.isValid) {
      balance.issues.forEach((issue: string) => {
        errors.push({
          file: 'current',
          type: 'syntax',
          message: issue,
          severity: 'error'
        });
      });
    }

    // Additional syntax checks
    let blockStack: string[] = [];
    let bracketStack: string[] = [];
    let inString = false;
    let stringChar = '';

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Check for deprecated patterns
      if (/\bwait\s*\(/.test(trimmed)) {
        warnings.push({
          file: 'current',
          line: index + 1,
          type: 'deprecated',
          message: 'Utiliser task.wait() au lieu de wait()'
        });
      }

      if (/\bspawn\s*\(/.test(trimmed)) {
        warnings.push({
          file: 'current',
          line: index + 1,
          type: 'deprecated',
          message: 'Utiliser task.spawn() au lieu de spawn()'
        });
      }

      // Check for potential nil errors
      if (/\.\s*Parent\s*=\s*nil/.test(line)) {
        warnings.push({
          file: 'current',
          line: index + 1,
          type: 'practice',
          message: 'Utiliser :Destroy() au lieu de .Parent = nil'
        });
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Security validation
   */
  private checkSecurity(content: string, filePath: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const dangerousPatterns = [
      { pattern: /loadstring\s*\(/, message: 'loadstring est dangereux et désactivé sur Roblox' },
      { pattern: /require\s*\(\s*["']http/, message: 'Chargement HTTP de modules non autorisé' },
      { pattern: /getfenv\s*\(/, message: 'getfenv peut compromettre la sécurité' },
      { pattern: /setfenv\s*\(/, message: 'setfenv peut compromettre la sécurité' },
      { pattern: /rawset\s*\(_G/, message: 'Modification de _G déconseillée' }
    ];

    dangerousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(content)) {
        errors.push({
          file: filePath,
          type: 'security',
          message,
          severity: 'critical'
        });
      }
    });

    return errors;
  }

  /**
   * Validate project structure
   */
  private async validateProjectStructure(projectPath: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check for Rojo config
    const rojoConfig = path.join(projectPath, 'default.project.json');
    const rojoConfigLuau = path.join(projectPath, 'default.project.luau');
    
    if (!await fs.pathExists(rojoConfig) && !await fs.pathExists(rojoConfigLuau)) {
      errors.push({
        file: 'default.project.json',
        type: 'structure',
        message: 'Fichier de configuration Rojo manquant',
        severity: 'critical'
      });
    }

    // Check required directories
    const requiredDirs = ['src', 'src/server', 'src/client', 'src/shared'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(projectPath, dir);
      if (!await fs.pathExists(dirPath)) {
        errors.push({
          file: dir,
          type: 'structure',
          message: `Dossier requis manquant: ${dir}`,
          severity: 'error'
        });
      }
    }

    return errors;
  }

  /**
   * Find all Luau files in project
   */
  private async findLuauFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    const srcPath = path.join(projectPath, 'src');

    async function scanDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.name.endsWith('.luau') || entry.name.endsWith('.lua')) {
          files.push(fullPath);
        }
      }
    }

    if (await fs.pathExists(srcPath)) {
      await scanDir(srcPath);
    }

    return files;
  }
}