/**
 * TEST DU SYSTÈME DE VALIDATION SYNTAXIQUE
 * Démontre comment le système bloque les erreurs
 */

import { syntaxValidator } from './syntax-validator.js';
import { hookManager } from './modification-hooks.js';

// Test 1: Code avec 'end' manquant
console.log("=== TEST 1: 'end' manquant ===");
const badCode1 = `
local function test()
    print("Hello")
    if true then
        print("World")
    -- Manque 'end' ici pour le if
-- Manque 'end' ici pour la function
`;

const result1 = syntaxValidator.validateCode(badCode1);
console.log("Valide?", result1.valid);
console.log("Erreurs:", result1.errors);
console.log("Suggestions:", result1.suggestions);

// Test 2: Parenthèses déséquilibrées
console.log("\n=== TEST 2: Parenthèses déséquilibrées ===");
const badCode2 = `
local function calculate(a, b)
    return (a + b * (c + d)
end
`;

const result2 = syntaxValidator.validateCode(badCode2);
console.log("Valide?", result2.valid);
console.log("Erreurs:", result2.errors);

// Test 3: Test avec hooks
console.log("\n=== TEST 3: Test avec hooks ===");
const testHook = async () => {
    const hookResult = await hookManager.executeHooks({
        operation: 'write',
        filePath: 'test.luau',
        newContent: badCode1
    });
    
    console.log("Approuvé?", hookResult.approved);
    console.log("Erreurs détectées:", hookResult.errors);
    console.log("Suggestions:", hookResult.suggestions);
};

testHook();

// Test 4: Code valide
console.log("\n=== TEST 4: Code valide ===");
const goodCode = `
local function test()
    print("Hello")
    if true then
        print("World")
    end
end

local module = {
    value = 42,
    
    method = function(self)
        return self.value
    end
}

return module
`;

const result4 = syntaxValidator.validateCode(goodCode);
console.log("Valide?", result4.valid);
console.log("Erreurs:", result4.errors.length);
console.log("Avertissements:", result4.warnings.length);

// Test 5: Preview de patch
console.log("\n=== TEST 5: Preview de patch ===");
const originalCode = `
local function existing()
    print("Original")
end
`;

const patchPreview = syntaxValidator.previewPatch(originalCode, {
    scriptPath: 'test.luau',
    operation: 'insert',
    lineStart: 5,
    newContent: `
local function new()
    print("New function")
    -- Oops, pas de 'end'
`
});

console.log("Patch valide?", patchPreview.valid);
console.log("Erreurs dans le patch:", patchPreview.errors);
console.log("Analyse des blocs:", patchPreview.bracketAnalysis);