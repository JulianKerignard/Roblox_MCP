# 🎮 Guide Simple pour Débuter avec MCP-Roblox

## 🚀 Comment utiliser Claude pour corriger vos erreurs Roblox

### 1️⃣ **Quand vous avez une erreur, copiez-la simplement !**

Au lieu de dire :
> "J'ai une erreur dans mon jeu"

Dites :
> "J'ai cette erreur : Players.jujupenvins5756.PlayerScripts.Client.main:330: Expected <eof>, got 'end'"

### 2️⃣ **Claude analysera automatiquement**

Avec le nouvel outil `analyze_error`, Claude va :
- ✅ Comprendre exactement quel est le problème
- ✅ Vous guider pas à pas pour le corriger
- ✅ Éviter de casser votre code en faisant trop de changements

### 3️⃣ **Les erreurs courantes et leurs solutions**

| Erreur | Ce que ça veut dire | Solution automatique |
|--------|---------------------|---------------------|
| `Expected <eof>, got 'end'` | Un 'end' en trop | Claude va le retirer |
| `'end' expected` | Il manque un 'end' | Claude va l'ajouter |
| `attempt to index nil` | Variable non définie | Claude va la vérifier |
| `unexpected symbol near '}'` | Erreur dans une table | Claude va corriger |

### 4️⃣ **Commandes magiques pour forcer Claude à bien faire**

Si Claude fait n'importe quoi, utilisez ces phrases :

**Pour une erreur :**
```
analyze_error avec cette erreur : [votre erreur]
```

**Si Claude modifie trop de choses :**
```
STOP ! Utilise rollback_history pour annuler, puis corrige SEULEMENT l'erreur
```

**Pour voir ce qu'il a fait :**
```
Montre-moi l'historique des modifications avec rollback_history
```

### 5️⃣ **Règles d'or**

1. **Une erreur = Une correction**
   - Ne laissez pas Claude "améliorer" votre code
   - Il doit juste corriger l'erreur

2. **Toujours donner l'erreur complète**
   - Incluez le numéro de ligne
   - Copiez le message exact

3. **Si ça empire, annulez !**
   ```
   rollback_script pour revenir en arrière
   ```

### 6️⃣ **Exemple concret**

**Vous :** 
```
J'ai cette erreur : Expected <eof>, got 'end' at line 330
analyze_error pour comprendre
```

**Claude va automatiquement :**
1. Analyser l'erreur
2. Lire votre fichier
3. Compter les blocs
4. Retirer JUSTE le 'end' en trop
5. Valider que c'est corrigé

### 7️⃣ **Si Claude fait des bêtises**

Signes que Claude fait n'importe quoi :
- ❌ Il fait plus de 3 patches d'affilée
- ❌ Il crée de nouveaux fichiers
- ❌ Il "réorganise" votre code
- ❌ Les erreurs empirent

**Solution :**
```
ARRÊTE ! Tu casses tout. 
Utilise rollback_history, puis analyze_error pour recommencer proprement
```

## 💡 Astuce finale

Le nouveau système est conçu pour que vous n'ayez qu'à :
1. Copier votre erreur
2. Dire "analyze_error"
3. Laisser Claude suivre les directives automatiques

Plus besoin d'être expert ! 🎉