-- Module ShopSystem : Configuration et gestion de la boutique
local ShopSystem = {}

-- Catégories d'items
ShopSystem.Categories = {
    TRAILS = "Trails",
    BOOSTS = "Boosts",
    ABILITIES = "Abilities",
    COSMETICS = "Cosmetics"
}

-- Configuration des items de la boutique
ShopSystem.Items = {
    -- TRAILS
    {
        id = "trail_fire",
        name = "Trail de Feu",
        description = "Laisse une traînée de feu derrière toi !",
        category = ShopSystem.Categories.TRAILS,
        price = 100,
        icon = "🔥",
        data = {
            texture = "rbxasset://textures/particles/fire_main.dds",
            color = ColorSequence.new(Color3.fromRGB(255, 100, 0)),
            lifetime = 1,
            rate = 50
        }
    },
    {
        id = "trail_ice",
        name = "Trail de Glace",
        description = "Un sillage glacé pour les plus cool !",
        category = ShopSystem.Categories.TRAILS,
        price = 150,
        icon = "❄️",
        data = {
            texture = "rbxasset://textures/particles/sparkles_main.dds",
            color = ColorSequence.new(Color3.fromRGB(100, 200, 255)),
            lifetime = 1.5,
            rate = 40
        }
    },
    {
        id = "trail_rainbow",
        name = "Trail Arc-en-ciel",
        description = "Toutes les couleurs de l'arc-en-ciel !",
        category = ShopSystem.Categories.TRAILS,
        price = 300,
        icon = "🌈",
        data = {
            texture = "rbxasset://textures/particles/sparkles_main.dds",
            color = ColorSequence.new({
                ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 0, 0)),
                ColorSequenceKeypoint.new(0.2, Color3.fromRGB(255, 165, 0)),
                ColorSequenceKeypoint.new(0.4, Color3.fromRGB(255, 255, 0)),
                ColorSequenceKeypoint.new(0.6, Color3.fromRGB(0, 255, 0)),
                ColorSequenceKeypoint.new(0.8, Color3.fromRGB(0, 0, 255)),
                ColorSequenceKeypoint.new(1, Color3.fromRGB(148, 0, 211))
            }),
            lifetime = 2,
            rate = 60
        }
    },
    
    -- BOOSTS
    {
        id = "boost_speed",
        name = "Boost de Vitesse",
        description = "Augmente ta vitesse de course de 20% !",
        category = ShopSystem.Categories.BOOSTS,
        price = 200,
        icon = "⚡",
        data = {
            speedMultiplier = 1.2
        }
    },
    {
        id = "boost_jump",
        name = "Super Saut",
        description = "Saute 50% plus haut !",
        category = ShopSystem.Categories.BOOSTS,
        price = 250,
        icon = "🦘",
        data = {
            jumpMultiplier = 1.5
        }
    },
    {
        id = "boost_gems",
        name = "Multiplicateur de Gemmes",
        description = "Double les points des gemmes collectées !",
        category = ShopSystem.Categories.BOOSTS,
        price = 500,
        icon = "💎",
        data = {
            gemMultiplier = 2
        }
    },
    
    -- ABILITIES
    {
        id = "ability_magnet",
        name = "Aimant à Gemmes",
        description = "Attire automatiquement les gemmes proches !",
        category = ShopSystem.Categories.ABILITIES,
        price = 400,
        icon = "🧲",
        data = {
            magnetRange = 15
        }
    },
    {
        id = "ability_dash",
        name = "Dash",
        description = "Double-clique pour faire un dash rapide !",
        category = ShopSystem.Categories.ABILITIES,
        price = 350,
        icon = "💨",
        data = {
            dashPower = 50,
            dashCooldown = 3
        }
    },
    
    -- COSMETICS
    {
        id = "cosmetic_crown",
        name = "Couronne Dorée",
        description = "Une couronne pour les vrais rois !",
        category = ShopSystem.Categories.COSMETICS,
        price = 1000,
        icon = "👑",
        data = {
            accessoryId = "crown_gold"
        }
    },
    {
        id = "cosmetic_wings",
        name = "Ailes d'Ange",
        description = "Des ailes majestueuses !",
        category = ShopSystem.Categories.COSMETICS,
        price = 750,
        icon = "🪽",
        data = {
            accessoryId = "wings_angel"
        }
    }
}

-- Fonction pour obtenir un item par son ID
function ShopSystem.GetItemById(itemId)
    for _, item in ipairs(ShopSystem.Items) do
        if item.id == itemId then
            return item
        end
    end
    return nil
end

-- Fonction pour obtenir tous les items d'une catégorie
function ShopSystem.GetItemsByCategory(category)
    local items = {}
    for _, item in ipairs(ShopSystem.Items) do
        if item.category == category then
            table.insert(items, item)
        end
    end
    return items
end

-- Créer les RemoteEvents nécessaires
function ShopSystem.SetupRemotes()
    local replicatedStorage = game:GetService("ReplicatedStorage")
    
    -- Créer un dossier pour les remotes si nécessaire
    local remotesFolder = replicatedStorage:FindFirstChild("ShopRemotes")
    if not remotesFolder then
        remotesFolder = Instance.new("Folder")
        remotesFolder.Name = "ShopRemotes"
        remotesFolder.Parent = replicatedStorage
    end
    
    -- Remote pour acheter un item
    local purchaseRemote = remotesFolder:FindFirstChild("PurchaseItem")
    if not purchaseRemote then
        purchaseRemote = Instance.new("RemoteFunction")
        purchaseRemote.Name = "PurchaseItem"
        purchaseRemote.Parent = remotesFolder
    end
    
    -- Remote pour obtenir les items possédés
    local getOwnedRemote = remotesFolder:FindFirstChild("GetOwnedItems")
    if not getOwnedRemote then
        getOwnedRemote = Instance.new("RemoteFunction")
        getOwnedRemote.Name = "GetOwnedItems"
        getOwnedRemote.Parent = remotesFolder
    end
    
    -- Remote pour équiper/déséquiper un item
    local equipRemote = remotesFolder:FindFirstChild("EquipItem")
    if not equipRemote then
        equipRemote = Instance.new("RemoteEvent")
        equipRemote.Name = "EquipItem"
        equipRemote.Parent = remotesFolder
    end
    
    return {
        PurchaseItem = purchaseRemote,
        GetOwnedItems = getOwnedRemote,
        EquipItem = equipRemote
    }
end

return ShopSystem
