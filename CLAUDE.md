# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔴 MANDATORY WORKFLOW - ALWAYS SEARCH FIRST!

### ⚠️ CRITICAL RULE FOR CLAUDE ⚠️
**YOU MUST SEARCH BEFORE WRITING ANY CODE!**

**BEFORE making ANY code changes, you MUST:**

1. **Use `search_in_scripts`** to find relevant code patterns
2. **Use `read_script`** to understand the full context
3. **Use `get_project_structure`** to see all files

**NEVER** write or modify code without searching first!

### Example Workflow:
```
User: "Add a jump boost to the player"

❌ WRONG: Immediately write code
✅ CORRECT: 
1. search_in_scripts("JumpPower")
2. search_in_scripts("Humanoid") 
3. read_script("src/server/main.server.luau")
4. THEN write informed code
```

### 🚨 SEARCH IS MANDATORY - NO EXCEPTIONS! 🚨
If you write code without searching first, you are violating the core principle of this MCP server. The search tools exist to prevent errors and ensure code quality.

## 🛤️ PATH RULES - ALWAYS USE FORWARD SLASHES

### ⚠️ CRITICAL: File paths MUST use forward slashes (/)
**NEVER use backslashes (\\) in file paths!**

❌ **WRONG:**
```
src\client\main.client.luau
src\\server\\main.server.luau
```

✅ **CORRECT:**
```
src/client/main.client.luau
src/server/main.server.luau
```

**The system will auto-correct paths, but using forward slashes prevents errors.**

## 🛠️ PATCH AND EDIT BEST PRACTICES

### 🛑 SYSTÈME DE VALIDATION SYNTAXIQUE OBLIGATOIRE 🛑
**❌ TOUTES LES MODIFICATIONS SONT AUTOMATIQUEMENT BLOQUÉES SI LA SYNTAXE EST INVALIDE! ❌**

### 🚨 RÈGLES CRITIQUES - AUCUNE EXCEPTION! 🚨

#### 1. **AVANT CHAQUE MODIFICATION, VOUS DEVEZ:**
   - ✅ Utiliser `read_script()` pour lire le fichier COMPLET
   - ✅ Compter TOUS les blocs ouverts (`function`, `if`, `for`, `while`, `do`)
   - ✅ Compter TOUS les `end` correspondants
   - ✅ Utiliser `preview_patch` pour vérifier votre modification
   - ✅ Vérifier que chaque bloc ouvert a son `end`

#### 2. **CE QUI BLOQUERA AUTOMATIQUEMENT VOS MODIFICATIONS:**
   - ❌ **Blocs non fermés** - Il manque un ou plusieurs `end`
   - ❌ **`end` en trop** - Plus de `end` que de blocs ouverts
   - ❌ **Parenthèses déséquilibrées** - `(` sans `)` correspondant
   - ❌ **Accolades déséquilibrées** - `{` sans `}` correspondant
   - ❌ **Crochets déséquilibrés** - `[` sans `]` correspondant

#### 3. **ERREUR LA PLUS FRÉQUENTE DE CLAUDE:**
   ```luau
   -- ❌ ERREUR TYPIQUE DE CLAUDE:
   function doSomething()
       if condition then
           -- code
       end
   -- OUBLI DU 'end' DE LA FONCTION!
   
   -- ✅ VERSION CORRECTE:
   function doSomething()
       if condition then
           -- code
       end
   end  -- N'OUBLIEZ JAMAIS CE 'end'!
   ```

#### 4. **VALIDATION EN TEMPS RÉEL:**
   - Le système compte automatiquement les blocs et les `end`
   - Si le compte ne correspond pas, la modification est BLOQUÉE
   - Un message d'erreur détaillé vous indiquera:
     - Combien de `end` sont attendus
     - Combien de `end` ont été trouvés
     - Quels blocs ne sont pas fermés et à quelle ligne

### 🚫 MODIFICATIONS QUI SERONT REJETÉES:

### Common Luau Syntax Rules:
```luau
-- Every opening needs a closing:
function name()      -- needs 'end'
if condition then    -- needs 'end'
for i = 1, 10 do    -- needs 'end'
while true do       -- needs 'end'
repeat             -- needs 'until condition'

-- Tables use braces:
local table = {     -- needs '}'
    key = value,    -- comma between items
    key2 = value2   -- no comma on last item
}                   -- closing brace

-- Functions in tables:
local module = {
    MyFunction = function()  -- needs 'end' AND comma
        -- code
    end,                    -- comma after function
    
    AnotherFunction = function()
        -- code
    end                     -- no comma on last item
}
```

### 🎚️ SYSTÈME DE HOOKS DE VALIDATION:
Le MCP utilise maintenant un système de hooks qui:
1. **Vérifie AUTOMATIQUEMENT** la syntaxe avant chaque modification
2. **BLOQUE** les modifications si des erreurs sont détectées
3. **SUGGÈRE** des corrections spécifiques
4. **FORMATE** automatiquement le code (espaces, virgules, etc.)
5. **DÉTECTE** les anti-patterns et patterns dangereux

### Patch Workflow Example:
```
User: "Add a new function to handle jumping"

✅ CORRECT:
1. read_script("src/server/main.server.luau")
2. Count existing functions and their 'end' statements
3. Find appropriate insertion point
4. preview_patch with complete function including 'end'
5. Apply patch
6. validate_game to check syntax
```

### 🚨 QUE FAIRE SI VOTRE MODIFICATION EST BLOQUÉE:

1. **Lisez attentivement les erreurs** - Elles indiquent exactement ce qui ne va pas
2. **Vérifiez vos blocs** - Comptez manuellement les `function`/`if`/`for` et leurs `end`
3. **Utilisez preview_patch** - Pour voir le résultat avant d'appliquer
4. **Corrigez et réessayez** - Le système vous guidera

### 📝 EXEMPLE D'ERREUR TYPIQUE:
```
❌ Validation échouée - Écriture bloquée

🚨 Erreurs critiques:
- Ligne 15: Bloc 'function' ouvert à la ligne 10 n'est pas fermé. Il manque 'end'
- Parenthèses non équilibrées: 3 '(' et 2 ')'

💡 Suggestions:
- Ajoutez 'end' après la ligne 15
- Vérifiez la parenthèse manquante à la ligne 12
```

### Auto-validation is enabled by default!
The MCP server will automatically validate your changes after write_script or patch_script.

## Project Overview

MCP-Roblox is a Model Context Protocol (MCP) server that enables Claude to interact with Roblox projects using **Rojo** for modern Luau development. The server provides real-time file watching, script management, and seamless integration between Claude and Roblox Studio.

## Architecture

- **Rojo-based workflow** with `default.project.json` configuration
- **TypeScript MCP server** with file watching capabilities using chokidar
- **Luau source files** organized in `src/` directory (client, server, shared)
- **Real-time synchronization** between filesystem and Studio via Rojo
- **Anti-pattern detection** for common Roblox coding mistakes
- **Built-in API documentation** for quick reference without leaving context
- **Template system** for common Roblox patterns (events, services, UI)
- **Rollback/history tracking** for safe experimentation
- **Token optimization** through semantic caching and smart diffs

## Key Components

- `mcp-server/index.ts`: Main MCP server with file watching and tools
- `mcp-server/antipatterns.ts`: Roblox-specific anti-pattern detection
- `mcp-server/roblox-apis.ts`: Built-in API documentation cache
- `src/`: Luau source files (client, server, shared modules)
- `default.project.json`: Rojo project configuration
- `isolated.project.json`: Isolated testing configuration (port 34875)
- `package.json`: Dependencies and npm scripts for both MCP and Rojo

## Development Commands

```bash
# MCP Server
npm run build       # Build TypeScript MCP server
npm run dev         # Development mode with hot reload
npm start           # Run production MCP server

# Rojo Workflow  
npm run sync        # Start Rojo serve (main development command)
npm run rojo:build  # Build to .rbxlx file
npm run rojo:init   # Initialize new Rojo project

# Quality
npm run typecheck   # TypeScript checking
npm run lint        # ESLint
```

## File Structure

```
src/
├── client/         # LocalScripts (.client.luau)
├── server/         # Scripts (.server.luau)  
└── shared/         # ModuleScripts (.luau)

mcp-server/         # TypeScript MCP server code
```

## MCP Tools Available

### Core File Operations
1. **get_project_structure**: Shows complete project layout with file types
2. **read_script**: Read content of specific Luau files
3. **write_script**: Modify existing scripts with real-time sync
4. **create_script**: Create new scripts with proper naming conventions
5. **delete_script**: Remove scripts from project
6. **search_in_scripts**: Full-text search across all project files

### Advanced Editing
7. **patch_script**: Line-based editing with insert/replace/delete operations
8. **preview_patch**: Preview patch changes before applying
9. **rollback_script**: Revert file to previous version
10. **rollback_history**: View modification history

### Code Quality & Documentation
11. **check_antipatterns**: Detect common Roblox/Luau coding mistakes
12. **roblox_api**: View built-in Roblox API documentation
13. **search_roblox_docs**: Search online Roblox documentation

### Templates & Configuration
14. **list_templates**: Show available code templates
15. **use_template**: Generate code from templates
16. **get_rojo_config**: Display current Rojo configuration

## Script Type Detection

Files are automatically categorized by naming convention:
- `.server.luau` → ServerScript
- `.client.luau` → LocalScript  
- `.luau` (in shared/) → ModuleScript
- Path-based detection for client/server folders

## Development Workflow

1. Start MCP server: `npm start`
2. Start Rojo: `npm run sync` 
3. Connect Studio to Rojo (`localhost:34872`)
4. Use Claude to edit scripts via MCP tools
5. Changes sync automatically to Studio

## File Watching

The MCP server uses chokidar to watch `src/**/*.{luau,lua}` and:
- Automatically updates project structure on file changes
- Maintains in-memory cache of all scripts
- Provides real-time updates to Claude about project state

## Claude Desktop Configuration

```json
{
  "mcpServers": {
    "roblox-rojo": {
      "command": "node",
      "args": ["/absolute/path/to/MCP-Roblox/dist/index.js"]
    }
  }
}
```

## Important Notes

- Always run commands from project root directory
- Rojo must be running for Studio synchronization
- MCP server provides file system interface, Rojo handles Studio sync
- Use `.luau` extension for all new scripts
- Follow Rojo naming conventions for proper script type detection

## 🔍 SEARCH PATTERNS FOR COMMON TASKS

When user asks about specific features, ALWAYS search first:

### Player-related:
- "change player speed" → `search_in_scripts("WalkSpeed|Humanoid")`
- "player data" → `search_in_scripts("leaderstats|PlayerAdded")`
- "player GUI" → `search_in_scripts("PlayerGui|ScreenGui")`

### Game mechanics:
- "shop system" → `search_in_scripts("shop|purchase|buy")`
- "inventory" → `search_in_scripts("inventory|items|backpack")`
- "currency/coins" → `search_in_scripts("coins|gems|currency|money")`

### Events:
- "when player joins" → `search_in_scripts("PlayerAdded")`
- "on touch" → `search_in_scripts("Touched|.Touched")`
- "remote events" → `search_in_scripts("RemoteEvent|FireClient|FireServer")`

### ALWAYS check existing code before creating new features!

## Anti-Pattern Detection

The MCP server automatically detects common Roblox coding mistakes:
- Performance issues (infinite loops without wait, excessive part creation)
- Memory leaks (undisconnected events, uncleaned instances)
- Deprecated APIs (wait(), spawn(), delay() → use task library)
- Security vulnerabilities (unvalidated RemoteEvents, loadstring usage)
- Bad practices (global variables, wait() in RenderStepped)

## Template Categories

Available templates for common patterns:
- **event**: Connection handling, input events
- **service**: Service initialization patterns
- **data**: DataStore, leaderstats implementations
- **ui**: GUI interaction patterns
- **utility**: Common helper modules
- **pattern**: Design patterns (singleton, observer)