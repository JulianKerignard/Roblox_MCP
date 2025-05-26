// Import the original validateGameTool function
export { default as validateGameTool } from './validate-game.js';

// Wrap it with the expected interface
export const validateGameToolWrapper = {
  execute: async (projectPath?: string) => {
    const { default: validateGame } = await import('./validate-game.js');
    return validateGame(projectPath);
  }
};