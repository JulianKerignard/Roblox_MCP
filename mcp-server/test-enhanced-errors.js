import { syntaxEnforcer } from '../dist/src/validation/syntax-enforcer.js';

console.log('🧪 Test des messages d\'erreur contextuels\n');

// Test 1: Code avec 'end' manquant
const codeWithMissingEnd = `
local function calculateScore(player)
  local score = 0
  
  if player.leaderstats then
    score = player.leaderstats.Points.Value
    
    if score > 100 then
      player.Badge:Award()
  end
  
  return score
end
`;

console.log('Test 1: Code avec end manquant');
console.log('================================');

const validation1 = syntaxEnforcer.validateBeforeModification('', codeWithMissingEnd, 'insert');
const enhanced1 = syntaxEnforcer.enhanceErrorMessages(codeWithMissingEnd, validation1);

enhanced1.errors.forEach(err => console.log(err));

// Test 2: Code avec types Luau mal formés
const codeWithBadTypes = `
type Player<T = {name: string, id: number}
local function getPlayer<T, U(id: T): Player<T>
  return game.Players:GetPlayerByUserId(id)
end

local myFunc: (number, string -> boolean = function(a, b)
  return a > #b
end
`;

console.log('\n\nTest 2: Code avec types Luau mal formés');
console.log('========================================');

const validation2 = syntaxEnforcer.validateBeforeModification('', codeWithBadTypes, 'insert');
const enhanced2 = syntaxEnforcer.enhanceErrorMessages(codeWithBadTypes, validation2);

enhanced2.errors.forEach(err => console.log(err));

// Test 3: Strings multi-lignes et échappements
const codeWithStrings = `
local text = [[
  This is a multi-line string
  with "quotes" and 'apostrophes'
]]

local escaped = "Text with \" escaped quote"
local doubleEscaped = "Text with \\\\" double escaped"

if text == [[test]] then
  print("Match!")
end
`;

console.log('\n\nTest 3: Strings multi-lignes (devrait être valide)');
console.log('===================================================');

const validation3 = syntaxEnforcer.validateBeforeModification('', codeWithStrings, 'insert');
if (validation3.isValid) {
  console.log('✅ Code valide - strings multi-lignes correctement gérées');
} else {
  const enhanced3 = syntaxEnforcer.enhanceErrorMessages(codeWithStrings, validation3);
  enhanced3.errors.forEach(err => console.log(err));
}

console.log('\n✅ Tests terminés!');