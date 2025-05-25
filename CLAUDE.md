# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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