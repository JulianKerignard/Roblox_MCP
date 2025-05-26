/**
 * Outil syntax_helper pour Claude Desktop
 * Permet de vérifier la syntaxe directement depuis l'interface
 */

import { syntaxEnforcer } from '../validation/syntax-enforcer.js';
import fs from 'fs-extra';
import path from 'path';

interface SyntaxHelperRequest {
  action: 'check' | 'count_blocks' | 'find_unclosed' | 'preview' | 'show_rules';
  scriptPath?: string;
  content?: string;
}

export async function syntaxHelperTool(args: SyntaxHelperRequest, projectRoot: string): Promise<string> {
  const { action, scriptPath, content } = args;

  switch (action) {
    case 'show_rules':
      return showSyntaxRules();
      
    case 'count_blocks':
      if (!scriptPath) {
        return '❌ Erreur: scriptPath requis pour count_blocks';
      }
      return await countBlocks(scriptPath, projectRoot);
      
    case 'find_unclosed':
      if (!scriptPath) {
        return '❌ Erreur: scriptPath requis pour find_unclosed';
      }
      return await findUnclosedBlocks(scriptPath, projectRoot);
      
    case 'check':
      if (!scriptPath) {
        return '❌ Erreur: scriptPath requis pour check';
      }
      return await checkSyntax(scriptPath, projectRoot);
      
    case 'preview':
      if (!content) {
        return '❌ Erreur: content requis pour preview';
      }
      return previewSyntax(content);
      
    default:
      return '❌ Action non reconnue. Utilisez: check, count_blocks, find_unclosed, preview, show_rules';
  }
}

function showSyntaxRules(): string {
  return `
📚 RÈGLES DE SYNTAXE LUAU
========================

1️⃣ **Structures qui nécessitent 'end':**
   • function name() ... end
   • if condition then ... end
   • for i = 1, 10 do ... end
   • while condition do ... end
   • do ... end

2️⃣ **Structures spéciales:**
   • repeat ... until condition (PAS de 'end')
   • local t = { ... } (accolades, pas 'end')

3️⃣ **Erreurs fréquentes:**
   \`\`\`luau
   -- ❌ ERREUR: 'end' manquant
   function test()
       if true then
           print("oops")
       end
   -- Manque 'end' ici!
   
   -- ✅ CORRECT:
   function test()
       if true then
           print("ok")
       end
   end -- N'oubliez pas!
   \`\`\`

4️⃣ **Commandes de vérification:**
   • syntax_helper action:"count_blocks" → Compte blocs et 'end'
   • syntax_helper action:"find_unclosed" → Trouve blocs non fermés
   • syntax_helper action:"check" → Validation complète

💡 ASTUCE: Toujours vérifier AVANT d'appliquer des modifications!
  `;
}

async function countBlocks(scriptPath: string, projectRoot: string): Promise<string> {
  try {
    const fullPath = path.isAbsolute(scriptPath) 
      ? scriptPath 
      : path.join(projectRoot, scriptPath.replace(/\\/g, '/'));
      
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    let functions = 0;
    let ends = 0;
    let ifs = 0;
    let fors = 0;
    let whiles = 0;
    let dos = 0;
    let repeats = 0;
    let untils = 0;
    let braces = { open: 0, close: 0 };
    let parens = { open: 0, close: 0 };
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('--')) continue;
      
      // Compter les structures
      if (/\bfunction\s*[(\w]/.test(line) && !/\bend\b/.test(line)) functions++;
      if (/\bend\b/.test(line)) ends++;
      if (/\bif\b.*\bthen\b/.test(line) && !/\bend\b/.test(line)) ifs++;
      if (/\bfor\b.*\bdo\b/.test(line)) fors++;
      if (/\bwhile\b.*\bdo\b/.test(line)) whiles++;
      if (/\bdo\b\s*$/.test(line) && !/\bwhile\b/.test(line) && !/\bfor\b/.test(line)) dos++;
      if (/\brepeat\b/.test(line)) repeats++;
      if (/\buntil\b/.test(line)) untils++;
      
      // Compter les symboles
      for (const char of line) {
        if (char === '{') braces.open++;
        if (char === '}') braces.close++;
        if (char === '(') parens.open++;
        if (char === ')') parens.close++;
      }
    }
    
    const expectedEnds = functions + ifs + fors + whiles + dos;
    const diff = expectedEnds - ends;
    
    let result = `## 📊 **Analyse des blocs: ${scriptPath}**\n\n`;
    result += `- **Functions:** ${functions}\n`;
    result += `- **End statements:** ${ends}\n`;
    result += `- **If blocks:** ${ifs}\n`;
    result += `- **For loops:** ${fors}\n`;
    result += `- **While loops:** ${whiles}\n`;
    result += `- **Repeat/until:** ${repeats}/${untils}\n`;
    result += `- **Braces:** ${braces.open} { et ${braces.close} }\n\n`;
    
    if (diff === 0 && braces.open === braces.close && parens.open === parens.close) {
      result += `✅ **Syntaxe équilibrée!**`;
    } else {
      if (diff > 0) {
        result += `⚠️ **Attention:** Attendu ${expectedEnds} 'end' mais trouvé ${ends}\n`;
        result += `❌ **Il manque ${diff} 'end'!**`;
      } else if (diff < 0) {
        result += `❌ **Il y a ${-diff} 'end' en trop!**`;
      }
      
      if (braces.open !== braces.close) {
        result += `\n❌ **Accolades déséquilibrées!**`;
      }
      if (parens.open !== parens.close) {
        result += `\n❌ **Parenthèses déséquilibrées!**`;
      }
    }
    
    return result;
    
  } catch (error) {
    return `❌ Erreur lors de la lecture du fichier: ${error}`;
  }
}

async function findUnclosedBlocks(scriptPath: string, projectRoot: string): Promise<string> {
  try {
    const fullPath = path.isAbsolute(scriptPath) 
      ? scriptPath 
      : path.join(projectRoot, scriptPath.replace(/\\/g, '/'));
      
    const content = await fs.readFile(fullPath, 'utf-8');
    const validation = syntaxEnforcer.validateBeforeModification('', content, 'check');
    
    let result = `## 🔍 **Recherche des blocs non fermés: ${scriptPath}**\n\n`;
    
    if (validation.blockAnalysis.unclosedBlocks.length === 0) {
      result += `✅ **Tous les blocs sont correctement fermés!**`;
    } else {
      result += `❌ **${validation.blockAnalysis.unclosedBlocks.length} bloc(s) non fermé(s):**\n\n`;
      
      for (const block of validation.blockAnalysis.unclosedBlocks) {
        result += `- **${block.type}** à la ligne ${block.line}\n`;
      }
      
      result += `\n💡 **Solution:** Ajoutez ${validation.blockAnalysis.unclosedBlocks.length} 'end' pour fermer ces blocs.`;
    }
    
    return result;
    
  } catch (error) {
    return `❌ Erreur: ${error}`;
  }
}

async function checkSyntax(scriptPath: string, projectRoot: string): Promise<string> {
  try {
    const fullPath = path.isAbsolute(scriptPath) 
      ? scriptPath 
      : path.join(projectRoot, scriptPath.replace(/\\/g, '/'));
      
    const content = await fs.readFile(fullPath, 'utf-8');
    const validation = syntaxEnforcer.validateBeforeModification('', content, 'check');
    
    let result = `## 🔍 **Vérification syntaxique: ${scriptPath}**\n\n`;
    
    if (validation.isValid) {
      result += `✅ **SYNTAXE VALIDE!**\n\n`;
      result += `Tous les blocs sont correctement fermés.`;
    } else {
      result += `❌ **SYNTAXE INVALIDE!**\n\n`;
      
      for (const error of validation.errors) {
        result += `- ${error}\n`;
      }
      
      if (validation.suggestions.length > 0) {
        result += `\n💡 **Suggestions:**\n`;
        for (const suggestion of validation.suggestions) {
          result += `- ${suggestion}\n`;
        }
      }
    }
    
    if (validation.warnings.length > 0) {
      result += `\n⚠️ **Avertissements:**\n`;
      for (const warning of validation.warnings) {
        result += `- ${warning}\n`;
      }
    }
    
    return result;
    
  } catch (error) {
    return `❌ Erreur: ${error}`;
  }
}

function previewSyntax(content: string): string {
  const validation = syntaxEnforcer.validateBeforeModification('', content, 'preview');
  
  let result = `## 🔍 **Vérification du code**\n\n`;
  
  if (validation.isValid) {
    result += `✅ **Syntaxe valide!**`;
  } else {
    result += `❌ **Problèmes détectés:**\n\n`;
    for (const error of validation.errors) {
      result += `- ${error}\n`;
    }
  }
  
  return result;
}