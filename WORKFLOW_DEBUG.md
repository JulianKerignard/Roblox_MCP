# Guide de Debug pour Claude Desktop

## Comprendre les outils MCP

### 1. get_project_structure
**Ce qu'il fait :**
- Liste SEULEMENT les noms de fichiers et leurs tailles
- NE MONTRE PAS le contenu des fichiers

**Exemple de sortie :**
```
💻 CLIENT (1)
  - src/client/main.client.luau (37025 chars)
```

**⚠️ ATTENTION :** Le nombre entre parenthèses est la TAILLE, pas le contenu !

### 2. read_script
**Ce qu'il fait :**
- Lit le CONTENU COMPLET d'un fichier
- Affiche avec numéros de ligne

**Utilisation correcte :**
```
read_script("src/client/main.client.luau")
```

### 3. search_in_scripts
**Ce qu'il fait :**
- Cherche un pattern dans tous les fichiers
- Retourne la LISTE des fichiers contenant le pattern
- NE MONTRE PAS les lignes exactes

## Workflow correct pour une erreur

### Exemple : "Error at line 330"

❌ **MAUVAIS :**
1. get_project_structure
2. "Je vois que le fichier fait 37025 chars"
3. patch_script directement

✅ **BON :**
1. get_project_structure → Pour vérifier que le fichier existe
2. read_script("src/client/main.client.luau") → Pour VOIR le code
3. Analyser le contexte autour de la ligne 330
4. syntax_helper pour valider
5. preview_patch
6. patch_script

## Règles d'or

1. **TOUJOURS lire le fichier avant de le modifier**
2. **Ne jamais assumer le contenu basé sur la taille**
3. **Utiliser syntax_helper avant de patcher**
4. **Preview avant d'appliquer**

## Commandes utiles pour forcer le bon comportement

Quand vous donnez une erreur à Claude :

```
"J'ai cette erreur à la ligne X. 
Utilise d'abord read_script pour voir le fichier complet, 
puis syntax_helper pour analyser avant de corriger."
```