# Features MCP pour gros projets

## Outils de contexte intelligent

### 1. Analyse par système
```typescript
get_system_files("combat")     // Seulement les fichiers de combat
get_system_files("ui")         // Seulement l'interface
get_system_files("data")       // Seulement la persistance
```

### 2. Résumés automatiques  
```typescript
get_project_summary()          // Vue d'ensemble 1 page
get_file_summary("script.lua") // Résumé d'un gros fichier
get_dependencies_summary()     // Carte des dépendances
```

### 3. Navigation intelligente
```typescript
find_related_files("combat")   // Fichiers liés au combat
get_modification_impact()      // Quels fichiers sont impactés
suggest_files_to_read()        // Suggestions contextuelles
```

### 4. Gestion de workspace
```typescript
create_workspace("ui-redesign") // Espace de travail focalisé
load_workspace("combat-system") // Charge un contexte spécifique
save_context_snapshot()        // Sauvegarde l'état actuel
```

## Architecture multi-MCP

### Projet divisé:
```
MyGame/
├── Core-MCP/          (Scripts de base)
├── Combat-MCP/        (Système de combat) 
├── UI-MCP/           (Interfaces)
├── Economy-MCP/      (Économie/Shop)
└── Data-MCP/         (Persistence)
```

### Configuration Claude adaptative:
```json
{
  "mcpServers": {
    "game-core": {"command": "...Core-MCP/start.bat"},
    "game-combat": {"command": "...Combat-MCP/start.bat"},
    "game-ui": {"command": "...UI-MCP/start.bat"}
  }
}
```

## Workflow optimisé

1. **Planification**: "Claude, analyse l'architecture globale"
2. **Focus**: Switcher vers le MCP du système à modifier  
3. **Développement**: Travail dans un contexte réduit
4. **Intégration**: Tests inter-systèmes
5. **Documentation**: Mise à jour des résumés