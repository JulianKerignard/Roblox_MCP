-- Module ShopSystem : Configuration et gestion de la boutique
local ShopSystem = {}

-- Catégories d'items
ShopSystem.Categories = {
    TRAILS = "Trails",
    BOOSTS = "Boosts",
    ABILITIES = "Abilities",
    COSMETICS = "Cosmetics",
    DECALS = "Decals"
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
            trailType = "Fire"
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
            trailType = "Ice"
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
            trailType = "Rainbow"
        }
    },
    {
        id = "trail_electric",
        description = "Des éclairs crépitants te suivent !",
        category = ShopSystem.Categories.TRAILS,
        price = 200,
        icon = "⚡",
        data = {
            trailType = "Electric"
        }
    },
    {
        id = "trail_magic",
        name = "Trail Magique",
        description = "Une aura mystique et colorée !",
        category = ShopSystem.Categories.TRAILS,
        price = 250,
        icon = "✨",
        data = {
            trailType = "Magic"
        }
    },
    {
        id = "trail_lightning",
        name = "Trail Éclair",
        description = "La puissance de la foudre pure !",
        category = ShopSystem.Categories.TRAILS,
        price = 350,
        icon = "🌩️",
        data = {
            trailType = "Lightning"
        }
    },
    {
        id = "trail_galaxy",
        name = "Trail Galaxie",
        description = "Les étoiles et l'univers à tes pieds !",
        category = ShopSystem.Categories.TRAILS,
        price = 400,
        icon = "🌌",
        data = {
            trailType = "Galaxy"
        }
    },
    {
        id = "trail_shadow",
        name = "Trail Ombre",
        description = "Les ténèbres te suivent partout...",
        category = ShopSystem.Categories.TRAILS,
        price = 300,
        icon = "🌑",
        data = {
            trailType = "Shadow"
        }
    },
    {
        id = "trail_neon",
        name = "Trail Néon",
        description = "Brillant et coloré comme les néons de la ville !",
        category = ShopSystem.Categories.TRAILS,
        price = 280,
        icon = "💡",
        data = {
            trailType = "Neon"
        }
    },
    {
        id = "trail_nature",
        name = "Trail Nature", 
        description = "La force de la nature t'accompagne !",
        category = ShopSystem.Categories.TRAILS,
        price = 220,
        icon = "🍃",
        data = {
            trailType = "Nature"
        }
    },
    {
        id = "trail_gold",
        name = "Trail Doré",
        description = "Un sillage royal en or pur !",
        category = ShopSystem.Categories.TRAILS,
        price = 500,
        icon = "⭐",
        data = {
            trailType = "Gold"
        }
    },
    {
        id = "trail_default",
        name = "Trail Classique",
        description = "Le trail de base, simple mais efficace !",
        category = ShopSystem.Categories.TRAILS,
        price = 0,
        icon = "💨",
        data = {
            trailType = "Default"
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
    },
    
    -- DECALS
    {
        id = "decal_anime_girl",
        name = "Anime Girl",
        description = "Une jolie fille anime pour décorer ton personnage !",
        category = ShopSystem.Categories.DECALS,
        price = 150,
        icon = "🎨",
        data = {
            decalId = "rbxassetid://1234538"
        }
    },
    {
        id = "decal_pikachu",
        name = "Pikachu",
        description = "L'adorable Pokémon électrique !",
        category = ShopSystem.Categories.DECALS,
        price = 200,
        icon = "⚡",
        data = {
            decalId = "rbxassetid://46059313"
        }
    },
    {
        id = "decal_drip_goku",
        name = "Drip Goku",
        description = "Goku avec du style !",
        category = ShopSystem.Categories.DECALS,
        price = 300,
        icon = "🔥",
        data = {
            decalId = "rbxassetid://7683701966"
        }
    },
    {
        id = "decal_straw_hat",
        name = "Straw Hat Pirates",
        description = "L'emblème des pirates au chapeau de paille !",
        category = ShopSystem.Categories.DECALS,
        price = 250,
        icon = "🏴‍☠️",
        data = {
            decalId = "rbxassetid://9478562327"
        }
    },
    {
        id = "decal_epic_face",
        name = "Epic Face",
        description = "Le visage épique classique de Roblox !",
        category = ShopSystem.Categories.DECALS,
        price = 100,
        icon = "😎",
        data = {
            decalId = "rbxassetid://109251560"
        }
    },
    {
        id = "decal_spongebob",
        name = "SpongeBob Graffiti",
        description = "Bob l'éponge en mode street art !",
        category = ShopSystem.Categories.DECALS,
        price = 175,
        icon = "🧽",
        data = {
            decalId = "rbxassetid://51812595"
        }
    },
    {
        id = "decal_monster_energy",
        name = "Monster Energy",
        description = "Le logo emblématique Monster Energy !",
        category = ShopSystem.Categories.DECALS,
        price = 150,
        icon = "🥤",
        data = {
            decalId = "rbxassetid://123474111"
        }
    },
    {
        id = "decal_finn_jake",
        name = "Finn & Jake", 
        description = "Les héros d'Adventure Time !",
        category = ShopSystem.Categories.DECALS,
        price = 225,
        icon = "🗡️",
        data = {
            decalId = "rbxassetid://80684094"
        }
    },
    {
        id = "decal_cute_anime",
        name = "Cute Anime Girl",
        description = "Une fille anime super kawaii !",
        category = ShopSystem.Categories.DECALS,
        price = 180,
        icon = "💕",
        data = {
            decalId = "rbxassetid://6394847912"
        }
    },
    {
        id = "decal_bang",
        name = "Bang! Comic",
        description = "Effet comic book explosif !",
        category = ShopSystem.Categories.DECALS,
        price = 120,
        icon = "💥",
        data = {
            decalId = "rbxassetid://6013360"
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
