/**
 * Middleware pour injecter les règles de syntaxe dans les réponses MCP
 * Assure que Claude Desktop voit toujours les règles critiques
 */

export class SyntaxRulesInjector {
  private readonly CRITICAL_RULES = `
🚨 RÈGLES DE SYNTAXE OBLIGATOIRES 🚨
=====================================

⚠️ TOUTE MODIFICATION AVEC SYNTAXE INVALIDE SERA AUTOMATIQUEMENT BLOQUÉE ⚠️

1. AVANT CHAQUE MODIFICATION:
   ✓ Utiliser read_script() pour lire le fichier COMPLET
   ✓ Compter TOUS les blocs (function, if, for, while)
   ✓ Compter TOUS les 'end' correspondants
   ✓ Utiliser preview_patch AVANT d'appliquer

2. CE QUI BLOQUERA VOS MODIFICATIONS:
   ❌ Blocs non fermés (il manque des 'end')
   ❌ 'end' en trop
   ❌ Parenthèses/accolades déséquilibrées

3. ERREUR LA PLUS FRÉQUENTE:
   function doSomething()
       if condition then
           -- code
       end
   -- ❌ OUBLI DU 'end' DE LA FONCTION!

4. UTILISEZ syntax_helper POUR VÉRIFIER:
   - syntax_helper action:"count_blocks" → compte les blocs
   - syntax_helper action:"find_unclosed" → trouve les blocs non fermés
   - syntax_helper action:"check" → validation complète

⚡ Le système valide automatiquement et BLOQUE si syntaxe invalide!
`;

  private readonly MINI_REMINDER = `
⚠️ RAPPEL: Chaque function/if/for/while DOIT avoir son 'end'! Modifications invalides = BLOQUÉES!
`;

  /**
   * Injecte les règles dans la description d'un outil
   */
  injectInToolDescription(tool: any): any {
    // Pour les outils critiques de modification, ajouter un rappel
    const criticalTools = ['write_script', 'patch_script', 'create_script', 'edit_script'];
    
    if (criticalTools.includes(tool.name)) {
      return {
        ...tool,
        description: `${tool.description}\n\n${this.MINI_REMINDER}`
      };
    }
    
    return tool;
  }

  /**
   * Injecte les règles complètes dans la liste des outils
   */
  injectInToolsList(tools: any[]): any[] {
    // Ajouter un "outil" spécial en première position qui contient les règles
    const rulesReminder = {
      name: "SYNTAX_RULES_REMINDER",
      description: this.CRITICAL_RULES,
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    };

    // Ajouter aussi un helper pour la syntaxe
    const syntaxHelper = {
      name: "syntax_helper",
      description: `Vérificateur de syntaxe Luau - UTILISEZ AVANT TOUTE MODIFICATION!
      
Actions disponibles:
- action:"check" scriptPath:"path" → Validation complète
- action:"count_blocks" scriptPath:"path" → Compte les blocs et 'end'
- action:"find_unclosed" scriptPath:"path" → Trouve les blocs non fermés
- action:"preview" content:"code" → Vérifie un bout de code

OBLIGATOIRE avant write_script ou patch_script!`,
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["check", "count_blocks", "find_unclosed", "preview"],
            description: "Action à effectuer"
          },
          scriptPath: {
            type: "string",
            description: "Chemin du script (pour check, count_blocks, find_unclosed)"
          },
          content: {
            type: "string",
            description: "Code à vérifier (pour preview)"
          }
        },
        required: ["action"]
      }
    };

    // Mettre les règles et le helper en premier
    return [rulesReminder, syntaxHelper, ...tools.map(t => this.injectInToolDescription(t))];
  }

  /**
   * Injecte un message dans les erreurs
   */
  enhanceErrorMessage(error: string): string {
    // Si c'est une erreur de syntaxe, ajouter des conseils
    if (error.includes('syntax') || error.includes('end') || error.includes('block')) {
      return `${error}\n\n💡 CONSEIL: Utilisez 'syntax_helper action:"check"' pour vérifier la syntaxe avant de modifier!`;
    }
    
    return error;
  }

  /**
   * Crée un message de bienvenue avec les règles
   */
  getWelcomeMessage(): string {
    return `
🤖 MCP Roblox initialisé avec VALIDATION SYNTAXIQUE OBLIGATOIRE!

${this.CRITICAL_RULES}

💡 Commandes utiles:
- get_project_structure → voir tous les fichiers
- search_in_scripts → rechercher du code
- syntax_helper → vérifier la syntaxe
- preview_patch → prévisualiser les changements

Bonne programmation! 🚀
    `;
  }

  /**
   * Vérifie si une modification récente a été faite sans recherche
   */
  checkSearchCompliance(lastSearchTime: number, currentTime: number): string | null {
    const timeSinceSearch = currentTime - lastSearchTime;
    const SEARCH_TIMEOUT = 60000; // 1 minute
    
    if (timeSinceSearch > SEARCH_TIMEOUT) {
      return `
⚠️ ATTENTION: Aucune recherche récente détectée!

Vous DEVEZ utiliser search_in_scripts ou read_script avant de modifier du code.
Cela évite les erreurs et assure la qualité du code.

Utilisez: search_in_scripts("pattern") ou read_script("path")
      `;
    }
    
    return null;
  }
}

// Export singleton
export const syntaxRulesInjector = new SyntaxRulesInjector();