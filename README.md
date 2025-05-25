# MCP-Roblox 🎮

A Model Context Protocol (MCP) server that enables Claude to interact with Roblox projects using Rojo for modern Luau development.

## Features ✨

- **Real-time file synchronization** between Claude and Roblox Studio via Rojo
- **Smart file watching** with automatic project structure updates
- **Anti-pattern detection** for common Roblox coding mistakes
- **Built-in Roblox API documentation** for quick reference
- **Template system** for common patterns (events, services, UI)
- **Patch-based editing** with preview and rollback capabilities
- **Token optimization** through semantic caching

## Prerequisites 📋

- Node.js (v14 or higher)
- [Rojo](https://rojo.space/) (v7.x)
- Roblox Studio
- Claude Desktop or Claude CLI

## Installation 🚀

1. Clone the repository:
```bash
git clone https://github.com/yourusername/MCP-Roblox.git
cd MCP-Roblox
```

2. Install dependencies:
```bash
npm install
```

3. Build the MCP server:
```bash
npm run build
```

## Configuration ⚙️

### For Claude Desktop

Add to your Claude Desktop configuration (`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "roblox-rojo": {
      "command": "node",
      "args": ["C:\\path\\to\\MCP-Roblox\\dist\\index.js"]
    }
  }
}
```

Or use the provided batch file:

```json
{
  "mcpServers": {
    "roblox-rojo": {
      "command": "C:\\path\\to\\MCP-Roblox\\start-mcp.bat"
    }
  }
}
```

### For Unix/Mac systems

```json
{
  "mcpServers": {
    "roblox-rojo": {
      "command": "node",
      "args": ["/path/to/MCP-Roblox/dist/index.js"]
    }
  }
}
```

## Usage 🎯

### Starting the Development Environment

1. Start the MCP server:
```bash
npm start
```

2. In another terminal, start Rojo:
```bash
npm run sync
```

3. In Roblox Studio:
   - Open the Rojo plugin
   - Connect to `localhost:34872`

### Available Commands

```bash
# Development
npm run dev         # Start MCP server in development mode
npm run sync        # Start Rojo sync server
npm run build       # Build TypeScript files

# Rojo
npm run rojo:build  # Build .rbxlx file
npm run rojo:init   # Initialize new Rojo project

# Code Quality
npm run typecheck   # Run TypeScript type checking
npm run lint        # Run ESLint
```

## Project Structure 📁

```
MCP-Roblox/
├── src/
│   ├── client/         # LocalScripts (.client.luau)
│   ├── server/         # ServerScripts (.server.luau)
│   └── shared/         # ModuleScripts (.luau)
├── mcp-server/         # MCP server implementation
│   ├── index.ts        # Main server with tools
│   ├── antipatterns.ts # Roblox anti-pattern detection
│   ├── roblox-apis.ts  # API documentation cache
│   └── templates.ts    # Code templates
├── default.project.json # Rojo configuration
└── package.json        # Node.js configuration
```

## MCP Tools Available 🛠️

### File Operations
- `get_project_structure` - View complete project layout
- `read_script` - Read Luau script content
- `write_script` - Write/modify scripts
- `create_script` - Create new scripts with proper conventions
- `delete_script` - Remove scripts
- `search_in_scripts` - Full-text search

### Advanced Editing
- `patch_script` - Line-based editing with operations
- `preview_patch` - Preview changes before applying
- `rollback_script` - Revert to previous versions
- `rollback_history` - View modification history

### Code Quality
- `check_antipatterns` - Detect common Roblox mistakes
- `roblox_api` - View Roblox API documentation
- `search_roblox_docs` - Search online documentation

### Templates
- `list_templates` - Show available templates
- `use_template` - Generate code from templates

## Example Workflow 💡

1. Ask Claude to create a new shop system:
```
"Create a shop system with a GUI that allows players to buy items with coins"
```

2. Claude will:
   - Create necessary scripts in appropriate directories
   - Set up RemoteEvents for client-server communication
   - Implement secure server-side validation
   - Create a clean UI with proper event handling
   - Check for anti-patterns automatically

3. Changes sync to Studio in real-time via Rojo

## Anti-Pattern Detection 🚨

The server automatically detects:
- Performance issues (infinite loops, excessive instance creation)
- Memory leaks (undisconnected events, uncleaned instances)
- Deprecated APIs (wait() → task.wait())
- Security vulnerabilities (unvalidated RemoteEvents)
- Bad practices (global variables, wait() in RenderStepped)

## Templates Available 📝

### Event Templates
- Player connection handling
- Input management (keyboard, mouse, touch)
- GUI interaction patterns

### Service Templates
- Service initialization with proper patterns
- Singleton implementation
- Module structure

### Data Templates
- DataStore implementations
- Leaderstats setup
- Player data management

### UI Templates
- Shop interfaces
- Inventory systems
- Settings menus

## Contributing 🤝

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting 🔧

### MCP server not connecting
- Ensure Claude Desktop is fully restarted after configuration
- Check that the path in `claude_desktop_config.json` is absolute
- Verify Node.js is in your system PATH

### Rojo sync issues
- Ensure Rojo is running (`npm run sync`)
- Check Studio is connected to the correct port (34872)
- Verify HTTP requests are enabled in Studio settings

### Script changes not reflecting
- Check file naming conventions (.client.luau, .server.luau)
- Ensure files are in the correct directories
- Restart Rojo if structure changes aren't detected

### Common Issues
- **"Cannot find module"** - Run `npm run build` before starting
- **"Port already in use"** - Kill existing Rojo process or use different port
- **"File not found"** - Ensure working directory is project root

## Performance Tips ⚡

- Use the patch tool for small edits instead of rewriting entire files
- Leverage templates for common patterns
- Let anti-pattern detection guide best practices
- Use rollback feature for safe experimentation

## Security Considerations 🔐

- Never expose API keys or secrets in scripts
- Always validate RemoteEvent/RemoteFunction inputs
- Use proper permission checks on server
- Follow Roblox security best practices

## License 📄

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments 🙏

- [Rojo](https://rojo.space/) for file system → Studio synchronization
- [Anthropic](https://anthropic.com/) for Claude and MCP protocol
- The Roblox developer community

---

Made with ❤️ for the Roblox development community