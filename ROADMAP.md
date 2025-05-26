# 🗺️ Roadmap MCP-Roblox

## Phase 1 : Refactoring (Priorité HAUTE)
- [ ] Découper `index.ts` en modules :
  - `src/managers/patch-manager.ts`
  - `src/managers/rollback-manager.ts`
  - `src/managers/validation-manager.ts`
  - `src/managers/file-manager.ts`
  - `src/managers/token-manager.ts`
- [ ] Créer des interfaces claires pour chaque module
- [ ] Maintenir la rétrocompatibilité

## Phase 2 : Tests (Priorité MOYENNE)
- [ ] Configurer Jest ou Vitest
- [ ] Tests unitaires pour :
  - Détection d'anti-patterns
  - Validation de syntaxe
  - Analyse d'erreurs
  - Génération de templates
- [ ] Tests d'intégration pour les workflows complets
- [ ] Coverage minimum : 80%

## Phase 3 : CI/CD (Priorité MOYENNE)
- [ ] GitHub Actions workflow :
  ```yaml
  - npm run lint
  - npm run typecheck
  - npm run build
  - npm run test
  ```
- [ ] Badge de build status
- [ ] Protection de la branche main
- [ ] Auto-release sur tags

## Phase 4 : Documentation (Priorité HAUTE)
- [ ] README complet avec GIFs
- [ ] Documentation API complète
- [ ] Tutoriels vidéo
- [ ] Site documentation (Docusaurus ?)

## Phase 5 : Optimisations (Priorité BASSE)
- [ ] Ajuster `contextWindowMax` dynamiquement
- [ ] Cache plus intelligent
- [ ] Compression des historiques
- [ ] Métriques de performance

## Phase 6 : Features avancées
- [ ] Support multi-projets
- [ ] Intégration avec Roblox Studio directe
- [ ] Marketplace de templates
- [ ] Mode collaboratif

## Métriques de succès
- ✅ < 5% d'erreurs de syntaxe après patch
- ✅ < 2s pour analyser une erreur
- ✅ 90% des erreurs courantes reconnues
- ✅ Adoption par 100+ développeurs Roblox