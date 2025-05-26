/**
 * Rules and reminders for Claude Desktop
 * These are injected into responses to guide Claude's behavior
 */

export const CLAUDE_RULES = {
  // Path rules - Most important!
  PATHS: {
    reminder: '⚠️ **Rappel:** Toujours utiliser des forward slashes (/) dans les chemins!',
    examples: {
      correct: 'src/server/main.server.luau',
      incorrect: 'src\\server\\main.server.luau'
    }
  },

  // Search before write
  SEARCH_FIRST: {
    reminder: '🔍 **Rappel:** Toujours chercher et lire avant de modifier!',
    workflow: [
      '1. search_in_scripts pour trouver',
      '2. read_script pour comprendre', 
      '3. PUIS modifier'
    ]
  },

  // Minimal changes
  MINIMAL_CHANGES: {
    reminder: '📏 **Rappel:** Faire le MINIMUM de changements nécessaires!',
    rules: [
      '- Une erreur = Une correction',
      '- Ne pas refactoriser',
      '- Ne pas "améliorer"'
    ]
  },

  // Error handling
  ERROR_HANDLING: {
    reminder: '🎯 **Pour les erreurs:** Utiliser analyze_error en premier!',
    workflow: [
      '1. analyze_error pour comprendre',
      '2. read_script pour voir le contexte',
      '3. UN SEUL patch ciblé'
    ]
  }
};

/**
 * Get contextual reminder based on tool being used
 */
export function getContextualReminder(toolName: string): string {
  const reminders: string[] = [];

  // Always remind about paths for file operations
  const fileTools = ['read_script', 'write_script', 'patch_script', 'create_script', 'search_in_scripts'];
  if (fileTools.includes(toolName)) {
    reminders.push(CLAUDE_RULES.PATHS.reminder);
  }

  // Remind about search for write operations
  const writeTools = ['write_script', 'patch_script', 'create_script'];
  if (writeTools.includes(toolName)) {
    reminders.push(CLAUDE_RULES.SEARCH_FIRST.reminder);
  }

  // Remind about minimal changes for patches
  if (toolName === 'patch_script') {
    reminders.push(CLAUDE_RULES.MINIMAL_CHANGES.reminder);
  }

  return reminders.length > 0 ? '\n\n' + reminders.join('\n') : '';
}

/**
 * Inject rules into tool descriptions
 */
export function enhanceToolDescription(tool: any): any {
  const enhanced = { ...tool };
  
  const fileTools = ['read_script', 'write_script', 'patch_script', 'create_script'];
  if (fileTools.includes(tool.name)) {
    enhanced.description += '\n⚠️ IMPORTANT: Utilisez des forward slashes (/) dans les chemins!';
  }

  if (tool.name === 'patch_script') {
    enhanced.description += '\n📏 Faire le MINIMUM de changements nécessaires.';
  }

  return enhanced;
}

/**
 * Check if Claude is making common mistakes
 */
export function detectCommonMistakes(toolHistory: string[]): string[] {
  const warnings: string[] = [];

  // Check for patches without reading first
  const lastFive = toolHistory.slice(-5);
  if (lastFive.includes('patch_script') && !lastFive.includes('read_script')) {
    warnings.push('⚠️ Vous avez patché sans lire le fichier d\'abord!');
  }

  // Check for multiple patches in a row
  const consecutivePatches = lastFive.filter(t => t === 'patch_script').length;
  if (consecutivePatches >= 3) {
    warnings.push('⚠️ Trop de patches consécutifs! Analysez le problème complètement.');
  }

  // Check for creating files instead of editing
  if (lastFive.includes('create_script') && lastFive.includes('error')) {
    warnings.push('⚠️ Ne créez pas de nouveaux fichiers pour corriger des erreurs!');
  }

  return warnings;
}

/**
 * Format error with path guidance
 */
export function formatErrorWithGuidance(error: Error, originalPath?: string): string {
  let message = error.message;

  // Add path guidance if relevant
  if (originalPath && originalPath.includes('\\')) {
    message += '\n\n🔧 **Correction automatique appliquée**';
    message += `\n❌ Reçu: "${originalPath}"`;
    message += `\n✅ Corrigé: "${originalPath.replace(/\\/g, '/')}"`;
    message += '\n\n💡 Utilisez toujours des forward slashes (/) à l\'avenir!';
  }

  return message;
}