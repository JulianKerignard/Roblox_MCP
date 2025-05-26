/**
 * Common patch templates to help Claude avoid syntax errors
 */

export const patchTemplates = {
  // Template for adding a new function
  addFunction: `
local function {{functionName}}({{parameters}})
    {{content}}
end`,

  // Template for adding a method to a module
  addModuleMethod: `
    {{methodName}} = function({{parameters}})
        {{content}}
    end,`,

  // Template for adding an event handler
  addEventHandler: `
{{object}}.{{event}}:Connect(function({{parameters}})
    {{content}}
end)`,

  // Template for conditional block
  addConditional: `
if {{condition}} then
    {{content}}
end`,

  // Template for loop
  addLoop: `
for {{iterator}} = {{start}}, {{finish}} do
    {{content}}
end`,

  // Template for while loop
  addWhileLoop: `
while {{condition}} do
    {{content}}
    task.wait() -- Prevent infinite loop
end`,

  // Template for RemoteEvent handler
  addRemoteHandler: `
{{remoteName}}.OnServerEvent:Connect(function(player, {{parameters}})
    -- Validate player input
    if not player or not player.Parent then return end
    
    {{content}}
end)`,

  // Template for complete module structure
  createModule: `
local {{moduleName}} = {}

-- Private variables
local privateVar = nil

-- Private functions
local function privateFunction()
    
end

-- Public methods
function {{moduleName}}.Init()
    
end

function {{moduleName}}.Method({{parameters}})
    {{content}}
end

return {{moduleName}}`,

  // Template for service initialization
  addServiceInit: `
local {{serviceName}} = game:GetService("{{serviceName}}")

-- Initialize service
local function init()
    {{content}}
end

-- Run initialization
init()`,

  // Template for player joining handler
  addPlayerJoined: `
game.Players.PlayerAdded:Connect(function(player)
    -- Wait for character
    player.CharacterAdded:Connect(function(character)
        {{content}}
    end)
end)`
};

/**
 * Get syntax validation hints for common patterns
 */
export const syntaxHints = {
  functionDefinition: {
    pattern: /function\s+\w+\s*\([^)]*\)/,
    hint: "Every 'function' needs a matching 'end'"
  },
  ifStatement: {
    pattern: /if\s+.+\s+then/,
    hint: "Every 'if...then' needs a matching 'end'"
  },
  forLoop: {
    pattern: /for\s+.+\s+do/,
    hint: "Every 'for...do' needs a matching 'end'"
  },
  whileLoop: {
    pattern: /while\s+.+\s+do/,
    hint: "Every 'while...do' needs a matching 'end'"
  },
  repeatLoop: {
    pattern: /repeat\s*$/,
    hint: "Every 'repeat' needs a matching 'until condition'"
  },
  tableDefinition: {
    pattern: /\{[^}]*$/,
    hint: "Every '{' needs a matching '}'"
  },
  functionInTable: {
    pattern: /\w+\s*=\s*function\s*\([^)]*\)/,
    hint: "Functions in tables need 'end' AND usually a comma after"
  }
};

/**
 * Count syntax elements in code
 */
export function countSyntaxElements(code: string): {
  functions: number;
  ends: number;
  ifs: number;
  fors: number;
  whiles: number;
  repeats: number;
  untils: number;
  openBraces: number;
  closeBraces: number;
} {
  // Remove comments and strings to avoid false positives
  const cleanCode = code
    .replace(/--\[\[[\s\S]*?\]\]/g, '') // Remove multiline comments
    .replace(/--.*$/gm, '') // Remove single line comments
    .replace(/"[^"]*"/g, '""') // Remove string contents
    .replace(/'[^']*'/g, "''"); // Remove string contents

  return {
    functions: (cleanCode.match(/\bfunction\b/g) || []).length,
    ends: (cleanCode.match(/\bend\b/g) || []).length,
    ifs: (cleanCode.match(/\bif\b.+\bthen\b/g) || []).length,
    fors: (cleanCode.match(/\bfor\b.+\bdo\b/g) || []).length,
    whiles: (cleanCode.match(/\bwhile\b.+\bdo\b/g) || []).length,
    repeats: (cleanCode.match(/\brepeat\b/g) || []).length,
    untils: (cleanCode.match(/\buntil\b/g) || []).length,
    openBraces: (cleanCode.match(/\{/g) || []).length,
    closeBraces: (cleanCode.match(/\}/g) || []).length
  };
}

/**
 * Validate syntax balance
 */
export function validateSyntaxBalance(code: string): {
  isValid: boolean;
  issues: string[];
} {
  const counts = countSyntaxElements(code);
  const issues: string[] = [];

  // Calculate expected ends
  const expectedEnds = counts.functions + counts.ifs + counts.fors + counts.whiles;
  
  if (counts.ends !== expectedEnds) {
    issues.push(`Expected ${expectedEnds} 'end' statements but found ${counts.ends}`);
  }

  if (counts.repeats !== counts.untils) {
    issues.push(`Found ${counts.repeats} 'repeat' but ${counts.untils} 'until'`);
  }

  if (counts.openBraces !== counts.closeBraces) {
    issues.push(`Found ${counts.openBraces} '{' but ${counts.closeBraces} '}'`);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Suggest fixes for common syntax errors
 */
export function suggestSyntaxFixes(code: string, error: string): string[] {
  const suggestions: string[] = [];

  if (error.includes("expected 'end'") || error.includes("'end' expected")) {
    suggestions.push("Missing 'end' statement - check all functions, if/then, for/do, while/do blocks");
    
    const counts = countSyntaxElements(code);
    const expectedEnds = counts.functions + counts.ifs + counts.fors + counts.whiles;
    
    if (counts.ends < expectedEnds) {
      suggestions.push(`Add ${expectedEnds - counts.ends} more 'end' statement(s)`);
    }
  }

  if (error.includes("unexpected symbol") && error.includes("}")) {
    suggestions.push("Extra '}' found - check table definitions");
  }

  if (error.includes("unfinished string")) {
    suggestions.push("Missing closing quote in string literal");
  }

  if (error.includes("')' expected")) {
    suggestions.push("Missing closing parenthesis in function call or definition");
  }

  return suggestions;
}