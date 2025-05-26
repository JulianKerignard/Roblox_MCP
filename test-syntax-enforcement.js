/**
 * Script de test pour vérifier le système de validation syntaxique
 */

import { syntaxEnforcer } from './dist/src/validation/syntax-enforcer.js';

console.log('🧪 TEST DU SYSTÈME DE VALIDATION SYNTAXIQUE\n');

// Test 1: Code valide
console.log('Test 1: Code valide');
const validCode = `
function test()
    if condition then
        print("Hello")
    end
end
`;

const validation1 = syntaxEnforcer.validateBeforeModification('', validCode, 'test');
console.log('Résultat:', validation1.isValid ? '✅ VALIDE' : '❌ INVALIDE');
console.log('---\n');

// Test 2: Il manque un 'end'
console.log('Test 2: Il manque un end');
const invalidCode1 = `
function test()
    if condition then
        print("Hello")
    end
-- Oubli du 'end' de la fonction!
`;

const validation2 = syntaxEnforcer.validateBeforeModification('', invalidCode1, 'test');
console.log('Résultat:', validation2.isValid ? '✅ VALIDE' : '❌ INVALIDE');
if (!validation2.isValid) {
    console.log('Erreurs:', validation2.errors);
    console.log('Blocs non fermés:', validation2.blockAnalysis.unclosedBlocks);
}
console.log('---\n');

// Test 3: Trop de 'end'
console.log('Test 3: Trop de end');
const invalidCode2 = `
function test()
    print("Hello")
end
end -- end en trop!
`;

const validation3 = syntaxEnforcer.validateBeforeModification('', invalidCode2, 'test');
console.log('Résultat:', validation3.isValid ? '✅ VALIDE' : '❌ INVALIDE');
if (!validation3.isValid) {
    console.log('Erreurs:', validation3.errors);
}
console.log('---\n');

// Test 4: Parenthèses déséquilibrées
console.log('Test 4: Parenthèses déséquilibrées');
const invalidCode3 = `
function test(a, b
    print(a + b))
end
`;

const validation4 = syntaxEnforcer.validateBeforeModification('', invalidCode3, 'test');
console.log('Résultat:', validation4.isValid ? '✅ VALIDE' : '❌ INVALIDE');
if (!validation4.isValid) {
    console.log('Erreurs:', validation4.errors);
}
console.log('---\n');

// Test 5: Code complexe avec plusieurs erreurs
console.log('Test 5: Code complexe avec plusieurs erreurs');
const complexCode = `
function ShopUI.HandleItemAction(item, isOwned, isEquipped)
    local shopRemotes = ShopSystem.SetupRemotes()
    
    if isOwned then
        -- Équiper/Déséquiper
        shopRemotes.EquipItem:FireServer(item.id, not isEquipped)
        
        if isEquipped then
            ShopUI.equippedItems[item.category:lower()] = nil
        else
            ShopUI.equippedItems[item.category:lower()] = item.id
        end
    else
        -- Acheter
        NotificationSystem.Create("Achat en cours...", "⏳", COLORS.accent)
        
        local success, message = shopRemotes.PurchaseItem:InvokeServer(item.id)
        
        if success then
            NotificationSystem.Create(message, "✅", COLORS.success)
        else
            NotificationSystem.Create(message, "❌", COLORS.danger)
        end
    -- IL MANQUE UN 'end' ICI!
-- ET UN AUTRE 'end' ICI!
`;

const validation5 = syntaxEnforcer.validateBeforeModification('', complexCode, 'test');
console.log('Résultat:', validation5.isValid ? '✅ VALIDE' : '❌ INVALIDE');
if (!validation5.isValid) {
    console.log('\nErreurs:');
    validation5.errors.forEach(err => console.log(' -', err));
    console.log('\nBlocs non fermés:');
    validation5.blockAnalysis.unclosedBlocks.forEach(block => 
        console.log(` - ${block.type} à la ligne ${block.line}`)
    );
    console.log('\nAnalyse:');
    console.log(` - Blocs attendus: ${validation5.blockAnalysis.expectedEnds}`);
    console.log(` - 'end' trouvés: ${validation5.blockAnalysis.foundEnds}`);
    console.log(` - Manquants: ${validation5.blockAnalysis.expectedEnds - validation5.blockAnalysis.foundEnds}`);
}

console.log('\n✅ Tests terminés!');