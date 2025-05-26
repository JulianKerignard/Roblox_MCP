# 🛤️ Guide des Chemins pour Claude

## ⚠️ RÈGLE CRITIQUE : TOUJOURS UTILISER DES FORWARD SLASHES (/)

### ❌ INCORRECT (Ne JAMAIS faire) :
```
src\server\main.server.luau          # Backslashes Windows
.\\src\\server\\main.server.luau     # Double backslashes
C:\Users\project\src\server\main.luau # Chemin absolu Windows
```

### ✅ CORRECT (TOUJOURS faire) :
```
src/server/main.server.luau          # Forward slashes
src/client/UI.client.luau            # Chemin relatif
src/shared/Utils.luau                # Simple et clair
```

## 📋 Exemples de Commandes MCP

### read_script
```
❌ read_script("src\client\main.client.luau")
✅ read_script("src/client/main.client.luau")
```

### patch_script
```
❌ scriptPath: "src\\server\\main.server.luau"
✅ scriptPath: "src/server/main.server.luau"
```

### search_in_scripts
```
❌ Chercher dans "src\shared\*"
✅ Chercher dans tous les fichiers avec query: "pattern"
```

## 🎯 Patterns à Retenir

1. **Structure Rojo standard** :
   ```
   src/
   ├── client/     # Scripts client (.client.luau)
   ├── server/     # Scripts serveur (.server.luau)
   └── shared/     # Modules partagés (.luau)
   ```

2. **Extensions valides** :
   - `.luau` (préféré)
   - `.lua` (legacy)
   - `.server.luau` (ServerScript)
   - `.client.luau` (LocalScript)

3. **Jamais de chemins absolus** :
   - ❌ `/mnt/d/AIStage/MCP-Roblox/src/...`
   - ❌ `D:\AIStage\MCP-Roblox\src\...`
   - ✅ `src/...`

## 🔍 Debug : Si Claude voit une erreur

### Erreur typique :
```
"Je vois que le chemin utilise des backslashes..."
```

### Solution :
1. NE PAS mentionner les backslashes
2. Utiliser directement le chemin avec forward slashes
3. Le système convertira automatiquement

## 💡 Astuce Mnémotechnique

**"Forward Slash = Forward Progress"**
- Forward slash (/) = Avancer = Correct ✅
- Backslash (\\) = Reculer = Erreur ❌

## 🤖 Pour les Développeurs

Le serveur MCP inclut maintenant :
- `PathNormalizer` : Normalise automatiquement tous les chemins
- `MCPPathMiddleware` : Intercepte et corrige les chemins
- `fixClaudePath()` : Corrige les erreurs courantes

Donc même si Claude se trompe, le système corrigera automatiquement ! 🎉