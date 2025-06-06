-- Script serveur pour gérer la boutique (version simplifiée pour Studio)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

-- Modules
local ShopSystem = require(ReplicatedStorage.Shared.ShopSystem)

-- Variables
local playerData = {}
local remotes = ShopSystem.SetupRemotes()

-- Structure des données du joueur
local function getDefaultPlayerData()
    return {
        gems = 100, -- Donner des gemmes de départ pour tester
        ownedItems = {},
        equippedItems = {
            trail = nil,
            boost = nil,
            ability = nil,
            cosmetic = nil,
            decal = nil
        }
    }
end

-- Appliquer les effets d'un item (définie avant son utilisation)
local function applyItemEffects(player, item, equip)
    local character = player.Character
    if not character then return end
    
    if item.category == ShopSystem.Categories.BOOSTS then
        local humanoid = character:FindFirstChild("Humanoid")
        if humanoid then
            if item.id == "boost_speed" and equip then
                humanoid.WalkSpeed = 16 * (item.data.speedMultiplier or 1)
            elseif item.id == "boost_speed" and not equip then
                humanoid.WalkSpeed = 16
            elseif item.id == "boost_jump" and equip then
                humanoid.JumpPower = 50 * (item.data.jumpMultiplier or 1)
            elseif item.id == "boost_jump" and not equip then
                humanoid.JumpPower = 50
            end
        end
    elseif item.category == ShopSystem.Categories.DECALS then
        -- Appliquer le decal sur le torse du personnage
        local torso = character:FindFirstChild("Torso") or character:FindFirstChild("UpperTorso")
        if torso then
            -- Supprimer l'ancien decal s'il existe
            local oldDecal = torso:FindFirstChild("ShopDecal")
            if oldDecal then
                oldDecal:Destroy()
            end
            
            -- Appliquer le nouveau decal si on équipe
            if equip and item.data.decalId then
                local decal = Instance.new("Decal")
                decal.Name = "ShopDecal"
                decal.Texture = item.data.decalId
                decal.Face = Enum.NormalId.Front
                decal.Parent = torso
                
                -- Ajouter aussi sur le dos pour un effet plus cool
                local backDecal = Instance.new("Decal")
                backDecal.Name = "ShopDecalBack"
                backDecal.Texture = item.data.decalId
                backDecal.Face = Enum.NormalId.Back
                backDecal.Parent = torso
            else
                -- Supprimer aussi le decal du dos
                local backDecal = torso:FindFirstChild("ShopDecalBack")
                if backDecal then
                    backDecal:Destroy()
                end
            end
        end
    end
end

-- Charger les données du joueur
local function loadPlayerData(player)
    playerData[player] = getDefaultPlayerData()
    
    -- Créer ou récupérer les leaderstats
    local leaderstats = player:FindFirstChild("leaderstats")
    if not leaderstats then
        leaderstats = Instance.new("Folder")
        leaderstats.Name = "leaderstats"
        leaderstats.Parent = player
    end
    
    local gems = Instance.new("IntValue")
    gems.Name = "Gems"
    gems.Value = playerData[player].gems
    gems.Parent = leaderstats
    
    -- Notifier le client du score initial après un court délai
    task.wait(2) -- Attendre que le client soit complètement chargé
    local gemRemotes = ReplicatedStorage:FindFirstChild("GemRemotes")
    if gemRemotes then
        local updateScore = gemRemotes:FindFirstChild("UpdateScore")
        if updateScore then
            updateScore:FireClient(player, playerData[player].gems)
        end
    end
    
    print("Données du joueur chargées pour", player.Name)
end

-- Fonction pour acheter un item
remotes.PurchaseItem.OnServerInvoke = function(player, itemId)
    local data = playerData[player]
    if not data then return false, "Données non chargées" end
    
    local item = ShopSystem.GetItemById(itemId)
    if not item then return false, "Item invalide" end
    
    -- Vérifier si le joueur possède déjà l'item
    if table.find(data.ownedItems, itemId) then
        return false, "Vous possédez déjà cet item"
    end
    
    -- Vérifier si le joueur a assez de gemmes
    if data.gems < item.price then
        return false, "Pas assez de gemmes"
    end
    
    -- Effectuer l'achat
    data.gems = data.gems - item.price
    table.insert(data.ownedItems, itemId)
    
    -- Mettre à jour l'affichage des gemmes
    player.leaderstats.Gems.Value = data.gems
    
    -- Notifier le client
    local gemRemotes = ReplicatedStorage:FindFirstChild("GemRemotes")
    if gemRemotes then
        local updateScore = gemRemotes:FindFirstChild("UpdateScore")
        if updateScore then
            updateScore:FireClient(player, data.gems)
        end
    end
    
    print(player.Name, "a acheté", item.name)
    
    return true, "Achat réussi"
end

-- Fonction pour obtenir les items possédés
remotes.GetOwnedItems.OnServerInvoke = function(player)
    local data = playerData[player]
    if not data then return {}, {} end
    return data.ownedItems, data.equippedItems
end

-- Fonction pour équiper/déséquiper un item
remotes.EquipItem.OnServerEvent:Connect(function(player, itemId, equip)
    local data = playerData[player]
    if not data then return end
    
    -- Vérifier si le joueur possède l'item
    if not table.find(data.ownedItems, itemId) then return end
    
    local item = ShopSystem.GetItemById(itemId)
    if not item then return end
    
    -- Déterminer la catégorie pour l'équipement
    local categorySlot = nil
    if item.category == ShopSystem.Categories.TRAILS then
        categorySlot = "trail"
    elseif item.category == ShopSystem.Categories.BOOSTS then
        categorySlot = "boost"
    elseif item.category == ShopSystem.Categories.ABILITIES then
        categorySlot = "ability"
    elseif item.category == ShopSystem.Categories.COSMETICS then
        categorySlot = "cosmetic"
    elseif item.category == ShopSystem.Categories.DECALS then
        categorySlot = "decal"
    end
    if categorySlot then
        if equip then
            data.equippedItems[categorySlot] = itemId
            print(player.Name, "a équipé", item.name)
        else
            data.equippedItems[categorySlot] = nil
            print(player.Name, "a déséquipé", item.name)
        end
        
        -- Appliquer les effets de l'item
        applyItemEffects(player, item, equip)
    end
end)

-- Quand un joueur rejoint
Players.PlayerAdded:Connect(function(player)
    loadPlayerData(player)
    
    -- Réappliquer les items équipés quand le personnage spawn
    player.CharacterAdded:Connect(function(character)
        task.wait(1) -- Attendre que le personnage soit complètement chargé
        local data = playerData[player]
        if data and data.equippedItems then
            for categorySlot, itemId in pairs(data.equippedItems) do
                if itemId then
                    local item = ShopSystem.GetItemById(itemId)
                    if item then
                        applyItemEffects(player, item, true)
                    end
                end
            end
        end
    end)
end)

-- Quand un joueur quitte
Players.PlayerRemoving:Connect(function(player)
    playerData[player] = nil
end)

-- Donner des gemmes périodiquement pour tester
task.spawn(function()
    while true do
        task.wait(10)
        for player, data in pairs(playerData) do
            if player.Parent then -- Vérifier que le joueur est toujours connecté
                data.gems = data.gems + 10
                player.leaderstats.Gems.Value = data.gems
                
                -- Notifier le client du nouveau score
                local gemRemotes = ReplicatedStorage:FindFirstChild("GemRemotes")
                if gemRemotes then
                    local updateScore = gemRemotes:FindFirstChild("UpdateScore")
                    if updateScore then
                        updateScore:FireClient(player, data.gems)
                    end
                end
            end
        end
    end
end)

print("🛍️ Système de boutique initialisé (mode Studio)")