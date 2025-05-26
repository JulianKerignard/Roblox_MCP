/**
 * SYSTÈME DE HOOKS OBLIGATOIRES
 * Intercepte et valide TOUTES les modifications avant application
 */

import { syntaxValidator, LuauSyntaxValidator } from './syntax-validator.js';
import { countSyntaxElements, validateSyntaxBalance } from './patch-templates.js';

export interface ModificationHook {
  name: string;
  priority: number;
  enabled: boolean;
  execute: (context: ModificationContext) => Promise<HookResult>;
}

export interface ModificationContext {
  operation: 'write' | 'patch' | 'create' | 'delete';
  filePath: string;
  originalContent?: string;
  newContent?: string;
  patch?: any;
  metadata?: Record<string, any>;
}

export interface HookResult {
  approved: boolean;
  errors?: string[];
  warnings?: string[];
  suggestions?: string[];
  modifiedContent?: string;
  requiresUserConfirmation?: boolean;
}

export class ModificationHookManager {
  private hooks: Map<string, ModificationHook> = new Map();
  private blockOnError: boolean = true;
  private forcePreview: boolean = true;

  constructor() {
    this.registerDefaultHooks();
  }

  /**
   * ENREGISTRER LES HOOKS PAR DÉFAUT
   */
  private registerDefaultHooks() {
    // 1. Hook de validation syntaxique OBLIGATOIRE
    this.registerHook({
      name: 'syntax-validation',
      priority: 100, // Priorité maximale
      enabled: true,
      execute: async (context) => {
        if (!context.newContent) {
          return { approved: true };
        }

        const validation = syntaxValidator.validateCode(context.newContent);
        
        if (!validation.valid) {
          return {
            approved: false,
            errors: validation.errors.map(e => `Ligne ${e.line}: ${e.message}`),
            warnings: validation.warnings.map(w => `Ligne ${w.line}: ${w.message}`),
            suggestions: validation.suggestions,
            requiresUserConfirmation: true
          };
        }

        return {
          approved: true,
          warnings: validation.warnings.map(w => `Ligne ${w.line}: ${w.message}`)
        };
      }
    });

    // 2. Hook de détection des patterns dangereux
    this.registerHook({
      name: 'dangerous-patterns',
      priority: 90,
      enabled: true,
      execute: async (context) => {
        if (!context.newContent) {
          return { approved: true };
        }

        const errors: string[] = [];
        const warnings: string[] = [];

        // Boucles infinies potentielles
        if (/while\s+true\s+do(?![\s\S]*?wait)/.test(context.newContent)) {
          errors.push("Boucle infinie détectée sans wait() - utilisez task.wait()");
        }

        // Variables globales
        if (/^[^-]*\b(?!local\s+)\w+\s*=\s*[^=]/gm.test(context.newContent)) {
          warnings.push("Variable globale potentielle détectée - utilisez 'local'");
        }

        // Loadstring
        if (/loadstring\s*\(/.test(context.newContent)) {
          errors.push("loadstring est désactivé sur Roblox pour des raisons de sécurité");
        }

        return {
          approved: errors.length === 0,
          errors,
          warnings
        };
      }
    });

    // 3. Hook de vérification des blocs
    this.registerHook({
      name: 'block-balance',
      priority: 95,
      enabled: true,
      execute: async (context) => {
        if (!context.newContent) {
          return { approved: true };
        }

        const balance = validateSyntaxBalance(context.newContent);
        
        if (!balance.isValid) {
          return {
            approved: false,
            errors: balance.issues,
            suggestions: [
              "Utilisez l'indentation pour mieux visualiser la structure",
              "Vérifiez que chaque bloc ouvert a sa fermeture correspondante"
            ]
          };
        }

        return { approved: true };
      }
    });

    // 4. Hook de comparaison avant/après
    this.registerHook({
      name: 'diff-analysis',
      priority: 80,
      enabled: true,
      execute: async (context) => {
        if (!context.originalContent || !context.newContent) {
          return { approved: true };
        }

        const oldCounts = countSyntaxElements(context.originalContent);
        const newCounts = countSyntaxElements(context.newContent);

        const warnings: string[] = [];

        // Détecter les suppressions accidentelles
        if (oldCounts.functions > newCounts.functions) {
          warnings.push(`${oldCounts.functions - newCounts.functions} fonction(s) supprimée(s)`);
        }

        // Détecter les déséquilibres
        const oldBalance = oldCounts.functions + oldCounts.ifs + oldCounts.fors + oldCounts.whiles;
        const newBalance = newCounts.functions + newCounts.ifs + newCounts.fors + newCounts.whiles;

        if (newBalance > newCounts.ends) {
          return {
            approved: false,
            errors: [`Il manque ${newBalance - newCounts.ends} 'end' dans le code modifié`],
            suggestions: ["Vérifiez que chaque nouveau bloc a son 'end' correspondant"]
          };
        }

        return { approved: true, warnings };
      }
    });

    // 5. Hook de formatage automatique
    this.registerHook({
      name: 'auto-format',
      priority: 50,
      enabled: true,
      execute: async (context) => {
        if (!context.newContent) {
          return { approved: true };
        }

        let formatted = context.newContent;

        // Corrections automatiques mineures
        // Supprimer les virgules avant }
        formatted = formatted.replace(/,(\s*\})/g, '$1');
        
        // Ajouter des espaces après les virgules
        formatted = formatted.replace(/,(?!\s)/g, ', ');

        // S'assurer que les 'then' sont sur la même ligne que 'if'
        formatted = formatted.replace(/\bif\s+(.+)\n\s*then\b/g, 'if $1 then');

        if (formatted !== context.newContent) {
          return {
            approved: true,
            modifiedContent: formatted,
            warnings: ["Le code a été formaté automatiquement"]
          };
        }

        return { approved: true };
      }
    });
  }

  /**
   * ENREGISTRER UN NOUVEAU HOOK
   */
  public registerHook(hook: ModificationHook) {
    this.hooks.set(hook.name, hook);
  }

  /**
   * EXÉCUTER TOUS LES HOOKS
   */
  public async executeHooks(context: ModificationContext): Promise<HookResult> {
    // Trier les hooks par priorité (plus élevé = exécuté en premier)
    const sortedHooks = Array.from(this.hooks.values())
      .filter(h => h.enabled)
      .sort((a, b) => b.priority - a.priority);

    const aggregatedResult: HookResult = {
      approved: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    let currentContent = context.newContent;

    for (const hook of sortedHooks) {
      try {
        // Mettre à jour le contexte avec le contenu potentiellement modifié
        const hookContext = { ...context, newContent: currentContent };
        const result = await hook.execute(hookContext);

        // Agréger les résultats
        if (!result.approved) {
          aggregatedResult.approved = false;
        }

        if (result.errors) {
          aggregatedResult.errors!.push(...result.errors);
        }

        if (result.warnings) {
          aggregatedResult.warnings!.push(...result.warnings);
        }

        if (result.suggestions) {
          aggregatedResult.suggestions!.push(...result.suggestions);
        }

        if (result.modifiedContent) {
          currentContent = result.modifiedContent;
        }

        if (result.requiresUserConfirmation) {
          aggregatedResult.requiresUserConfirmation = true;
        }

        // Si un hook critique échoue et que blockOnError est activé, arrêter
        if (!result.approved && this.blockOnError && hook.priority >= 90) {
          break;
        }
      } catch (error) {
        aggregatedResult.errors!.push(`Erreur dans le hook '${hook.name}': ${error}`);
        aggregatedResult.approved = false;
      }
    }

    // Mettre à jour le contenu final si modifié
    if (currentContent !== context.newContent) {
      aggregatedResult.modifiedContent = currentContent;
    }

    return aggregatedResult;
  }

  /**
   * VALIDER UN PATCH AVANT APPLICATION
   */
  public async validatePatch(originalContent: string, patch: any): Promise<HookResult> {
    // Simuler l'application du patch
    const patchResult = syntaxValidator.previewPatch(originalContent, patch);

    if (!patchResult.valid) {
      return {
        approved: false,
        errors: patchResult.errors.map(e => e.message),
        warnings: patchResult.warnings.map(w => w.message),
        suggestions: patchResult.suggestions,
        requiresUserConfirmation: true
      };
    }

    // Exécuter les hooks sur le résultat du patch
    return this.executeHooks({
      operation: 'patch',
      filePath: patch.scriptPath,
      originalContent,
      newContent: patchResult.preview,
      patch
    });
  }

  /**
   * FORCER UNE PREVIEW AVANT MODIFICATION
   */
  public async requirePreview(context: ModificationContext): Promise<{
    preview: string;
    validation: HookResult;
  }> {
    const result = await this.executeHooks(context);
    
    return {
      preview: result.modifiedContent || context.newContent || '',
      validation: result
    };
  }
}

// Export singleton global
export const hookManager = new ModificationHookManager();