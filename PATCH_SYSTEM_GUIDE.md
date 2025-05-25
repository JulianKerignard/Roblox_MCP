# 🔧 Guide du Système de Patch MCP-Roblox

## 🎯 Vue d'ensemble

Le système de patch permet à Claude de modifier **seulement les parties nécessaires** des scripts au lieu de réécrire tout le fichier. C'est plus rapide, plus sûr et plus précis !

## 🛠️ Nouveaux outils disponibles

### 1. `patch_script` - Modification ciblée
Applique une modification précise sur un script.

**Paramètres :**
- `scriptPath` : Chemin vers le script (ex: "src/server/main.server.luau")
- `operation` : Type d'opération ("insert", "replace", "delete")
- `lineStart` : Numéro de ligne de début (1-indexé)
- `lineEnd` : Numéro de ligne de fin (optionnel, pour replace/delete)
- `newContent` : Nouveau contenu (pour insert/replace)
- `description` : Description du changement

### 2. `preview_patch` - Prévisualisation
Montre le résultat d'un patch **sans l'appliquer**.

**Paramètres :**
- `scriptPath` : Chemin vers le script
- `operation` : Type d'opération
- `lineStart` : Numéro de ligne de début
- `lineEnd` : Numéro de ligne de fin (optionnel)
- `newContent` : Nouveau contenu (optionnel)

## 📝 Types d'opérations

### ➕ INSERT - Ajouter du code
Insère du nouveau contenu à une ligne spécifique.

**Exemple :**
```
Ajoute un print de debug à la ligne 10 du script serveur
```

### 🔄 REPLACE - Remplacer du code
Remplace une ou plusieurs lignes par du nouveau contenu.

**Exemple :**
```
Change la ligne 157 pour augmenter l'intervalle de spawn à 5 secondes
```

### ❌ DELETE - Supprimer du code
Supprime une ou plusieurs lignes.

**Exemple :**
```
Supprime les lignes 85-99 qui gèrent les particules obsolètes
```

## 🎮 Exemples d'utilisation

### Modification simple d'une ligne
```
Claude, change juste l'intervalle de spawn des gemmes de 3 à 1 seconde dans le script serveur
```
**Résultat :** Claude utilise `patch_script` pour modifier uniquement la ligne concernée.

### Ajout de fonctionnalité
```
Claude, ajoute un print de debug après la ligne 50 qui affiche le nombre de gemmes actives
```
**Résultat :** Claude insère le code à la ligne 51 sans toucher au reste.

### Suppression de code obsolète
```
Claude, supprime la fonction findParticleEmitter qui n'est plus utilisée (lignes 86-99)
```
**Résultat :** Claude supprime précisément ces lignes.

## 🔍 Preview avant application

### Prévisualiser un changement
```
Claude, montre-moi à quoi ressemblerait le script si je change l'intervalle de spawn, mais ne l'applique pas encore
```
**Résultat :** Claude utilise `preview_patch` pour montrer le résultat sans modifier le fichier.

## 💡 Avantages du système de patch

### ✅ **Performance**
- **Plus rapide** : Pas besoin de réécrire 200+ lignes
- **Moins de contexte** utilisé par Claude
- **Modifications instantanées**

### ✅ **Sécurité**
- **Risque réduit** de casser le code existant
- **Changements précis** et contrôlés
- **Prévisualisation** disponible

### ✅ **Clarté**
- **Voit exactement** ce qui change
- **Historique** des modifications
- **Descriptions** automatiques

### ✅ **Collaboration**
- **Git diffs** plus propres
- **Review** de code facilitée
- **Debugging** simplifié

## 🎯 Cas d'usage typiques

### 🔧 **Ajustements de configuration**
```
Claude, change juste la vitesse de rotation des gemmes
Claude, modifie seulement la couleur des particules
Claude, augmente le nombre maximum de gemmes actives
```

### 🐛 **Corrections de bugs**
```
Claude, corrige juste cette condition if à la ligne 42
Claude, ajoute une vérification nil avant cette ligne
Claude, supprime ce print de debug qui traîne
```

### ➕ **Ajouts de fonctionnalités**
```
Claude, ajoute un système de combo après la fonction de collecte
Claude, insère une vérification de permissions avant cette action
Claude, ajoute des logs pour cette fonction
```

## 🚀 Migration depuis write_script

### Avant (write_script)
```lua
-- Claude réécrit TOUT le fichier de 200 lignes
-- pour changer juste l'intervalle de spawn
```

### Maintenant (patch_script)
```lua
-- Claude modifie UNIQUEMENT la ligne 157
-- Opération: replace
-- Ligne: 157
-- Nouveau contenu: "        wait(1) -- Spawn plus rapide"
```

## 📊 Statistiques de performance

### Projet exemple (178 lignes)
- **Avant :** Réécriture complète = 178 lignes transmises
- **Maintenant :** Patch ciblé = 1 ligne modifiée
- **Gain :** 99.4% de réduction !

### Gros projet (1000+ lignes)
- **Avant :** Problème de contexte, erreurs fréquentes
- **Maintenant :** Modifications précises, zéro problème

## 🎉 Conclusion

Le système de patch révolutionne l'édition de code avec Claude :
- **Plus rapide et plus sûr**
- **Idéal pour les gros projets**
- **Parfait pour l'open source**
- **Feature unique** dans l'écosystème MCP !

**Votre MCP-Roblox est maintenant à la pointe de la technologie !** 🚀