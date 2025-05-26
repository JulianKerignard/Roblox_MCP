#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs-extra";
import path from "path";
import chokidar from "chokidar";
import { glob } from "glob";
import yaml from "yaml";
import { luauTemplates, getTemplate, getTemplatesByCategory, applyTemplate } from "./templates.js";
import { detectAntiPatterns, getAntiPatternSuggestions } from "./antipatterns.js";
import { robloxAPIs, commonTypes, getServiceAPI, searchAPIs } from "./roblox-apis.js";
import { validateGameTool } from "./validate-game.js";
import { compileCheckTool } from "./compile-check.js";
import { patchTemplates, syntaxHints, countSyntaxElements, validateSyntaxBalance, suggestSyntaxFixes } from "./patch-templates.js";
import { SYNTAX_RULES, validatePatchBeforeApply, getSyntaxReminder, checkWorkflowCompliance } from "./syntax-rules.js";
import { analyzeError, generateErrorAnalysisReport, validateApproach, ERROR_PATTERNS } from "./error-handler.js";
import { syntaxValidator } from "./syntax-validator.js";
import { hookManager } from "./modification-hooks.js";
import { syntaxEnforcer } from "./src/validation/syntax-enforcer.js";
import { syntaxRulesInjector } from "./src/middleware/syntax-rules-injector.js";
import { syntaxHelperTool } from "./src/tools/syntax-helper-tool.js";

interface PatchOperation {
  scriptPath: string;
  operation: "insert" | "replace" | "delete";
  lineStart: number;
  lineEnd?: number;
  newContent?: string;
  description?: string;
}

interface TokenUsage {
  totalTokensUsed: number;
  contextWindowUsed: number;
  contextWindowMax: number;
  operationTokens: number;
  cacheHits: number;
  cacheMisses: number;
}

interface SemanticCache {
  functions: Map<string, {
    name: string;
    signature: string;
    returnType?: string;
    line: number;
    lastModified: number;
  }>;
  variables: Map<string, {
    name: string;
    type?: string;
    scope: 'local' | 'global';
    line: number;
  }>;
  fileHash: string;
  lastUpdate: number;
}

interface RollbackEntry {
  timestamp: number;
  fileHash: string;
  patch: {
    additions: string[];
    deletions: string[];
    modifications: Array<{from: string; to: string}>;
  };
  tokenCost: number;
}

interface ThoughtProcess {
  step: string;
  reasoning: string;
  risks?: string[];
  alternatives?: string[];
}

class RojoMCPServer {
  private server: Server;
  private projectRoot: string;
  private rojoConfig: any;
  private fileWatcher: chokidar.FSWatcher | null = null;
  private projectStructure: Map<string, any> = new Map();
  private semanticCache: Map<string, SemanticCache> = new Map();
  private rollbackHistory: Map<string, RollbackEntry[]> = new Map(); // Historique par fichier
  private readonly MAX_ROLLBACK_ENTRIES = 5; // Limite pour économiser la mémoire
  private chainOfThoughtEnabled = false; // Active/désactive le chain-of-thought
  private thoughtHistory: ThoughtProcess[] = []; // Historique des réflexions
  private autoValidateEnabled: boolean = true; // Validation automatique activée par défaut
  private searchBeforeWriteEnabled: boolean = true; // Force la recherche avant écriture
  private lastSearchTimestamp: number = 0; // Timestamp de la dernière recherche
  private tokenUsage: TokenUsage = {
    totalTokensUsed: 0,
    contextWindowUsed: 0,
    contextWindowMax: 200000, // Limite approximative de Claude
    operationTokens: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  private toolHistory: string[] = []; // Historique des outils utilisés
  private readonly MAX_TOOL_HISTORY = 20; // Garder les 20 derniers outils

  constructor() {
    this.server = new Server(
      {
        name: "mcp-roblox-rojo",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.projectRoot = process.cwd();
    this.setupHandlers();
    this.loadRojoConfig();
    this.scanProject();
    this.setupFileWatcher();
  }

  private async loadRojoConfig() {
    try {
      const configPath = path.join(this.projectRoot, "default.project.json");
      if (await fs.pathExists(configPath)) {
        this.rojoConfig = await fs.readJson(configPath);
        console.error("✅ Configuration Rojo chargée");
      } else {
        console.error("⚠️ Fichier default.project.json non trouvé");
      }
    } catch (error) {
      console.error("❌ Erreur lors du chargement de la config Rojo:", error);
    }
  }

  private async scanProject() {
    try {
      const srcFiles = await glob("src/**/*.{luau,lua}", { cwd: this.projectRoot });
      
      for (const file of srcFiles) {
        const fullPath = path.join(this.projectRoot, file);
        const content = await fs.readFile(fullPath, "utf8");
        const relativePath = path.relative(this.projectRoot, fullPath);
        
        this.projectStructure.set(relativePath, {
          path: relativePath,
          fullPath: fullPath,
          content: content,
          type: this.getScriptType(file),
          lastModified: (await fs.stat(fullPath)).mtime,
        });
      }
      
      console.error(`📁 Projet scanné: ${this.projectStructure.size} fichiers trouvés`);
    } catch (error) {
      console.error("❌ Erreur lors du scan du projet:", error);
    }
  }

  private getScriptType(filePath: string): string {
    const fileName = path.basename(filePath);
    
    if (fileName.includes(".server.")) return "ServerScript";
    if (fileName.includes(".client.")) return "LocalScript";
    if (filePath.includes("/shared/") || fileName.includes("module")) return "ModuleScript";
    
    // Détermine selon le dossier
    if (filePath.includes("/server/")) return "ServerScript";
    if (filePath.includes("/client/")) return "LocalScript";
    
    return "ModuleScript";
  }

  private setupFileWatcher() {
    this.fileWatcher = chokidar.watch("src/**/*.{luau,lua}", {
      cwd: this.projectRoot,
      ignoreInitial: true,
    });

    this.fileWatcher.on("change", async (filePath) => {
      await this.updateFile(filePath);
    });

    this.fileWatcher.on("add", async (filePath) => {
      await this.updateFile(filePath);
    });

    this.fileWatcher.on("unlink", (filePath) => {
      this.projectStructure.delete(filePath);
      console.error(`🗑️ Fichier supprimé: ${filePath}`);
    });

    console.error("👁️ Surveillance des fichiers activée");
  }

  private async updateFile(filePath: string) {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      const content = await fs.readFile(fullPath, "utf8");
      
      this.projectStructure.set(filePath, {
        path: filePath,
        fullPath: fullPath,
        content: content,
        type: this.getScriptType(filePath),
        lastModified: new Date(),
      });
      
      console.error(`📝 Fichier mis à jour: ${filePath}`);
    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour de ${filePath}:`, error);
    }
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Créer la liste des outils de base
      let tools: Tool[] = [
          {
            name: "get_project_structure",
            description: "Obtient la structure complète du projet Rojo",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "read_script",
            description: "Lit le contenu d'un script spécifique",
            inputSchema: {
              type: "object",
              properties: {
                scriptPath: {
                  type: "string",
                  description: "Chemin vers le script (ex: src/server/main.server.luau)",
                },
              },
              required: ["scriptPath"],
            },
          },
          {
            name: "write_script",
            description: "Écrit/modifie le contenu d'un script",
            inputSchema: {
              type: "object",
              properties: {
                scriptPath: {
                  type: "string",
                  description: "Chemin vers le script",
                },
                content: {
                  type: "string",
                  description: "Nouveau contenu du script",
                },
              },
              required: ["scriptPath", "content"],
            },
          },
          {
            name: "create_script",
            description: "Crée un nouveau script",
            inputSchema: {
              type: "object",
              properties: {
                scriptPath: {
                  type: "string",
                  description: "Chemin pour le nouveau script (ex: src/server/newScript.server.luau)",
                },
                content: {
                  type: "string",
                  description: "Contenu initial du script",
                },
                scriptType: {
                  type: "string",
                  description: "Type de script (server, client, module)",
                  enum: ["server", "client", "module"],
                },
              },
              required: ["scriptPath", "scriptType"],
            },
          },
          {
            name: "delete_script",
            description: "Supprime un script",
            inputSchema: {
              type: "object",
              properties: {
                scriptPath: {
                  type: "string",
                  description: "Chemin vers le script à supprimer",
                },
              },
              required: ["scriptPath"],
            },
          },
          {
            name: "get_rojo_config",
            description: "Affiche la configuration Rojo actuelle",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "search_in_scripts",
            description: "Recherche du texte dans tous les scripts",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Texte à rechercher",
                },
                caseSensitive: {
                  type: "boolean",
                  description: "Recherche sensible à la casse",
                  default: false,
                },
              },
              required: ["query"],
            },
          },
          {
            name: "patch_script",
            description: "Applique une modification ciblée sur un script",
            inputSchema: {
              type: "object",
              properties: {
                scriptPath: {
                  type: "string",
                  description: "Chemin vers le script à modifier",
                },
                operation: {
                  type: "string",
                  enum: ["insert", "replace", "delete"],
                  description: "Type d'opération : insert (ajouter), replace (remplacer), delete (supprimer)",
                },
                lineStart: {
                  type: "number",
                  description: "Numéro de ligne de début (1-indexé)",
                },
                lineEnd: {
                  type: "number",
                  description: "Numéro de ligne de fin (optionnel, pour replace/delete)",
                },
                newContent: {
                  type: "string",
                  description: "Nouveau contenu (pour insert/replace)",
                },
                description: {
                  type: "string",
                  description: "Description du changement effectué",
                },
              },
              required: ["scriptPath", "operation", "lineStart", "description"],
            },
          },
          {
            name: "preview_patch",
            description: "Prévisualise le résultat d'un patch sans l'appliquer",
            inputSchema: {
              type: "object",
              properties: {
                scriptPath: {
                  type: "string",
                  description: "Chemin vers le script",
                },
                operation: {
                  type: "string",
                  enum: ["insert", "replace", "delete"],
                  description: "Type d'opération",
                },
                lineStart: {
                  type: "number",
                  description: "Numéro de ligne de début",
                },
                lineEnd: {
                  type: "number",
                  description: "Numéro de ligne de fin (optionnel)",
                },
                newContent: {
                  type: "string",
                  description: "Nouveau contenu (pour insert/replace)",
                },
              },
              required: ["scriptPath", "operation", "lineStart"],
            },
          },
          {
            name: "list_templates",
            description: "Liste tous les templates de code Luau/Roblox disponibles",
            inputSchema: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  description: "Filtrer par catégorie (event, service, data, ui, utility, pattern)",
                  enum: ["event", "service", "data", "ui", "utility", "pattern"],
                },
              },
            },
          },
          {
            name: "use_template",
            description: "Utilise un template de code avec des variables personnalisées",
            inputSchema: {
              type: "object",
              properties: {
                templateName: {
                  type: "string",
                  description: "Nom du template à utiliser",
                },
                variables: {
                  type: "object",
                  description: "Variables à remplacer dans le template",
                },
                targetPath: {
                  type: "string",
                  description: "Chemin où créer le fichier (optionnel)",
                },
              },
              required: ["templateName", "variables"],
            },
          },
          {
            name: "rollback_script",
            description: "Annule les dernières modifications d'un script (rollback)",
            inputSchema: {
              type: "object",
              properties: {
                scriptPath: {
                  type: "string",
                  description: "Chemin vers le script à restaurer",
                },
                steps: {
                  type: "number",
                  description: "Nombre de versions à reculer (par défaut: 1)",
                },
              },
              required: ["scriptPath"],
            },
          },
          {
            name: "rollback_history",
            description: "Affiche l'historique des modifications disponibles pour rollback",
            inputSchema: {
              type: "object",
              properties: {
                scriptPath: {
                  type: "string",
                  description: "Chemin vers le script (optionnel, sinon affiche tout)",
                },
              },
            },
          },
          {
            name: "check_antipatterns",
            description: "Analyse un script pour détecter les anti-patterns Roblox",
            inputSchema: {
              type: "object",
              properties: {
                scriptPath: {
                  type: "string",
                  description: "Chemin vers le script à analyser",
                },
                autoFix: {
                  type: "boolean",
                  description: "Proposer des corrections automatiques (par défaut: false)",
                },
              },
              required: ["scriptPath"],
            },
          },
          {
            name: "validate_game",
            description: "Valide l'intégralité du projet Roblox (syntaxe, dépendances, sécurité, structure)",
            inputSchema: {
              type: "object",
              properties: {
                projectPath: {
                  type: "string",
                  description: "Chemin du projet à valider (par défaut: répertoire courant)",
                },
              },
            },
          },
          {
            name: "compile_check",
            description: "Simule une compilation Luau pour détecter TOUTES les erreurs de syntaxe (comme un vrai compilateur)",
            inputSchema: {
              type: "object",
              properties: {
                targetFile: {
                  type: "string",
                  description: "Fichier spécifique à compiler (optionnel, sinon compile tout le projet)",
                },
              },
            },
          },
          {
            name: "roblox_api",
            description: "Affiche la documentation des APIs Roblox les plus utilisées",
            inputSchema: {
              type: "object",
              properties: {
                service: {
                  type: "string",
                  description: "Nom du service (ex: Players, TweenService, DataStoreService)",
                },
                search: {
                  type: "string",
                  description: "Rechercher une méthode ou propriété spécifique",
                },
              },
            },
          },
          {
            name: "search_roblox_docs",
            description: "Recherche dans la documentation officielle Roblox en ligne",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Terme de recherche (ex: 'RemoteEvent', 'PathfindingService', 'Animation')",
                },
                category: {
                  type: "string",
                  description: "Catégorie de recherche",
                  enum: ["api", "tutorial", "guide", "all"],
                },
              },
              required: ["query"],
            },
          },
          {
            name: "toggle_auto_validation",
            description: "Active/désactive la validation automatique après modification de fichiers",
            inputSchema: {
              type: "object",
              properties: {
                enabled: {
                  type: "boolean",
                  description: "Activer (true) ou désactiver (false) la validation automatique",
                },
              },
              required: ["enabled"],
            },
          },
          {
            name: "toggle_chain_of_thought",
            description: "Active/désactive le mode chain-of-thought qui force l'explication avant action",
            inputSchema: {
              type: "object",
              properties: {
                enabled: {
                  type: "boolean",
                  description: "Activer (true) ou désactiver (false) le chain-of-thought",
                },
                verbose: {
                  type: "boolean",
                  description: "Mode verbeux pour plus de détails (par défaut: false)",
                },
              },
              required: ["enabled"],
            },
          },
          {
            name: "get_thought_history",
            description: "Affiche l'historique des réflexions chain-of-thought",
            inputSchema: {
              type: "object",
              properties: {
                limit: {
                  type: "number",
                  description: "Nombre de réflexions à afficher (par défaut: 10)",
                },
              },
            },
          },
          {
            name: "syntax_helper",
            description: "Aide à éviter les erreurs de syntaxe lors des patches en fournissant des templates et en validant la syntaxe",
            inputSchema: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["get_template", "validate_syntax", "count_blocks", "suggest_fix", "show_rules"],
                  description: "Action à effectuer : get_template (obtenir un template), validate_syntax (valider), count_blocks (compter blocs), suggest_fix (suggestions), show_rules (afficher règles)",
                },
                scriptPath: {
                  type: "string",
                  description: "Chemin du script à analyser (pour validate_syntax, count_blocks)",
                },
                templateName: {
                  type: "string",
                  description: "Nom du template souhaité (pour get_template)",
                },
                errorMessage: {
                  type: "string",
                  description: "Message d'erreur pour obtenir des suggestions (pour suggest_fix)",
                },
              },
              required: ["action"],
            },
          },
          {
            name: "analyze_error",
            description: "Analyse automatiquement une erreur et fournit des directives précises pour la corriger sans casser le code",
            inputSchema: {
              type: "object",
              properties: {
                errorMessage: {
                  type: "string",
                  description: "Le message d'erreur complet à analyser",
                },
                filePath: {
                  type: "string",
                  description: "Le chemin du fichier où l'erreur se produit (optionnel)",
                },
                lineNumber: {
                  type: "number",
                  description: "Le numéro de ligne de l'erreur (optionnel)",
                },
              },
              required: ["errorMessage"],
            },
          },
        ] as Tool[];
        
      // Injecter les règles de syntaxe et améliorer les outils
      tools = syntaxRulesInjector.injectInToolsList(tools);
      
      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Enregistrer l'outil dans l'historique
      this.toolHistory.push(name);
      if (this.toolHistory.length > this.MAX_TOOL_HISTORY) {
        this.toolHistory.shift();
      }

      // Vérifier la conformité du workflow pour les outils critiques
      const compliance = checkWorkflowCompliance(this.toolHistory, name);
      
      // Forcer l'utilisation d'analyze_error si le contexte suggère une erreur
      if (name === 'get_project_structure' || name === 'read_script') {
        const lastTools = this.toolHistory.slice(-3);
        const hasError = lastTools.some(tool => tool.includes('compile_check') || tool.includes('validate_game'));
        
        if (hasError && !lastTools.includes('analyze_error')) {
          console.error("⚠️ Une erreur a été détectée. Utilisez d'abord 'analyze_error' pour obtenir des directives!");
        }
      }
      
      try {
        switch (name) {
          case "get_project_structure":
            return this.getProjectStructure();

          case "read_script":
            return this.readScript(args?.scriptPath as string);

          case "write_script":
            return await this.writeScript(
              args?.scriptPath as string,
              args?.content as string,
              args?.useDiff as boolean
            );

          case "create_script":
            return await this.createScript(
              args?.scriptPath as string,
              args?.scriptType as string,
              args?.content as string
            );

          case "delete_script":
            return await this.deleteScript(args?.scriptPath as string);

          case "get_rojo_config":
            return this.getRojoConfig();

          case "search_in_scripts":
            return this.searchInScripts(
              args?.query as string,
              args?.caseSensitive as boolean
            );

          case "patch_script":
            return await this.patchScript({
              scriptPath: args?.scriptPath as string,
              operation: args?.operation as "insert" | "replace" | "delete",
              lineStart: args?.lineStart as number,
              lineEnd: args?.lineEnd as number,
              newContent: args?.newContent as string,
              description: args?.description as string,
            });

          case "preview_patch":
            return this.previewPatch({
              scriptPath: args?.scriptPath as string,
              operation: args?.operation as "insert" | "replace" | "delete",
              lineStart: args?.lineStart as number,
              lineEnd: args?.lineEnd as number,
              newContent: args?.newContent as string,
            });

          case "list_templates":
            return this.listTemplates(args?.category as string);

          case "use_template":
            return await this.useTemplate(
              args?.templateName as string,
              args?.variables as Record<string, string>,
              args?.targetPath as string
            );

          case "rollback_script":
            return await this.rollbackScript(
              args?.scriptPath as string,
              args?.steps as number
            );

          case "rollback_history":
            return this.getRollbackHistory(args?.scriptPath as string);

          case "check_antipatterns":
            return this.checkAntiPatterns(
              args?.scriptPath as string,
              args?.autoFix as boolean
            );

          case "validate_game":
            const validationResult = await validateGameTool(
              args?.projectPath as string || this.projectRoot
            );
            return {
              content: [
                {
                  type: "text",
                  text: validationResult,
                },
              ],
            };

          case "compile_check":
            const compileResult = await compileCheckTool(
              this.projectRoot,
              args?.targetFile as string
            );
            return {
              content: [
                {
                  type: "text",
                  text: compileResult,
                },
              ],
            };

          case "roblox_api":
            return this.getRobloxAPI(
              args?.service as string,
              args?.search as string
            );

          case "search_roblox_docs":
            return await this.searchRobloxDocs(
              args?.query as string,
              args?.category as string
            );

          case "toggle_auto_validation":
            this.autoValidateEnabled = args?.enabled as boolean;
            return {
              content: [
                {
                  type: "text",
                  text: `✅ Validation automatique ${this.autoValidateEnabled ? 'activée' : 'désactivée'}\n\n` +
                        `Les fichiers seront ${this.autoValidateEnabled ? 'automatiquement validés' : 'modifiés sans validation'} après chaque modification.`,
                },
              ],
            };

          case "toggle_chain_of_thought":
            return this.toggleChainOfThought(
              args?.enabled as boolean,
              args?.verbose as boolean
            );

          case "get_thought_history":
            return this.getThoughtHistory(args?.limit as number);

          case "syntax_helper":
            return await this.handleSyntaxHelper(
              args?.action as string,
              args?.scriptPath as string,
              args?.templateName as string,
              args?.errorMessage as string,
              args
            );

          case "analyze_error":
            return this.analyzeErrorMessage(
              args?.errorMessage as string,
              args?.filePath as string,
              args?.lineNumber as number
            );

          default:
            throw new Error(`Outil inconnu: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Erreur lors de l'exécution de ${name}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    });
  }

  private getProjectStructure() {
    const structure: { [key: string]: any[] } = {
      server: [],
      client: [],
      shared: [],
    };

    for (const [path, fileInfo] of this.projectStructure) {
      const category = fileInfo.type === "ServerScript" ? "server" :
                     fileInfo.type === "LocalScript" ? "client" : "shared";
      
      structure[category].push({
        path: path,
        name: path.split("/").pop(),
        type: fileInfo.type,
        lastModified: fileInfo.lastModified,
        size: fileInfo.content.length,
      });
    }

    let output = "📁 **Structure du projet Rojo**\n\n";
    output += `**Racine:** ${this.projectRoot}\n\n`;

    for (const [category, files] of Object.entries(structure)) {
      if (files.length > 0) {
        const icon = category === "server" ? "🖥️" : category === "client" ? "💻" : "📦";
        output += `${icon} **${category.toUpperCase()} (${files.length})**\n`;
        
        files.forEach(file => {
          output += `  - \`${file.path}\` (${file.size} chars)\n`;
        });
        output += "\n";
      }
    }

    output += `**Total:** ${this.projectStructure.size} fichiers`;

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  }

  private readScript(scriptPath: string) {
    const fileInfo = this.projectStructure.get(scriptPath);
    
    if (!fileInfo) {
      const responseText = `❌ **Script non trouvé:** \`${scriptPath}\`\n\nScripts disponibles:\n${Array.from(this.projectStructure.keys()).map(p => `- ${p}`).join('\n')}`;
      this.updateTokenUsage(responseText);
      
      return {
        content: [
          {
            type: "text",
            text: responseText + this.appendTokenUsageReport(),
          },
        ],
      };
    }

    // Utiliser le cache sémantique pour optimiser les tokens
    const optimizedContent = this.getOptimizedFileContent(scriptPath);
    const isUsingCache = this.semanticCache.has(scriptPath) && 
                        this.semanticCache.get(scriptPath)!.fileHash === this.hashString(fileInfo.content);
    
    // Diviser le code en petits blocs pour éviter les artefacts
    const codeLines = optimizedContent.split('\n');
    const maxLinesPerBlock = 20; // Limiter pour forcer l'affichage inline
    let formattedCode = '';
    
    // Si le fichier est petit, afficher tout
    if (codeLines.length <= maxLinesPerBlock) {
      formattedCode = `\`\`\`luau\n${optimizedContent}\n\`\`\``;
    } else {
      // Sinon, afficher par blocs avec numéros de lignes
      formattedCode = '**Code complet :**\n\n';
      for (let i = 0; i < codeLines.length; i += maxLinesPerBlock) {
        const blockEnd = Math.min(i + maxLinesPerBlock, codeLines.length);
        const block = codeLines.slice(i, blockEnd);
        formattedCode += `📍 **Lignes ${i + 1}-${blockEnd}:**\n`;
        formattedCode += '```luau\n' + block.join('\n') + '\n```\n\n';
      }
    }
    
    const responseText = `📝 **${path.basename(scriptPath)}** (${fileInfo.type})\n` +
                        `**Chemin:** \`${scriptPath}\`\n` +
                        `**Taille:** ${fileInfo.content.length} caractères\n` +
                        `**Modifié:** ${fileInfo.lastModified.toLocaleString()}\n` +
                        `**Cache:** ${isUsingCache ? '✅ Optimisé' : '🔄 Complet'}\n\n` +
                        formattedCode;
    
    this.updateTokenUsage(responseText);

    return {
      content: [
        {
          type: "text",
          text: responseText + this.appendTokenUsageReport(),
        },
      ],
    };
  }

  private async writeScript(scriptPath: string, content: string, useDiff: boolean = true) {
    // Chain-of-thought si activé
    if (this.chainOfThoughtEnabled) {
      const thought = this.generateThoughtProcess('write_script', {
        scriptPath,
        contentSize: content.length,
        hasExistingFile: this.projectStructure.has(scriptPath)
      });
      this.thoughtHistory.unshift(thought);
      if (this.thoughtHistory.length > 50) this.thoughtHistory.pop(); // Limiter l'historique
    }
    
    try {
      const fullPath = path.join(this.projectRoot, scriptPath);
      const fileInfo = this.projectStructure.get(scriptPath);
      
      // NOUVEAU: Exécuter les hooks de validation AVANT l'écriture
      const hookResult = await hookManager.executeHooks({
        operation: 'write',
        filePath: scriptPath,
        originalContent: fileInfo?.content || '',
        newContent: content
      });

      // Si la validation échoue, bloquer l'opération
      if (!hookResult.approved) {
        let errorMsg = `❌ **Validation échouée - Écriture bloquée**\n\n`;
        errorMsg += `**Fichier:** \`${scriptPath}\`\n\n`;
        
        if (hookResult.errors && hookResult.errors.length > 0) {
          errorMsg += `**🚨 Erreurs critiques:**\n`;
          hookResult.errors.forEach(err => errorMsg += `- ${err}\n`);
          errorMsg += `\n`;
        }
        
        if (hookResult.warnings && hookResult.warnings.length > 0) {
          errorMsg += `**⚠️ Avertissements:**\n`;
          hookResult.warnings.forEach(warn => errorMsg += `- ${warn}\n`);
          errorMsg += `\n`;
        }
        
        if (hookResult.suggestions && hookResult.suggestions.length > 0) {
          errorMsg += `**💡 Suggestions:**\n`;
          hookResult.suggestions.forEach(sug => errorMsg += `- ${sug}\n`);
          errorMsg += `\n`;
        }
        
        errorMsg += `\n**📋 Actions requises:**\n`;
        errorMsg += `1. Corrigez les erreurs de syntaxe ci-dessus\n`;
        errorMsg += `2. Assurez-vous que tous les blocs sont fermés (chaque 'function', 'if', 'for' doit avoir son 'end')\n`;
        errorMsg += `3. Vérifiez l'équilibre des parenthèses et accolades\n`;
        errorMsg += `4. Réessayez l'écriture après correction\n`;
        
        this.updateTokenUsage(errorMsg);
        return {
          content: [
            {
              type: "text",
              text: errorMsg + this.appendTokenUsageReport(),
            },
          ],
        };
      }

      // Utiliser le contenu potentiellement modifié par les hooks
      const finalContent = hookResult.modifiedContent || content;
      
      // Générer le diff si l'ancien contenu existe et que useDiff est activé
      let diffReport = '';
      if (fileInfo && useDiff) {
        diffReport = this.generateDiff(fileInfo.content, finalContent);
        
        // Sauvegarder dans l'historique de rollback (OPTIMISÉ)
        this.saveRollbackEntry(scriptPath, fileInfo.content, finalContent);
      }
      
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, finalContent);
      
      // Mettre à jour la structure en mémoire
      await this.updateFile(scriptPath);
      
      let responseText = `✅ **Script mis à jour avec succès**\n\n**Fichier:** \`${scriptPath}\`\n**Taille:** ${finalContent.length} caractères\n**Lignes:** ${finalContent.split('\n').length}${diffReport ? '\n\n' + diffReport : ''}`;
      
      // Ajouter les avertissements s'il y en a
      if (hookResult.warnings && hookResult.warnings.length > 0) {
        responseText += `\n\n**⚠️ Avertissements détectés:**\n`;
        hookResult.warnings.forEach(warn => responseText += `- ${warn}\n`);
      }
      
      // Validation automatique si activée
      if (this.autoValidateEnabled) {
        const validationResult = await this.performAutoValidation(scriptPath);
        if (validationResult) {
          responseText += '\n\n' + validationResult;
        }
      }
      
      this.updateTokenUsage(responseText);
      
      return {
        content: [
          {
            type: "text",
            text: responseText + this.appendTokenUsageReport(),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Impossible d'écrire le script: ${error}`);
    }
  }

  private async createScript(scriptPath: string, scriptType: string, content: string = "") {
    try {
      // Ajouter l'extension appropriée si nécessaire
      if (!scriptPath.endsWith('.luau') && !scriptPath.endsWith('.lua')) {
        const extension = scriptType === "server" ? ".server.luau" :
                         scriptType === "client" ? ".client.luau" : ".luau";
        scriptPath += extension;
      }

      const fullPath = path.join(this.projectRoot, scriptPath);
      
      if (await fs.pathExists(fullPath)) {
        throw new Error(`Le script ${scriptPath} existe déjà`);
      }

      // Contenu par défaut selon le type
      if (!content) {
        content = scriptType === "server" ? "-- Script serveur\nprint(\"Script serveur démarré\")" :
                 scriptType === "client" ? "-- Script client\nprint(\"Script client démarré\")" :
                 "-- Module\nlocal Module = {}\n\nreturn Module";
      }

      // NOUVEAU: Valider le contenu avant création
      const hookResult = await hookManager.executeHooks({
        operation: 'create',
        filePath: scriptPath,
        newContent: content
      });

      if (!hookResult.approved) {
        let errorMsg = `❌ **Validation échouée - Création bloquée**\n\n`;
        errorMsg += `**Fichier:** \`${scriptPath}\`\n\n`;
        
        if (hookResult.errors && hookResult.errors.length > 0) {
          errorMsg += `**🚨 Erreurs:**\n`;
          hookResult.errors.forEach(err => errorMsg += `- ${err}\n`);
        }
        
        this.updateTokenUsage(errorMsg);
        return {
          content: [
            {
              type: "text",
              text: errorMsg + this.appendTokenUsageReport(),
            },
          ],
        };
      }

      const finalContent = hookResult.modifiedContent || content;

      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, finalContent);
      
      let responseText = `✅ **Script créé avec succès**\n\n**Fichier:** \`${scriptPath}\`\n**Type:** ${scriptType}\n**Taille:** ${content.length} caractères`;
      
      // Validation automatique si activée
      if (this.autoValidateEnabled) {
        const validationResult = await this.performAutoValidation(scriptPath);
        if (validationResult) {
          responseText += '\n\n' + validationResult;
        }
      }
      
      this.updateTokenUsage(responseText);
      
      return {
        content: [
          {
            type: "text",
            text: responseText + this.appendTokenUsageReport(),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Impossible de créer le script: ${error}`);
    }
  }

  private async deleteScript(scriptPath: string) {
    try {
      const fullPath = path.join(this.projectRoot, scriptPath);
      
      if (!(await fs.pathExists(fullPath))) {
        throw new Error(`Le script ${scriptPath} n'existe pas`);
      }

      await fs.remove(fullPath);
      this.projectStructure.delete(scriptPath);
      
      const responseText = `🗑️ **Script supprimé avec succès**\n\n**Fichier:** \`${scriptPath}\``;
      this.updateTokenUsage(responseText);
      
      return {
        content: [
          {
            type: "text",
            text: responseText + this.appendTokenUsageReport(),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Impossible de supprimer le script: ${error}`);
    }
  }

  private getRojoConfig() {
    if (!this.rojoConfig) {
      return {
        content: [
          {
            type: "text",
            text: "❌ **Configuration Rojo non trouvée**\n\nAssurez-vous qu'un fichier `default.project.json` existe dans le répertoire racine.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `⚙️ **Configuration Rojo**\n\n**Nom du projet:** ${this.rojoConfig.name}\n\n` +
                "```json\n" + JSON.stringify(this.rojoConfig, null, 2) + "\n```",
        },
      ],
    };
  }

  private searchInScripts(query: string, caseSensitive: boolean = false) {
    const results: any[] = [];
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    for (const [path, fileInfo] of this.projectStructure) {
      const content = caseSensitive ? fileInfo.content : fileInfo.content.toLowerCase();
      
      if (content.includes(searchQuery)) {
        const lines = fileInfo.content.split('\n');
        const matchingLines: any[] = [];
        
        lines.forEach((line: string, index: number) => {
          const searchLine = caseSensitive ? line : line.toLowerCase();
          if (searchLine.includes(searchQuery)) {
            matchingLines.push({
              number: index + 1,
              content: line.trim(),
            });
          }
        });

        results.push({
          path: path,
          matches: matchingLines.length,
          lines: matchingLines.slice(0, 5), // Limiter à 5 lignes par fichier
        });
      }
    }

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `🔍 **Aucun résultat trouvé pour:** \`${query}\``,
          },
        ],
      };
    }

    let output = `🔍 **Résultats de recherche pour:** \`${query}\`\n\n`;
    output += `**${results.length} fichier(s) trouvé(s)**\n\n`;

    results.forEach(result => {
      output += `📄 **${result.path}** (${result.matches} occurrence(s))\n`;
      result.lines.forEach((line: any) => {
        output += `  L${line.number}: \`${line.content}\`\n`;
      });
      output += "\n";
    });

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  }

  private async patchScript(patch: PatchOperation) {
    // Vérifier la conformité du workflow
    const compliance = checkWorkflowCompliance(this.toolHistory, 'patch_script');
    
    // Chain-of-thought si activé
    if (this.chainOfThoughtEnabled) {
      const thought = this.generateThoughtProcess('patch_script', {
        scriptPath: patch.scriptPath,
        operation: patch.operation,
        lineCount: (patch.lineEnd || patch.lineStart) - patch.lineStart + 1
      });
      this.thoughtHistory.unshift(thought);
    }
    
    try {
      const fullPath = path.join(this.projectRoot, patch.scriptPath);
      
      if (!(await fs.pathExists(fullPath))) {
        throw new Error(`Le script ${patch.scriptPath} n'existe pas`);
      }

      // Lire le fichier actuel
      const content = await fs.readFile(fullPath, "utf8");
      const lines = content.split('\n');

      // Valider les numéros de ligne
      if (patch.lineStart < 1 || patch.lineStart > lines.length + 1) {
        throw new Error(`Numéro de ligne invalide: ${patch.lineStart} (fichier a ${lines.length} lignes)`);
      }

      // NOUVEAU: Valider le patch avec les hooks AVANT application
      const currentContent = content;
      const validationResult = await hookManager.validatePatch(currentContent, patch);
      
      if (!validationResult.approved) {
        let errorMsg = `❌ **Validation échouée - Patch bloqué**\n\n`;
        errorMsg += `**Fichier:** \`${patch.scriptPath}\`\n`;
        errorMsg += `**Opération:** ${patch.operation}\n`;
        errorMsg += `**Lignes affectées:** ${patch.lineStart}${patch.lineEnd ? `-${patch.lineEnd}` : ''}\n\n`;
        
        if (validationResult.errors && validationResult.errors.length > 0) {
          errorMsg += `**🚨 Erreurs critiques:**\n`;
          validationResult.errors.forEach(err => errorMsg += `- ${err}\n`);
          errorMsg += `\n`;
        }
        
        if (validationResult.warnings && validationResult.warnings.length > 0) {
          errorMsg += `**⚠️ Avertissements:**\n`;
          validationResult.warnings.forEach(warn => errorMsg += `- ${warn}\n`);
          errorMsg += `\n`;
        }
        
        if (validationResult.suggestions && validationResult.suggestions.length > 0) {
          errorMsg += `**💡 Suggestions:**\n`;
          validationResult.suggestions.forEach(sug => errorMsg += `- ${sug}\n`);
          errorMsg += `\n`;
        }
        
        // Afficher un aperçu du code problématique
        if (patch.newContent) {
          errorMsg += `**📝 Code soumis:**\n\`\`\`luau\n${patch.newContent}\n\`\`\`\n\n`;
        }
        
        errorMsg += `**📋 Actions requises:**\n`;
        errorMsg += `1. Corrigez les erreurs de syntaxe dans le contenu du patch\n`;
        errorMsg += `2. Assurez-vous que le patch maintient l'équilibre des blocs\n`;
        errorMsg += `3. Utilisez 'preview_patch' pour tester avant d'appliquer\n`;
        errorMsg += `4. Réessayez avec un patch corrigé\n\n`;
        errorMsg += `💡 Utilisez 'syntax_helper' pour obtenir des templates corrects.\n`;
        errorMsg += `📝 Utilisez 'preview_patch' pour vérifier avant d'appliquer.`;
        
        this.updateTokenUsage(errorMsg);
        return {
          content: [
            {
              type: "text",
              text: errorMsg + this.appendTokenUsageReport(),
            },
          ],
        };
      }

      // Effectuer l'opération
      let newLines = [...lines];
      let operationDescription = "";

      switch (patch.operation) {
        case "insert":
          if (!patch.newContent) {
            throw new Error("newContent requis pour l'opération insert");
          }
          const insertLines = patch.newContent.split('\n');
          newLines.splice(patch.lineStart - 1, 0, ...insertLines);
          operationDescription = `Inséré ${insertLines.length} ligne(s) à la ligne ${patch.lineStart}`;
          break;

        case "replace":
          if (!patch.newContent) {
            throw new Error("newContent requis pour l'opération replace");
          }
          const replaceLines = patch.newContent.split('\n');
          const endLine = patch.lineEnd || patch.lineStart;
          
          if (endLine < patch.lineStart) {
            throw new Error("lineEnd doit être >= lineStart");
          }
          if (endLine > lines.length) {
            throw new Error(`lineEnd ${endLine} dépasse la fin du fichier (${lines.length} lignes)`);
          }

          const deletedCount = endLine - patch.lineStart + 1;
          newLines.splice(patch.lineStart - 1, deletedCount, ...replaceLines);
          operationDescription = `Remplacé ${deletedCount} ligne(s) par ${replaceLines.length} ligne(s) (lignes ${patch.lineStart}-${endLine})`;
          break;

        case "delete":
          const deleteEndLine = patch.lineEnd || patch.lineStart;
          
          if (deleteEndLine < patch.lineStart) {
            throw new Error("lineEnd doit être >= lineStart");
          }
          if (deleteEndLine > lines.length) {
            throw new Error(`lineEnd ${deleteEndLine} dépasse la fin du fichier (${lines.length} lignes)`);
          }

          const deleteCount = deleteEndLine - patch.lineStart + 1;
          newLines.splice(patch.lineStart - 1, deleteCount);
          operationDescription = `Supprimé ${deleteCount} ligne(s) (lignes ${patch.lineStart}-${deleteEndLine})`;
          break;

        default:
          throw new Error(`Opération inconnue: ${patch.operation}`);
      }

      // Écrire le fichier modifié
      const newContent = newLines.join('\n');
      await fs.writeFile(fullPath, newContent);

      // Mettre à jour la structure en mémoire
      await this.updateFile(patch.scriptPath);

      // Générer la review automatique
      const reviewResult = this.generateAutoReview(lines, newLines, patch);

      // Mettre à jour les tokens
      let responseText = `✅ **Patch appliqué avec succès**\n\n` +
                          `**Fichier:** \`${patch.scriptPath}\`\n` +
                          `**Opération:** ${patch.operation}\n` +
                          `**Description:** ${patch.description || operationDescription}\n` +
                          `**Détails:** ${operationDescription}\n` +
                          `**Taille finale:** ${newLines.length} lignes\n\n` +
                          reviewResult;
      
      // Ajouter un rappel des règles si le workflow n'a pas été respecté
      if (!compliance.compliant) {
        responseText += `\n\n${compliance.message}`;
        responseText += `\n💡 Utilisez \`syntax_helper action: 'show_rules'\` pour voir toutes les règles.`;
      }
      
      // Ajouter le rappel syntaxique pour les outils critiques
      responseText += getSyntaxReminder('patch_script');
      
      this.updateTokenUsage(responseText);

      return {
        content: [
          {
            type: "text",
            text: responseText + this.appendTokenUsageReport(),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Impossible d'appliquer le patch: ${error}`);
    }
  }

  private generateAutoReview(originalLines: string[], newLines: string[], patch: PatchOperation): string {
    const affectedStart = Math.max(1, patch.lineStart - 2);
    const affectedEnd = Math.min(newLines.length, (patch.lineEnd || patch.lineStart) + 2);
    
    let review = `## 📋 **Review Automatique**\n\n`;
    
    // Résumé des changements
    const originalCount = originalLines.length;
    const newCount = newLines.length;
    const deltaLines = newCount - originalCount;
    
    review += `### Résumé des changements\n`;
    review += `- **Lignes avant:** ${originalCount}\n`;
    review += `- **Lignes après:** ${newCount}\n`;
    review += `- **Delta:** ${deltaLines > 0 ? '+' : ''}${deltaLines} ligne(s)\n\n`;
    
    // Code modifié avec contexte
    review += `### Code modifié (avec contexte)\n`;
    review += `\`\`\`luau\n`;
    
    for (let i = affectedStart; i <= Math.min(affectedEnd, newLines.length); i++) {
      const line = newLines[i - 1];
      const lineNum = i.toString().padStart(3, ' ');
      
      // Marquer les lignes modifiées
      if (i >= patch.lineStart && i <= (patch.lineEnd || patch.lineStart)) {
        review += `${lineNum}* ${line}\n`; // * indique une ligne modifiée
      } else {
        review += `${lineNum}  ${line}\n`;
      }
    }
    
    review += `\`\`\`\n\n`;
    
    // Analyse de sécurité basique
    const securityChecks = this.performBasicSecurityChecks(newLines, patch);
    if (securityChecks.length > 0) {
      review += `### ⚠️ Vérifications de sécurité\n`;
      securityChecks.forEach(check => {
        review += `- ${check}\n`;
      });
      review += `\n`;
    }
    
    // Analyse syntaxique basique
    const syntaxChecks = this.performBasicSyntaxChecks(newLines, patch);
    if (syntaxChecks.length > 0) {
      review += `### ✅ Vérifications syntaxiques\n`;
      syntaxChecks.forEach(check => {
        review += `- ${check}\n`;
      });
      review += `\n`;
    }
    
    // Détection d'anti-patterns Roblox
    const antiPatterns = detectAntiPatterns(newLines.join('\n'));
    if (antiPatterns.length > 0) {
      review += getAntiPatternSuggestions(antiPatterns);
    }
    
    return review;
  }

  private performBasicSecurityChecks(lines: string[], patch: PatchOperation): string[] {
    const checks: string[] = [];
    const newContent = patch.newContent || '';
    
    // Vérifier les mots-clés potentiellement dangereux
    const dangerousPatterns = [
      /require\s*\(\s*["']http/i,
      /loadstring\s*\(/i,
      /getfenv\s*\(/i,
      /setfenv\s*\(/i,
    ];
    
    dangerousPatterns.forEach(pattern => {
      if (pattern.test(newContent)) {
        checks.push(`⚠️ Détection de code potentiellement dangereux: ${pattern.source}`);
      }
    });
    
    return checks;
  }

  private performBasicSyntaxChecks(lines: string[], patch: PatchOperation): string[] {
    const checks: string[] = [];
    const fullFileContent = lines.join('\n');
    
    // Analyser le fichier complet après modification
    const luauAnalysis = this.analyzeLuauSyntax(fullFileContent);
    
    // Vérifications des blocs Luau
    if (luauAnalysis.blockBalance.isBalanced) {
      checks.push(`✅ Blocs Luau équilibrés (${luauAnalysis.blockBalance.totalBlocks} blocs)`);
    } else {
      checks.push(`❌ Blocs Luau déséquilibrés: ${luauAnalysis.blockBalance.errors.join(', ')}`);
    }
    
    // Vérifications des parenthèses et accolades
    if (luauAnalysis.bracketsBalance.isBalanced) {
      checks.push(`✅ Parenthèses et accolades équilibrées`);
    } else {
      checks.push(`❌ Déséquilibre: ${luauAnalysis.bracketsBalance.errors.join(', ')}`);
    }
    
    // Détection de fonctions dupliquées
    if (luauAnalysis.duplicateFunctions.length > 0) {
      checks.push(`⚠️ Fonctions potentiellement dupliquées: ${luauAnalysis.duplicateFunctions.join(', ')}`);
    } else {
      checks.push(`✅ Aucune fonction dupliquée détectée`);
    }
    
    // Vérification de l'indentation
    if (luauAnalysis.indentation.isConsistent) {
      checks.push(`✅ Indentation cohérente`);
    } else {
      checks.push(`⚠️ Problèmes d'indentation: ${luauAnalysis.indentation.issues.join(', ')}`);
    }
    
    // Vérification des variables locales non utilisées
    if (luauAnalysis.unusedVariables.length > 0) {
      checks.push(`⚠️ Variables locales potentiellement inutilisées: ${luauAnalysis.unusedVariables.join(', ')}`);
    }
    
    return checks;
  }

  private analyzeLuauSyntax(content: string) {
    const lines = content.split('\n');
    
    return {
      blockBalance: this.checkLuauBlocks(lines),
      bracketsBalance: this.checkBracketsBalance(content),
      duplicateFunctions: this.detectDuplicateFunctions(lines),
      indentation: this.checkIndentation(lines),
      unusedVariables: this.detectUnusedVariables(lines)
    };
  }

  private checkLuauBlocks(lines: string[]) {
    const blockStarters = [
      /\bif\b/, /\bwhile\b/, /\bfor\b/, /\brepeat\b/, 
      /\bfunction\b/, /\bdo\b/, /\bthen\b/
    ];
    const blockEnders = [
      /\bend\b/, /\buntil\b/, /\belse\b/, /\belseif\b/
    ];
    
    let blockStack: Array<{type: string, line: number}> = [];
    let errors: string[] = [];
    let totalBlocks = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;
      
      // Ignorer les commentaires
      if (line.startsWith('--')) continue;
      
      // Détecter les débuts de blocs
      for (const starter of blockStarters) {
        if (starter.test(line)) {
          const type = starter.source.replace(/\\b/g, '').replace(/\\/g, '');
          blockStack.push({type, line: lineNum});
          totalBlocks++;
          break;
        }
      }
      
      // Détecter les fins de blocs
      if (/\bend\b/.test(line)) {
        if (blockStack.length === 0) {
          errors.push(`'end' orphelin ligne ${lineNum}`);
        } else {
          blockStack.pop();
        }
      }
      
      if (/\buntil\b/.test(line)) {
        const lastBlock = blockStack[blockStack.length - 1];
        if (!lastBlock || lastBlock.type !== 'repeat') {
          errors.push(`'until' sans 'repeat' correspondant ligne ${lineNum}`);
        } else {
          blockStack.pop();
        }
      }
    }
    
    // Vérifier les blocs non fermés
    blockStack.forEach(block => {
      errors.push(`Bloc '${block.type}' ligne ${block.line} non fermé`);
    });
    
    return {
      isBalanced: errors.length === 0,
      errors,
      totalBlocks,
      unclosedBlocks: blockStack.length
    };
  }

  private checkBracketsBalance(content: string) {
    const brackets = {
      '(': ')',
      '[': ']',
      '{': '}'
    };
    
    let stack: string[] = [];
    let errors: string[] = [];
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';
      
      // Gérer les chaînes de caractères
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
        continue;
      }
      
      if (inString) continue;
      
      // Vérifier les crochets ouvrants
      if (char in brackets) {
        stack.push(char);
      }
      
      // Vérifier les crochets fermants
      if (Object.values(brackets).includes(char as any)) {
        if (stack.length === 0) {
          errors.push(`Crochet fermant '${char}' orphelin`);
        } else {
          const lastOpen = stack.pop()!;
          if (brackets[lastOpen as keyof typeof brackets] !== char) {
            errors.push(`Crochet fermant '${char}' ne correspond pas à '${lastOpen}'`);
          }
        }
      }
    }
    
    // Vérifier les crochets non fermés
    if (stack.length > 0) {
      errors.push(`Crochets non fermés: ${stack.join(', ')}`);
    }
    
    return {
      isBalanced: errors.length === 0,
      errors
    };
  }

  private detectDuplicateFunctions(lines: string[]): string[] {
    const functions = new Map<string, number[]>();
    const duplicates: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Détecter les déclarations de fonction
      const functionMatch = line.match(/(?:local\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (functionMatch) {
        const funcName = functionMatch[1];
        
        if (!functions.has(funcName)) {
          functions.set(funcName, []);
        }
        functions.get(funcName)!.push(i + 1);
      }
    }
    
    // Identifier les fonctions dupliquées
    functions.forEach((lineNumbers, funcName) => {
      if (lineNumbers.length > 1) {
        duplicates.push(`${funcName} (lignes ${lineNumbers.join(', ')})`);
      }
    });
    
    return duplicates;
  }

  private checkIndentation(lines: string[]) {
    const issues: string[] = [];
    let expectedIndent = 0;
    const INDENT_SIZE = 2; // Taille d'indentation standard
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Ignorer les lignes vides et commentaires
      if (trimmed === '' || trimmed.startsWith('--')) continue;
      
      const actualIndent = line.match(/^\s*/)?.[0].length || 0;
      const lineNum = i + 1;
      
      // Ajuster l'indentation attendue selon les mots-clés
      if (/\b(end|until|else|elseif)\b/.test(trimmed)) {
        expectedIndent = Math.max(0, expectedIndent - INDENT_SIZE);
      }
      
      // Vérifier l'indentation
      if (actualIndent !== expectedIndent) {
        issues.push(`Ligne ${lineNum}: attendu ${expectedIndent}, trouvé ${actualIndent}`);
      }
      
      // Ajuster pour la ligne suivante
      if (/\b(if|while|for|repeat|function|do|then|else|elseif)\b/.test(trimmed) && 
          !/\bend\b/.test(trimmed)) {
        expectedIndent += INDENT_SIZE;
      }
    }
    
    return {
      isConsistent: issues.length === 0,
      issues: issues.slice(0, 5) // Limiter à 5 problèmes pour éviter le spam
    };
  }

  private detectUnusedVariables(lines: string[]): string[] {
    const variables = new Map<string, {declared: number, used: boolean}>();
    const unused: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Détecter les déclarations de variables locales
      const varMatch = line.match(/local\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
      if (varMatch) {
        varMatch.forEach(match => {
          const varName = match.replace('local ', '');
          variables.set(varName, {declared: i + 1, used: false});
        });
      }
      
      // Vérifier l'utilisation des variables
      variables.forEach((info, varName) => {
        if (info.declared !== i + 1 && new RegExp(`\\b${varName}\\b`).test(line)) {
          info.used = true;
        }
      });
    }
    
    // Identifier les variables non utilisées
    variables.forEach((info, varName) => {
      if (!info.used) {
        unused.push(`${varName} (ligne ${info.declared})`);
      }
    });
    
    return unused.slice(0, 3); // Limiter à 3 variables pour éviter le spam
  }

  // === Gestion des tokens et cache sémantique ===

  private estimateTokens(text: string): number {
    // Estimation approximative : 1 token ≈ 4 caractères pour du code
    return Math.ceil(text.length / 4);
  }

  private updateTokenUsage(operationText: string) {
    const operationTokens = this.estimateTokens(operationText);
    this.tokenUsage.operationTokens = operationTokens;
    this.tokenUsage.totalTokensUsed += operationTokens;
    
    // Estimer l'utilisation du contexte (somme de tous les fichiers en mémoire)
    let contextSize = 0;
    this.projectStructure.forEach((file) => {
      if (file.content) {
        contextSize += this.estimateTokens(file.content);
      }
    });
    
    this.tokenUsage.contextWindowUsed = contextSize;
  }

  private generateSemanticCache(filePath: string, content: string): SemanticCache {
    const lines = content.split('\n');
    const cache: SemanticCache = {
      functions: new Map(),
      variables: new Map(),
      fileHash: this.hashString(content),
      lastUpdate: Date.now()
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Détecter les fonctions
      const functionMatch = line.match(/(?:local\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/);
      if (functionMatch) {
        const [, name, params] = functionMatch;
        cache.functions.set(name, {
          name,
          signature: `function ${name}(${params})`,
          line: lineNum,
          lastModified: Date.now()
        });
      }

      // Détecter les variables
      const varMatch = line.match(/local\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (varMatch) {
        const varName = varMatch[1];
        cache.variables.set(varName, {
          name: varName,
          scope: 'local',
          line: lineNum
        });
      }
    }

    return cache;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private getOptimizedFileContent(filePath: string): string {
    const cache = this.semanticCache.get(filePath);
    const fileInfo = this.projectStructure.get(filePath);
    
    if (!fileInfo) {
      this.tokenUsage.cacheMisses++;
      return '';
    }

    const currentHash = this.hashString(fileInfo.content);
    
    // Si le cache est valide, retourner seulement les signatures
    if (cache && cache.fileHash === currentHash) {
      this.tokenUsage.cacheHits++;
      
      let summary = `-- Résumé sémantique de ${filePath}\n`;
      summary += `-- ${cache.functions.size} fonction(s), ${cache.variables.size} variable(s)\n\n`;
      
      // Inclure seulement les signatures de fonctions
      cache.functions.forEach((func) => {
        summary += `${func.signature} -- ligne ${func.line}\n`;
      });
      
      return summary;
    } else {
      // Cache manqué, régénérer et stocker
      this.tokenUsage.cacheMisses++;
      const newCache = this.generateSemanticCache(filePath, fileInfo.content);
      this.semanticCache.set(filePath, newCache);
      
      return fileInfo.content; // Premier passage, retourner le contenu complet
    }
  }

  private appendTokenUsageReport(): string {
    const usagePercent = ((this.tokenUsage.contextWindowUsed / this.tokenUsage.contextWindowMax) * 100).toFixed(1);
    const cacheEfficiency = this.tokenUsage.cacheHits + this.tokenUsage.cacheMisses > 0 
      ? ((this.tokenUsage.cacheHits / (this.tokenUsage.cacheHits + this.tokenUsage.cacheMisses)) * 100).toFixed(1)
      : '0.0';

    return `\n\n---\n📊 **Utilisation des ressources**\n` +
           `🔢 **Tokens:** ${this.tokenUsage.operationTokens} (opération) | ${this.tokenUsage.totalTokensUsed} (total)\n` +
           `🪟 **Contexte:** ${this.tokenUsage.contextWindowUsed.toLocaleString()} / ${this.tokenUsage.contextWindowMax.toLocaleString()} (${usagePercent}%)\n` +
           `💾 **Cache:** ${this.tokenUsage.cacheHits} hits | ${this.tokenUsage.cacheMisses} miss (${cacheEfficiency}% efficacité)`;
  }

  private listTemplates(category?: string) {
    const templates = category ? getTemplatesByCategory(category) : luauTemplates;
    
    let responseText = `## 📚 **Templates Luau/Roblox disponibles**\n\n`;
    
    if (category) {
      responseText += `**Catégorie:** ${category}\n\n`;
    }
    
    // Grouper par catégorie
    const grouped = templates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {} as Record<string, typeof templates>);
    
    // Afficher par catégorie
    const categoryEmojis = {
      event: '📡',
      service: '⚙️',
      data: '💾',
      ui: '🎨',
      utility: '🔧',
      pattern: '📐'
    };
    
    for (const [cat, temps] of Object.entries(grouped)) {
      responseText += `### ${categoryEmojis[cat as keyof typeof categoryEmojis]} **${cat.toUpperCase()}**\n\n`;
      
      temps.forEach(template => {
        responseText += `**\`${template.name}\`** - ${template.description}\n`;
        if (template.variables && template.variables.length > 0) {
          responseText += `   Variables: \`${template.variables.join('`, `')}\`\n`;
        }
        responseText += '\n';
      });
    }
    
    responseText += `\n💡 **Usage:** \`use_template\` avec le nom du template et les variables nécessaires.`;
    
    this.updateTokenUsage(responseText);
    
    return {
      content: [
        {
          type: "text",
          text: responseText + this.appendTokenUsageReport(),
        },
      ],
    };
  }

  private async useTemplate(templateName: string, variables: Record<string, string>, targetPath?: string) {
    const template = getTemplate(templateName);
    
    if (!template) {
      throw new Error(`Template '${templateName}' non trouvé. Utilisez 'list_templates' pour voir les templates disponibles.`);
    }
    
    // Vérifier que toutes les variables requises sont fournies
    if (template.variables) {
      const missingVars = template.variables.filter(v => !variables[v]);
      if (missingVars.length > 0) {
        throw new Error(`Variables manquantes: ${missingVars.join(', ')}`);
      }
    }
    
    // Appliquer le template
    const code = applyTemplate(template, variables);
    
    let responseText = `## ✨ **Template appliqué: ${template.name}**\n\n`;
    responseText += `**Description:** ${template.description}\n`;
    responseText += `**Catégorie:** ${template.category}\n\n`;
    
    // Si un chemin cible est fourni, créer le fichier
    if (targetPath) {
      try {
        await this.createScript(targetPath, 'module', code);
        responseText += `✅ **Fichier créé:** \`${targetPath}\`\n\n`;
      } catch (error) {
        responseText += `⚠️ **Erreur lors de la création du fichier:** ${error}\n\n`;
      }
    }
    
    // Afficher le code généré
    responseText += `### Code généré:\n\`\`\`luau\n${code}\n\`\`\``;
    
    this.updateTokenUsage(responseText);
    
    return {
      content: [
        {
          type: "text",
          text: responseText + this.appendTokenUsageReport(),
        },
      ],
    };
  }

  // === SYSTÈME DE ROLLBACK OPTIMISÉ ===
  
  private saveRollbackEntry(scriptPath: string, oldContent: string, newContent: string) {
    // Créer un patch compact au lieu de stocker tout le contenu
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const patch: RollbackEntry['patch'] = {
      additions: [],
      deletions: [],
      modifications: []
    };
    
    // Calculer le diff ligne par ligne
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = i < oldLines.length ? oldLines[i] : undefined;
      const newLine = i < newLines.length ? newLines[i] : undefined;
      
      if (oldLine === undefined && newLine !== undefined) {
        patch.additions.push(`${i}:${newLine}`);
      } else if (oldLine !== undefined && newLine === undefined) {
        patch.deletions.push(`${i}:${oldLine}`);
      } else if (oldLine !== newLine && oldLine !== undefined && newLine !== undefined) {
        patch.modifications.push({ from: `${i}:${oldLine}`, to: `${i}:${newLine}` });
      }
    }
    
    // Créer l'entrée de rollback
    const entry: RollbackEntry = {
      timestamp: Date.now(),
      fileHash: this.hashString(oldContent),
      patch,
      tokenCost: this.estimateTokens(JSON.stringify(patch)) // Coût en tokens du patch
    };
    
    // Ajouter à l'historique
    if (!this.rollbackHistory.has(scriptPath)) {
      this.rollbackHistory.set(scriptPath, []);
    }
    
    const history = this.rollbackHistory.get(scriptPath)!;
    history.unshift(entry); // Ajouter au début
    
    // Limiter la taille de l'historique
    if (history.length > this.MAX_ROLLBACK_ENTRIES) {
      history.pop(); // Retirer le plus ancien
    }
    
    console.error(`💾 Rollback sauvegardé pour ${scriptPath} (${entry.tokenCost} tokens)`);
  }
  
  private async rollbackScript(scriptPath: string, steps: number = 1) {
    const history = this.rollbackHistory.get(scriptPath);
    
    if (!history || history.length === 0) {
      throw new Error(`Aucun historique de rollback pour ${scriptPath}`);
    }
    
    if (steps > history.length) {
      throw new Error(`Seulement ${history.length} version(s) disponible(s) pour rollback`);
    }
    
    // Récupérer le contenu actuel
    const fileInfo = this.projectStructure.get(scriptPath);
    if (!fileInfo) {
      throw new Error(`Le fichier ${scriptPath} n'existe pas`);
    }
    
    let currentContent = fileInfo.content;
    let appliedSteps = 0;
    
    // Appliquer les patches en ordre inverse
    for (let i = 0; i < steps && i < history.length; i++) {
      const entry = history[i];
      
      // Appliquer le patch inverse
      const lines = currentContent.split('\n');
      
      // Annuler les additions (supprimer)
      entry.patch.additions.forEach(add => {
        const [lineNum] = add.split(':');
        lines.splice(parseInt(lineNum), 1);
      });
      
      // Annuler les suppressions (ajouter)
      entry.patch.deletions.forEach(del => {
        const [lineNum, content] = del.split(':');
        lines.splice(parseInt(lineNum), 0, content);
      });
      
      // Annuler les modifications (restaurer l'ancien)
      entry.patch.modifications.forEach(mod => {
        const [lineNum] = mod.from.split(':');
        const [, oldContent] = mod.from.split(':');
        lines[parseInt(lineNum)] = oldContent;
      });
      
      currentContent = lines.join('\n');
      appliedSteps++;
    }
    
    // Écrire le fichier restauré
    const fullPath = path.join(this.projectRoot, scriptPath);
    await fs.writeFile(fullPath, currentContent);
    await this.updateFile(scriptPath);
    
    // Retirer les entrées utilisées de l'historique
    history.splice(0, appliedSteps);
    
    const responseText = `⏪ **Rollback effectué avec succès**\n\n` +
                        `**Fichier:** \`${scriptPath}\`\n` +
                        `**Versions annulées:** ${appliedSteps}\n` +
                        `**Historique restant:** ${history.length} version(s)\n` +
                        `**Tokens économisés:** ~${appliedSteps * 500} tokens vs stockage complet`;
    
    this.updateTokenUsage(responseText);
    
    return {
      content: [
        {
          type: "text",
          text: responseText + this.appendTokenUsageReport(),
        },
      ],
    };
  }
  
  private getRollbackHistory(scriptPath?: string) {
    let responseText = `## 🔄 **Historique de rollback**\n\n`;
    
    if (scriptPath) {
      // Historique pour un fichier spécifique
      const history = this.rollbackHistory.get(scriptPath);
      
      if (!history || history.length === 0) {
        responseText += `Aucun historique pour \`${scriptPath}\``;
      } else {
        responseText += `**Fichier:** \`${scriptPath}\`\n`;
        responseText += `**Versions disponibles:** ${history.length}\n\n`;
        
        history.forEach((entry, index) => {
          const date = new Date(entry.timestamp).toLocaleString();
          const changes = entry.patch.additions.length + entry.patch.deletions.length + entry.patch.modifications.length;
          
          responseText += `**${index + 1}.** ${date}\n`;
          responseText += `   📊 ${changes} changements | 💾 ${entry.tokenCost} tokens\n`;
          responseText += `   ➕ ${entry.patch.additions.length} ajouts | ➖ ${entry.patch.deletions.length} suppressions | ✏️ ${entry.patch.modifications.length} modifications\n\n`;
        });
      }
    } else {
      // Historique global
      let totalEntries = 0;
      let totalTokens = 0;
      
      this.rollbackHistory.forEach((history, file) => {
        if (history.length > 0) {
          totalEntries += history.length;
          history.forEach(entry => totalTokens += entry.tokenCost);
          
          responseText += `**\`${file}\`** - ${history.length} version(s)\n`;
        }
      });
      
      if (totalEntries === 0) {
        responseText += `Aucun historique de rollback disponible.`;
      } else {
        responseText += `\n**Total:** ${totalEntries} versions | ${totalTokens} tokens stockés`;
        responseText += `\n**Économie vs stockage complet:** ~${totalEntries * 2000 - totalTokens} tokens`;
      }
    }
    
    this.updateTokenUsage(responseText);
    
    return {
      content: [
        {
          type: "text",
          text: responseText + this.appendTokenUsageReport(),
        },
      ],
    };
  }
  
  private async searchRobloxDocs(query: string, category: string = "all") {
    let responseText = `## 🔎 **Recherche Documentation Roblox**\n\n`;
    responseText += `**Recherche:** "${query}"${category !== "all" ? ` (${category})` : ""}\n\n`;
    
    try {
      // URLs de recherche Roblox
      const searchUrls = {
        api: `https://create.roblox.com/docs/reference/engine/search?query=${encodeURIComponent(query)}`,
        tutorial: `https://create.roblox.com/docs/tutorials/search?query=${encodeURIComponent(query)}`,
        guide: `https://create.roblox.com/docs/guides/search?query=${encodeURIComponent(query)}`,
        all: `https://create.roblox.com/docs/search?query=${encodeURIComponent(query)}`
      };
      
      const searchUrl = searchUrls[category as keyof typeof searchUrls] || searchUrls.all;
      
      // Simuler une recherche structurée (dans la vraie implémentation, on pourrait utiliser WebFetch)
      responseText += `### 📖 **Résultats suggérés:**\n\n`;
      
      // Recherche dans notre cache local d'abord
      const localResults = searchAPIs(query);
      
      if (localResults.length > 0) {
        responseText += `**Depuis le cache local (${localResults.length} résultats):**\n\n`;
        localResults.slice(0, 5).forEach(result => {
          if (result.method) {
            responseText += `- **${result.service}.${result.method}** - Méthode\n`;
          } else if (result.property) {
            responseText += `- **${result.service}.${result.property}** - Propriété\n`;
          }
        });
        responseText += `\n`;
      }
      
      // Suggestions de recherches connexes basées sur le query
      const suggestions = this.generateSearchSuggestions(query);
      
      if (suggestions.length > 0) {
        responseText += `### 💡 **Suggestions de recherche:**\n\n`;
        suggestions.forEach(suggestion => {
          responseText += `- \`search_roblox_docs query: "${suggestion}"\`\n`;
        });
        responseText += `\n`;
      }
      
      // Liens directs vers la documentation
      responseText += `### 🔗 **Liens utiles:**\n\n`;
      responseText += `- [Documentation officielle](https://create.roblox.com/docs)\n`;
      responseText += `- [API Reference](https://create.roblox.com/docs/reference/engine)\n`;
      responseText += `- [Tutorials](https://create.roblox.com/docs/tutorials)\n`;
      responseText += `- [Recherche directe: ${query}](${searchUrl})\n\n`;
      
      // Conseil d'utilisation
      responseText += `💡 **Astuce:** Pour une recherche plus précise, utilisez:\n`;
      responseText += `- \`roblox_api search: "${query}"\` pour chercher dans le cache local\n`;
      responseText += `- \`WebSearch query: "Roblox ${query} documentation"\` pour une recherche web complète\n`;
      
    } catch (error) {
      responseText += `❌ Erreur lors de la recherche: ${error}\n`;
      responseText += `\nUtilisez \`WebSearch\` directement pour rechercher sur le web.`;
    }
    
    this.updateTokenUsage(responseText);
    
    return {
      content: [
        {
          type: "text",
          text: responseText + this.appendTokenUsageReport(),
        },
      ],
    };
  }
  
  private generateSearchSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Suggestions contextuelles basées sur des mots-clés
    const contextMap: Record<string, string[]> = {
      "remote": ["RemoteEvent", "RemoteFunction", "RemoteEvent:FireClient", "RemoteEvent:FireAllClients"],
      "tween": ["TweenService", "TweenInfo", "Tween:Play", "EasingStyle"],
      "data": ["DataStore", "DataStoreService", "GetAsync", "SetAsync", "UpdateAsync"],
      "player": ["Players", "Player.Character", "Player.UserId", "PlayerAdded"],
      "ui": ["ScreenGui", "Frame", "TextLabel", "UIGradient", "UserInputService"],
      "animation": ["AnimationTrack", "Humanoid:LoadAnimation", "AnimationController"],
      "pathfind": ["PathfindingService", "ComputeAsync", "Path.Waypoints"],
      "raycast": ["Workspace:Raycast", "RaycastParams", "RaycastResult"],
      "sound": ["Sound", "SoundService", "Sound:Play", "Sound.Volume"],
      "particle": ["ParticleEmitter", "Fire", "Smoke", "Sparkles"]
    };
    
    // Chercher des suggestions basées sur le query
    for (const [key, values] of Object.entries(contextMap)) {
      if (lowerQuery.includes(key)) {
        suggestions.push(...values.filter(v => !v.toLowerCase().includes(lowerQuery)));
      }
    }
    
    // Si pas de suggestions contextuelles, proposer des variations
    if (suggestions.length === 0 && query.length > 3) {
      suggestions.push(
        `${query} tutorial`,
        `${query} example`,
        `${query} best practices`,
        `how to use ${query}`
      );
    }
    
    return suggestions.slice(0, 5); // Limiter à 5 suggestions
  }

  private getRobloxAPI(service?: string, search?: string) {
    let responseText = `## 📚 **Documentation API Roblox**\n\n`;
    
    if (search) {
      // Mode recherche
      const results = searchAPIs(search);
      
      if (results.length === 0) {
        responseText += `❌ Aucun résultat pour "${search}"`;
      } else {
        responseText += `**Résultats pour "${search}":** ${results.length} trouvé(s)\n\n`;
        
        results.forEach(result => {
          if (result.method) {
            responseText += `📍 **${result.service}.${result.method}**\n`;
            const api = getServiceAPI(result.service);
            const method = api?.methods.find(m => m.name === result.method);
            if (method) {
              responseText += `   \`${method.signature}\`\n`;
              responseText += `   ${method.description}\n`;
              if (method.example) {
                responseText += `   \`\`\`luau\n   ${method.example}\n   \`\`\`\n`;
              }
              if (method.deprecated) {
                responseText += `   ⚠️ **DÉPRÉCIÉ**\n`;
              }
            }
          } else if (result.property) {
            responseText += `📍 **${result.service}.${result.property}**\n`;
            const api = getServiceAPI(result.service);
            const prop = api?.properties?.find(p => p.name === result.property);
            if (prop) {
              responseText += `   Type: \`${prop.type}\`${prop.readonly ? ' (readonly)' : ''}\n`;
              responseText += `   ${prop.description}\n`;
            }
          }
          responseText += '\n';
        });
      }
    } else if (service) {
      // Afficher un service spécifique
      const api = getServiceAPI(service);
      
      if (!api) {
        responseText += `❌ Service "${service}" non trouvé\n\n`;
        responseText += `**Services disponibles:**\n`;
        robloxAPIs.forEach(api => {
          responseText += `- ${api.service}\n`;
        });
      } else {
        responseText += `### 🎮 **${api.service}**\n\n`;
        
        // Méthodes
        if (api.methods.length > 0) {
          responseText += `**Méthodes:**\n\n`;
          api.methods.forEach(method => {
            responseText += `**\`${method.name}\`**${method.deprecated ? ' ⚠️ DÉPRÉCIÉ' : ''}\n`;
            responseText += `\`${method.signature}\`\n`;
            responseText += `${method.description}\n`;
            if (method.example) {
              responseText += `\`\`\`luau\n${method.example}\n\`\`\`\n`;
            }
            responseText += '\n';
          });
        }
        
        // Propriétés
        if (api.properties && api.properties.length > 0) {
          responseText += `**Propriétés:**\n\n`;
          api.properties.forEach(prop => {
            responseText += `**\`${prop.name}\`** - \`${prop.type}\`${prop.readonly ? ' (readonly)' : ''}\n`;
            responseText += `${prop.description}\n\n`;
          });
        }
      }
    } else {
      // Liste tous les services
      responseText += `**Services disponibles:** ${robloxAPIs.length}\n\n`;
      
      robloxAPIs.forEach(api => {
        const methodCount = api.methods.length;
        const propCount = api.properties?.length || 0;
        responseText += `**\`${api.service}\`** - ${methodCount} méthodes, ${propCount} propriétés\n`;
      });
      
      responseText += `\n### 🔧 **Types communs:**\n\n`;
      Object.entries(commonTypes).forEach(([type, signature]) => {
        responseText += `**${type}:** \`${signature}\`\n`;
      });
      
      responseText += `\n💡 **Usage:** \`roblox_api service: "Players"\` ou \`roblox_api search: "tween"\``;
    }
    
    this.updateTokenUsage(responseText);
    
    return {
      content: [
        {
          type: "text",
          text: responseText + this.appendTokenUsageReport(),
        },
      ],
    };
  }

  private checkAntiPatterns(scriptPath: string, autoFix: boolean = false) {
    const fileInfo = this.projectStructure.get(scriptPath);
    
    if (!fileInfo) {
      throw new Error(`Le script ${scriptPath} n'existe pas`);
    }
    
    const antiPatterns = detectAntiPatterns(fileInfo.content);
    
    let responseText = `## 🔍 **Analyse des anti-patterns**\n\n`;
    responseText += `**Fichier:** \`${scriptPath}\`\n`;
    responseText += `**Lignes:** ${fileInfo.content.split('\n').length}\n\n`;
    
    if (antiPatterns.length === 0) {
      responseText += `✅ **Aucun anti-pattern détecté !** Le code suit les bonnes pratiques Roblox.`;
    } else {
      responseText += `**${antiPatterns.length} problème(s) détecté(s):**\n\n`;
      responseText += getAntiPatternSuggestions(antiPatterns);
      
      // Statistiques
      const errors = antiPatterns.filter(p => p.pattern.severity === 'error').length;
      const warnings = antiPatterns.filter(p => p.pattern.severity === 'warning').length;
      const infos = antiPatterns.filter(p => p.pattern.severity === 'info').length;
      
      responseText += `\n### 📊 **Résumé**\n`;
      responseText += `- 🔴 Erreurs critiques: ${errors}\n`;
      responseText += `- 🟡 Avertissements: ${warnings}\n`;
      responseText += `- 🔵 Suggestions: ${infos}\n`;
      
      if (autoFix && errors + warnings > 0) {
        responseText += `\n### 🔧 **Corrections suggérées**\n`;
        responseText += `Utilisez \`patch_script\` pour appliquer les corrections une par une.\n`;
        
        // Générer des exemples de patch pour les erreurs critiques
        const criticalFixes = antiPatterns
          .filter(p => p.pattern.severity === 'error' && p.pattern.fix)
          .slice(0, 3);
          
        criticalFixes.forEach(({pattern, line}) => {
          responseText += `\n**Fix ligne ${line} (${pattern.name}):**\n`;
          if (pattern.example) {
            responseText += `\`\`\`luau\n${pattern.example}\n\`\`\`\n`;
          }
        });
      }
    }
    
    this.updateTokenUsage(responseText);
    
    return {
      content: [
        {
          type: "text",
          text: responseText + this.appendTokenUsageReport(),
        },
      ],
    };
  }

  // === CHAIN-OF-THOUGHT SYSTEM ===
  
  private toggleChainOfThought(enabled: boolean, verbose: boolean = false) {
    this.chainOfThoughtEnabled = enabled;
    
    let responseText = `## 🧠 **Chain-of-Thought ${enabled ? 'Activé' : 'Désactivé'}**\n\n`;
    
    if (enabled) {
      responseText += `Le système va maintenant :\n`;
      responseText += `1. **Analyser** chaque action avant exécution\n`;
      responseText += `2. **Expliquer** le raisonnement et les risques\n`;
      responseText += `3. **Proposer** des alternatives si nécessaire\n`;
      responseText += `4. **Documenter** chaque décision prise\n\n`;
      
      if (verbose) {
        responseText += `**Mode verbeux activé** - Plus de détails seront fournis.\n\n`;
      }
      
      responseText += `### 💡 **Exemple de processus de pensée :**\n`;
      responseText += `\`\`\`\n`;
      responseText += `🤔 ANALYSE: Modification du fichier main.server.luau\n`;
      responseText += `📋 CONTEXTE: Fichier existant, 178 lignes\n`;
      responseText += `⚠️ RISQUES: Possible rupture de fonctionnalité\n`;
      responseText += `🔄 ALTERNATIVES: Utiliser patch_script pour modification ciblée\n`;
      responseText += `✅ DÉCISION: Procéder avec backup automatique\n`;
      responseText += `\`\`\`\n`;
    } else {
      responseText += `Le système exécutera les actions directement sans analyse préalable.\n`;
    }
    
    responseText += `\n**Historique:** ${this.thoughtHistory.length} réflexions enregistrées`;
    
    this.updateTokenUsage(responseText);
    
    return {
      content: [
        {
          type: "text",
          text: responseText + this.appendTokenUsageReport(),
        },
      ],
    };
  }
  
  private getThoughtHistory(limit: number = 10) {
    let responseText = `## 💭 **Historique Chain-of-Thought**\n\n`;
    
    if (this.thoughtHistory.length === 0) {
      responseText += `Aucune réflexion enregistrée. Activez le chain-of-thought d'abord.`;
    } else {
      responseText += `**Total:** ${this.thoughtHistory.length} réflexions\n`;
      responseText += `**Affichage:** ${Math.min(limit, this.thoughtHistory.length)} dernières\n\n`;
      
      const thoughtsToShow = this.thoughtHistory.slice(0, limit);
      
      thoughtsToShow.forEach((thought, index) => {
        responseText += `### ${index + 1}. ${thought.step}\n`;
        responseText += `**Raisonnement:** ${thought.reasoning}\n`;
        
        if (thought.risks && thought.risks.length > 0) {
          responseText += `**Risques identifiés:**\n`;
          thought.risks.forEach(risk => {
            responseText += `- ⚠️ ${risk}\n`;
          });
        }
        
        if (thought.alternatives && thought.alternatives.length > 0) {
          responseText += `**Alternatives considérées:**\n`;
          thought.alternatives.forEach(alt => {
            responseText += `- 🔄 ${alt}\n`;
          });
        }
        
        responseText += `\n`;
      });
    }
    
    this.updateTokenUsage(responseText);
    
    return {
      content: [
        {
          type: "text",
          text: responseText + this.appendTokenUsageReport(),
        },
      ],
    };
  }
  
  private generateThoughtProcess(action: string, context: any): ThoughtProcess {
    const thoughts: Record<string, (ctx: any) => ThoughtProcess> = {
      write_script: (ctx) => ({
        step: `Écriture dans ${ctx.scriptPath}`,
        reasoning: ctx.hasExistingFile 
          ? `Modification d'un fichier existant de ${ctx.contentSize} caractères. Le système de diff et rollback permettra de revenir en arrière si nécessaire.`
          : `Création d'un nouveau fichier. Vérification de la structure du répertoire et des conventions de nommage.`,
        risks: ctx.hasExistingFile 
          ? ['Écrasement du contenu existant', 'Possible rupture de dépendances']
          : ['Le répertoire parent pourrait ne pas exister'],
        alternatives: ctx.hasExistingFile 
          ? ['Utiliser patch_script pour des modifications ciblées', 'Créer une copie de sauvegarde d\'abord']
          : ['Vérifier si un template existe pour ce type de fichier']
      }),
      
      patch_script: (ctx) => ({
        step: `Patch du fichier ${ctx.scriptPath}`,
        reasoning: `Application d'un patch ${ctx.operation} sur ${ctx.lineCount || 1} ligne(s). Cette approche est plus sûre qu'une réécriture complète.`,
        risks: [
          'Les numéros de ligne pourraient avoir changé',
          'Le contexte du code pourrait rendre le patch invalide'
        ],
        alternatives: [
          'Utiliser write_script pour une refonte complète',
          'Vérifier d\'abord avec preview_patch'
        ]
      }),
      
      create_script: (ctx) => ({
        step: `Création de ${ctx.scriptPath}`,
        reasoning: `Nouveau script de type ${ctx.scriptType}. Vérification des conventions de nommage Rojo.`,
        risks: [
          'Un fichier du même nom pourrait déjà exister',
          'Le type de script pourrait ne pas correspondre au répertoire'
        ],
        alternatives: [
          `Utiliser un template pour ${ctx.scriptType}`,
          'Vérifier d\'abord la structure du projet'
        ]
      }),
      
      delete_script: (ctx) => ({
        step: `Suppression de ${ctx.scriptPath}`,
        reasoning: `Suppression définitive du fichier. Le rollback permettra de récupérer si nécessaire.`,
        risks: [
          'D\'autres scripts pourraient dépendre de ce fichier',
          'Perte de code potentiellement important'
        ],
        alternatives: [
          'Renommer le fichier au lieu de le supprimer',
          'Commenter le contenu au lieu de supprimer',
          'Vérifier les dépendances d\'abord'
        ]
      })
    };
    
    // Retourner la pensée appropriée ou une pensée par défaut
    const thoughtGenerator = thoughts[action];
    if (thoughtGenerator) {
      return thoughtGenerator(context);
    }
    
    // Pensée par défaut
    return {
      step: `Action: ${action}`,
      reasoning: `Exécution de l'action ${action} avec le contexte fourni.`,
      risks: ['Impact inconnu sur le projet'],
      alternatives: ['Vérifier la documentation avant de procéder']
    };
  }

  private generateDiff(oldContent: string, newContent: string): string {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    let additions = 0;
    let deletions = 0;
    let modifications = 0;
    let diffPreview = '';
    
    // Algorithme de diff simple basé sur les lignes
    const maxLines = Math.max(oldLines.length, newLines.length);
    const changedLines: Array<{line: number, type: 'add' | 'del' | 'mod', content: string}> = [];
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = i < oldLines.length ? oldLines[i] : undefined;
      const newLine = i < newLines.length ? newLines[i] : undefined;
      
      if (oldLine === undefined && newLine !== undefined) {
        // Ligne ajoutée
        additions++;
        changedLines.push({line: i + 1, type: 'add', content: newLine});
      } else if (oldLine !== undefined && newLine === undefined) {
        // Ligne supprimée
        deletions++;
        changedLines.push({line: i + 1, type: 'del', content: oldLine});
      } else if (oldLine !== newLine) {
        // Ligne modifiée
        modifications++;
        changedLines.push({line: i + 1, type: 'mod', content: newLine!});
      }
    }
    
    // Générer un aperçu compact des changements
    if (changedLines.length === 0) {
      return '';
    }
    
    diffPreview = `## 📊 **Résumé des changements**\n`;
    diffPreview += `- **Lignes ajoutées:** +${additions}\n`;
    diffPreview += `- **Lignes supprimées:** -${deletions}\n`;
    diffPreview += `- **Lignes modifiées:** ~${modifications}\n\n`;
    
    // Afficher les 5 premiers changements pour économiser les tokens
    if (changedLines.length > 0) {
      diffPreview += `### Aperçu des changements (${Math.min(5, changedLines.length)}/${changedLines.length}):\n\`\`\`diff\n`;
      
      changedLines.slice(0, 5).forEach(change => {
        const prefix = change.type === 'add' ? '+' : change.type === 'del' ? '-' : '~';
        const lineNum = change.line.toString().padStart(4, ' ');
        diffPreview += `${prefix} ${lineNum}: ${change.content.slice(0, 60)}${change.content.length > 60 ? '...' : ''}\n`;
      });
      
      if (changedLines.length > 5) {
        diffPreview += `... et ${changedLines.length - 5} autres changements\n`;
      }
      
      diffPreview += `\`\`\``;
    }
    
    return diffPreview;
  }

  private previewPatch(patch: PatchOperation) {
    try {
      const fileInfo = this.projectStructure.get(patch.scriptPath);
      
      if (!fileInfo) {
        throw new Error(`Le script ${patch.scriptPath} n'existe pas ou n'est pas chargé`);
      }

      const lines = fileInfo.content.split('\n');

      // Valider les numéros de ligne
      if (patch.lineStart < 1 || patch.lineStart > lines.length + 1) {
        throw new Error(`Numéro de ligne invalide: ${patch.lineStart} (fichier a ${lines.length} lignes)`);
      }

      // Simuler l'opération
      let newLines = [...lines];
      let preview = "";

      switch (patch.operation) {
        case "insert":
          if (!patch.newContent) {
            throw new Error("newContent requis pour l'opération insert");
          }
          const insertLines = patch.newContent.split('\n');
          newLines.splice(patch.lineStart - 1, 0, ...insertLines);
          
          preview = `**PREVIEW - Insertion à la ligne ${patch.lineStart}**\n\n`;
          preview += "**Contenu à insérer:**\n```luau\n" + patch.newContent + "\n```\n\n";
          break;

        case "replace":
          if (!patch.newContent) {
            throw new Error("newContent requis pour l'opération replace");
          }
          const endLine = patch.lineEnd || patch.lineStart;
          const originalContent = lines.slice(patch.lineStart - 1, endLine).join('\n');
          
          preview = `**PREVIEW - Remplacement lignes ${patch.lineStart}-${endLine}**\n\n`;
          preview += "**Contenu actuel:**\n```luau\n" + originalContent + "\n```\n\n";
          preview += "**Nouveau contenu:**\n```luau\n" + patch.newContent + "\n```\n\n";
          break;

        case "delete":
          const deleteEndLine = patch.lineEnd || patch.lineStart;
          const deletedContent = lines.slice(patch.lineStart - 1, deleteEndLine).join('\n');
          
          preview = `**PREVIEW - Suppression lignes ${patch.lineStart}-${deleteEndLine}**\n\n`;
          preview += "**Contenu à supprimer:**\n```luau\n" + deletedContent + "\n```\n\n";
          break;

        default:
          throw new Error(`Opération inconnue: ${patch.operation}`);
      }

      // Afficher le contexte (quelques lignes avant/après)
      const contextStart = Math.max(1, patch.lineStart - 3);
      const contextEnd = Math.min(lines.length, (patch.lineEnd || patch.lineStart) + 3);
      const contextLines = newLines.slice(contextStart - 1, contextEnd);
      
      preview += "**Contexte après modification:**\n```luau\n";
      contextLines.forEach((line, index) => {
        const lineNum = contextStart + index;
        preview += `${lineNum.toString().padStart(3)}: ${line}\n`;
      });
      preview += "```";

      return {
        content: [
          {
            type: "text",
            text: preview,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Impossible de prévisualiser le patch: ${error}`);
    }
  }

  private async performAutoValidation(scriptPath: string): Promise<string | null> {
    try {
      // Utiliser uniquement une validation rapide du fichier modifié
      const fullPath = path.join(this.projectRoot, scriptPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      
      let errors: string[] = [];
      let warnings: string[] = [];
      
      // Validation syntaxique rapide mais plus robuste
      let blockStack: string[] = [];
      let bracketStack: string[] = [];
      let inString = false;
      let stringChar = '';
      
      lines.forEach((line, index) => {
        let i = 0;
        let inComment = false;
        
        // Analyse caractère par caractère
        while (i < line.length) {
          const char = line[i];
          const nextChar = line[i + 1];
          
          // Détecter les commentaires
          if (!inString && char === '-' && nextChar === '-') {
            inComment = true;
            break;
          }
          
          // Gérer les strings
          if (!inComment && (char === '"' || char === "'") && (i === 0 || line[i-1] !== '\\')) {
            if (!inString) {
              inString = true;
              stringChar = char;
            } else if (char === stringChar) {
              inString = false;
            }
          }
          
          // Vérifier les brackets hors strings
          if (!inString && !inComment) {
            if (char === '(' || char === '{' || char === '[') {
              bracketStack.push(char);
            } else if (char === ')' || char === '}' || char === ']') {
              const expected = char === ')' ? '(' : char === '}' ? '{' : '[';
              if (bracketStack.length === 0 || bracketStack[bracketStack.length - 1] !== expected) {
                errors.push(`Ligne ${index + 1}: '${char}' sans '${expected}' correspondant`);
              } else {
                bracketStack.pop();
              }
            }
          }
          
          i++;
        }
        
        // Analyser les mots-clés de bloc (hors strings et commentaires)
        if (!inComment && !inString) {
          const trimmed = line.trim();
          
          // Détecter les débuts de blocs
          if (/\b(function|if|for|while|repeat|do)\b/.test(trimmed)) {
            if (!trimmed.includes(' end') && !trimmed.includes(' return') && !trimmed.includes(' break')) {
              blockStack.push('block');
            }
          }
          
          // Détecter les 'then' qui nécessitent un 'end'
          if (/\bthen\b/.test(trimmed) && !trimmed.includes('then return') && !trimmed.includes('then break')) {
            blockStack.push('then');
          }
          
          // Détecter les 'end'
          if (/\bend\b/.test(trimmed)) {
            if (blockStack.length === 0) {
              errors.push(`Ligne ${index + 1}: 'end' sans bloc correspondant`);
            } else {
              blockStack.pop();
            }
          }
          
          // Vérifier les patterns dangereux
          if (/\bwait\s*\(/.test(trimmed)) {
            warnings.push(`Ligne ${index + 1}: Utiliser task.wait() au lieu de wait()`);
          }
        }
        
        // Réinitialiser l'état string à la fin de chaque ligne si non fermée (erreur)
        if (inString) {
          errors.push(`Ligne ${index + 1}: String non fermée`);
          inString = false;
        }
      });
      
      // Vérifications finales
      if (blockStack.length > 0) {
        errors.push(`${blockStack.length} bloc(s) non fermé(s)`);
      }
      
      if (bracketStack.length > 0) {
        errors.push(`${bracketStack.length} parenthèse(s)/accolade(s) non fermée(s)`);
      }
      
      // Générer le rapport si des problèmes sont trouvés
      if (errors.length > 0 || warnings.length > 0) {
        let report = '📋 **Auto-validation:**\n';
        
        if (errors.length > 0) {
          report += `\n❌ **Erreurs (${errors.length}):**\n`;
          errors.forEach(err => report += `- ${err}\n`);
        }
        
        if (warnings.length > 0) {
          report += `\n⚠️  **Avertissements (${warnings.length}):**\n`;
          warnings.forEach(warn => report += `- ${warn}\n`);
        }
        
        return report;
      }
      
      return null; // Pas de problèmes
      
    } catch (error) {
      // Si la validation échoue, ne pas bloquer l'opération
      console.error('Erreur lors de la validation automatique:', error);
      return null;
    }
  }

  private async handleSyntaxHelper(
    action: string,
    scriptPath?: string,
    templateName?: string,
    errorMessage?: string,
    args?: any
  ) {
    let responseText = "";
    const compliance = checkWorkflowCompliance(this.toolHistory, 'syntax_helper');

    try {
      switch (action) {
        case "get_template":
          if (!templateName) {
            // Lister tous les templates disponibles
            responseText = "## 📋 **Templates de code disponibles:**\n\n";
            Object.keys(patchTemplates).forEach(name => {
              responseText += `- **${name}**: ${this.getTemplateDescription(name)}\n`;
            });
            responseText += "\n💡 Utilisez `syntax_helper action: 'get_template', templateName: 'nom'` pour obtenir un template spécifique.";
          } else {
            const template = patchTemplates[templateName as keyof typeof patchTemplates];
            if (template) {
              responseText = `## 📝 **Template: ${templateName}**\n\n`;
              responseText += "```luau\n" + template + "\n```\n\n";
              responseText += "💡 Remplacez les placeholders {{variable}} par vos valeurs.";
            } else {
              throw new Error(`Template '${templateName}' non trouvé`);
            }
          }
          break;

        case "validate_syntax":
          if (!scriptPath) {
            throw new Error("scriptPath requis pour validate_syntax");
          }
          const fullPath = path.join(this.projectRoot, scriptPath);
          const content = await fs.readFile(fullPath, 'utf-8');
          const validation = validateSyntaxBalance(content);
          
          responseText = `## 🔍 **Validation syntaxique: ${scriptPath}**\n\n`;
          if (validation.isValid) {
            responseText += "✅ **Syntaxe valide!**\n\n";
          } else {
            responseText += "❌ **Problèmes détectés:**\n\n";
            validation.issues.forEach(issue => {
              responseText += `- ${issue}\n`;
            });
          }
          
          // Ajouter les comptages
          const counts = countSyntaxElements(content);
          responseText += "\n**📊 Comptages:**\n";
          responseText += `- Functions: ${counts.functions}\n`;
          responseText += `- Ends: ${counts.ends}\n`;
          responseText += `- If/then: ${counts.ifs}\n`;
          responseText += `- For/do: ${counts.fors}\n`;
          responseText += `- While/do: ${counts.whiles}\n`;
          responseText += `- Accolades: ${counts.openBraces} ouvertes, ${counts.closeBraces} fermées\n`;
          break;

        case "count_blocks":
          if (!scriptPath) {
            throw new Error("scriptPath requis pour count_blocks");
          }
          const fullPath2 = path.join(this.projectRoot, scriptPath);
          const content2 = await fs.readFile(fullPath2, 'utf-8');
          const counts2 = countSyntaxElements(content2);
          
          responseText = `## 📊 **Analyse des blocs: ${scriptPath}**\n\n`;
          responseText += `- **Functions:** ${counts2.functions}\n`;
          responseText += `- **End statements:** ${counts2.ends}\n`;
          responseText += `- **If blocks:** ${counts2.ifs}\n`;
          responseText += `- **For loops:** ${counts2.fors}\n`;
          responseText += `- **While loops:** ${counts2.whiles}\n`;
          responseText += `- **Repeat/until:** ${counts2.repeats}/${counts2.untils}\n`;
          responseText += `- **Braces:** ${counts2.openBraces} { et ${counts2.closeBraces} }\n\n`;
          
          const expectedEnds = counts2.functions + counts2.ifs + counts2.fors + counts2.whiles;
          if (counts2.ends !== expectedEnds) {
            responseText += `⚠️ **Attention:** Attendu ${expectedEnds} 'end' mais trouvé ${counts2.ends}\n`;
          } else {
            responseText += `✅ **Tous les blocs sont correctement fermés**\n`;
          }
          break;

        case "suggest_fix":
          if (!errorMessage) {
            throw new Error("errorMessage requis pour suggest_fix");
          }
          const suggestions = suggestSyntaxFixes("", errorMessage);
          
          responseText = `## 💡 **Suggestions pour l'erreur:**\n\n`;
          responseText += `**Erreur:** ${errorMessage}\n\n`;
          
          if (suggestions.length > 0) {
            responseText += "**Suggestions:**\n";
            suggestions.forEach(suggestion => {
              responseText += `- ${suggestion}\n`;
            });
          }
          break;

        // NOUVELLES ACTIONS AVEC LE SYSTÈME DE VALIDATION OBLIGATOIRE
        case "check":
          if (!scriptPath) {
            throw new Error("scriptPath requis pour check");
          }
          responseText = await syntaxHelperTool({ 
            action: 'check', 
            scriptPath 
          }, this.projectRoot);
          break;
          
        case "find_unclosed":
          if (!scriptPath) {
            throw new Error("scriptPath requis pour find_unclosed");
          }
          responseText = await syntaxHelperTool({ 
            action: 'find_unclosed', 
            scriptPath 
          }, this.projectRoot);
          break;
          
        case "preview":
          const previewContent = args?.content as string;
          if (!previewContent) {
            throw new Error("content requis pour preview");
          }
          responseText = await syntaxHelperTool({ 
            action: 'preview', 
            content: previewContent 
          }, this.projectRoot);
          break;
          
        case "show_rules":
          responseText = await syntaxHelperTool({ 
            action: 'show_rules' 
          }, this.projectRoot);
          break;
          // Ajouter des conseils généraux
          responseText += "\n**Conseils généraux:**\n";
          responseText += "- Utilisez `read_script` pour voir le fichier complet\n";
          responseText += "- Utilisez `syntax_helper action: 'count_blocks'` pour analyser les blocs\n";
          responseText += "- Utilisez `preview_patch` avant d'appliquer des changements\n";
          break;

        case "show_rules":
          responseText = `## 📜 **Règles de syntaxe pour Claude Desktop**\n\n`;
          responseText += SYNTAX_RULES.MANDATORY_WORKFLOW + "\n\n";
          responseText += SYNTAX_RULES.PATCH_BEST_PRACTICES + "\n\n";
          responseText += "### 🚫 **Erreurs courantes à éviter:**\n\n";
          SYNTAX_RULES.COMMON_MISTAKES.forEach((mistake, index) => {
            responseText += `${index + 1}. **${mistake.pattern}**\n`;
            responseText += `   ➡️ ${mistake.solution}\n\n`;
          });
          responseText += "\n### 📊 **Votre historique d'outils récents:**\n";
          responseText += this.toolHistory.slice(-5).join(" → ") || "Aucun outil utilisé";
          
          // Ajouter un avertissement si le workflow n'est pas respecté
          if (!compliance.compliant) {
            responseText += `\n\n${compliance.message}`;
          }
          break;

        default:
          throw new Error(`Action '${action}' non reconnue`);
      }
    } catch (error) {
      responseText = `❌ **Erreur:** ${error instanceof Error ? error.message : String(error)}`;
    }

    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
    };
  }

  private getTemplateDescription(templateName: string): string {
    const descriptions: { [key: string]: string } = {
      addFunction: "Ajouter une nouvelle fonction",
      addModuleMethod: "Ajouter une méthode à un module",
      addEventHandler: "Ajouter un gestionnaire d'événement",
      addConditional: "Ajouter un bloc conditionnel",
      addLoop: "Ajouter une boucle for",
      addWhileLoop: "Ajouter une boucle while",
      addRemoteHandler: "Ajouter un gestionnaire RemoteEvent",
      createModule: "Créer un nouveau module complet",
      addServiceInit: "Initialiser un service Roblox",
      addPlayerJoined: "Gérer l'arrivée d'un joueur"
    };
    return descriptions[templateName] || "Template de code";
  }

  private analyzeErrorMessage(
    errorMessage: string,
    filePath?: string,
    lineNumber?: number
  ) {
    // Générer le rapport d'analyse automatique
    const report = generateErrorAnalysisReport(errorMessage, filePath, lineNumber);
    
    // Ajouter des instructions spécifiques basées sur l'historique
    let enhancedReport = report;
    
    // Vérifier si Claude a déjà essayé de corriger
    const recentPatches = this.toolHistory.filter(tool => tool === 'patch_script').length;
    if (recentPatches > 2) {
      enhancedReport += `\n\n⚠️ **ATTENTION:** Vous avez déjà fait ${recentPatches} patches. `;
      enhancedReport += `ARRÊTEZ de patcher et analysez d'abord le problème complètement.\n`;
      enhancedReport += `Utilisez 'rollback_history' si nécessaire pour revenir en arrière.`;
    }
    
    // Ajouter un avertissement si pas de lecture récente
    const hasRecentRead = this.toolHistory.slice(-5).includes('read_script');
    if (!hasRecentRead && filePath) {
      enhancedReport += `\n\n🚨 **RAPPEL OBLIGATOIRE:**\n`;
      enhancedReport += `Vous DEVEZ utiliser \`read_script("${filePath}")\` AVANT toute modification!`;
    }
    
    // Forcer l'approche minimale
    enhancedReport += `\n\n## 📏 Principe de correction MINIMAL:\n`;
    enhancedReport += `1. **Identifier** exactement quelle ligne cause l'erreur\n`;
    enhancedReport += `2. **Modifier** UNIQUEMENT cette ligne/ce bloc\n`;
    enhancedReport += `3. **Valider** que l'erreur est résolue\n`;
    enhancedReport += `4. **STOP** - Ne pas "améliorer" le code qui fonctionne\n`;
    
    return {
      content: [
        {
          type: "text",
          text: enhancedReport,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("🚀 Serveur MCP Rojo démarré!");
  }

  async cleanup() {
    if (this.fileWatcher) {
      await this.fileWatcher.close();
      console.error("👁️ Surveillance des fichiers arrêtée");
    }
  }
}

// Gestion propre de l'arrêt
const server = new RojoMCPServer();

process.on("SIGINT", async () => {
  console.error("🛑 Arrêt du serveur...");
  await server.cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await server.cleanup();
  process.exit(0);
});

// Démarrage du serveur
server.run().catch((error) => {
  console.error("❌ Erreur fatale:", error);
  process.exit(1);
});