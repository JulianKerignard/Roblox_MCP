@echo off
echo =========================================
echo     SCRIPT DE NETTOYAGE MCP-ROBLOX
echo =========================================
echo.
echo Ce script va supprimer les fichiers de documentation
echo en trop et garder seulement les essentiels.
echo.
echo FICHIERS QUI SERONT SUPPRIMES :
echo - Guides de documentation multiples (.md)
echo - Fichiers de configuration de test
echo - Scripts de test temporaires
echo.
echo FICHIERS QUI SERONT CONSERVES :
echo - src/ (vos scripts Luau)
echo - mcp-server/ (serveur MCP)
echo - dist/ (build)
echo - package.json, default.project.json
echo - start-mcp.bat
echo - README.md et CLAUDE.md (principaux)
echo.
pause
echo.
echo Debut du nettoyage...

REM Creer un dossier de sauvegarde
if not exist "BACKUP_DOCS" mkdir BACKUP_DOCS

REM Deplacer les fichiers de documentation en trop vers BACKUP
echo Sauvegarde des docs supplementaires...
if exist "CLAUDE_CONNECTION.md" move "CLAUDE_CONNECTION.md" "BACKUP_DOCS\"
if exist "FIX_CLAUDE_CONFIG.md" move "FIX_CLAUDE_CONFIG.md" "BACKUP_DOCS\"
if exist "INSTALLATION.md" move "INSTALLATION.md" "BACKUP_DOCS\"
if exist "QUICK_TEST.md" move "QUICK_TEST.md" "BACKUP_DOCS\"
if exist "ROJO_STUDIO_CONNECTION.md" move "ROJO_STUDIO_CONNECTION.md" "BACKUP_DOCS\"
if exist "SOLUTION_DEFINITIVE.md" move "SOLUTION_DEFINITIVE.md" "BACKUP_DOCS\"

REM Supprimer les fichiers de configuration de test
echo Suppression des fichiers de test...
if exist "clean.project.json" del "clean.project.json"
if exist "minimal.project.json" del "minimal.project.json"
if exist "test-script.server.luau" del "test-script.server.luau"

echo.
echo =========================================
echo           NETTOYAGE TERMINE !
echo =========================================
echo.
echo STRUCTURE FINALE :
dir /b
echo.
echo Les docs ont ete sauvegardees dans BACKUP_DOCS/
echo Vous pouvez supprimer ce dossier si vous n'en avez plus besoin.
echo.
pause