-- Module de système de trail pour le sprint
local TrailSystem = {}

-- Services
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")

-- Configuration du trail
TrailSystem.Config = {
    -- Couleurs du trail (dégradé)
    StartColor = Color3.fromRGB(100, 200, 255), -- Bleu clair
    EndColor = Color3.fromRGB(50, 100, 200),    -- Bleu foncé
    
    -- Propriétés du trail
    Lifetime = 0.5,                -- Durée de vie du trail
    MinLength = 0,                 -- Longueur minimale
    MaxLength = 10,                -- Longueur maximale
    Width = 3,                     -- Largeur du trail
    Transparency = NumberSequence.new{
        NumberSequenceKeypoint.new(0, 0),      -- Opaque au début
        NumberSequenceKeypoint.new(0.5, 0.3),  -- Semi-transparent au milieu
        NumberSequenceKeypoint.new(1, 1)       -- Transparent à la fin
    },
    
    -- Effets supplémentaires
    EnableParticles = true,        -- Activer les particules
    ParticleRate = 10,             -- Nombre de particules par seconde
    EnableGlow = true,             -- Effet de lueur
    
    -- Types de trails disponibles
    TrailTypes = {
        Default = {
            StartColor = Color3.fromRGB(100, 200, 255),
            EndColor = Color3.fromRGB(50, 100, 200),
            Texture = nil
        },
        Fire = {
            StartColor = Color3.fromRGB(255, 100, 0),
            EndColor = Color3.fromRGB(255, 200, 0),
            Texture = "rbxasset://textures/particles/fire_main.dds"
        },
        Electric = {
            StartColor = Color3.fromRGB(255, 255, 100),
            EndColor = Color3.fromRGB(100, 100, 255),
            Texture = "rbxasset://textures/particles/sparkles_main.dds"
        },
        Magic = {
            StartColor = Color3.fromRGB(255, 100, 255),
            EndColor = Color3.fromRGB(100, 255, 255),
            Texture = nil
        }
    }
}

-- Variables pour stocker les trails actifs
local activeTrails = {}
local activeParticles = {}

-- Créer les attachments pour le trail
local function CreateAttachments(character)
    local humanoidRootPart = character:FindFirstChild("HumanoidRootPart")
    if not humanoidRootPart then return nil, nil end
    
    -- Créer l'attachment du haut (au niveau de la taille)
    local attachment0 = Instance.new("Attachment")
    attachment0.Name = "TrailAttachment0"
    attachment0.Position = Vector3.new(0, 0, 1) -- Légèrement derrière le personnage
    attachment0.Parent = humanoidRootPart
    
    -- Créer l'attachment du bas (au niveau des pieds)
    local attachment1 = Instance.new("Attachment")
    attachment1.Name = "TrailAttachment1"
    attachment1.Position = Vector3.new(0, -3, 1) -- Plus bas et derrière
    attachment1.Parent = humanoidRootPart
    
    return attachment0, attachment1
end

-- Créer l'effet de trail
local function CreateTrail(attachment0, attachment1, trailType)
    local trail = Instance.new("Trail")
    local config = TrailSystem.Config.TrailTypes[trailType] or TrailSystem.Config.TrailTypes.Default
    
    -- Configurer le trail
    trail.Attachment0 = attachment0
    trail.Attachment1 = attachment1
    trail.Lifetime = TrailSystem.Config.Lifetime
    trail.MinLength = TrailSystem.Config.MinLength
    trail.MaxLength = TrailSystem.Config.MaxLength
    trail.WidthScale = NumberSequence.new(TrailSystem.Config.Width)
    trail.Transparency = TrailSystem.Config.Transparency
    trail.LightEmission = TrailSystem.Config.EnableGlow and 0.5 or 0
    trail.LightInfluence = 0.2
    
    -- Appliquer les couleurs
    trail.Color = ColorSequence.new{
        ColorSequenceKeypoint.new(0, config.StartColor),
        ColorSequenceKeypoint.new(1, config.EndColor)
    }
    
    -- Appliquer la texture si disponible
    if config.Texture then
        trail.Texture = config.Texture
        trail.TextureMode = Enum.TextureMode.Stretch
        trail.TextureLength = 1
    end
    
    trail.Parent = attachment0.Parent
    trail.Enabled = false -- Désactivé par défaut
    
    return trail
end

-- Créer l'effet de particules
local function CreateParticleEffect(character)
    if not TrailSystem.Config.EnableParticles then return nil end
    
    local humanoidRootPart = character:FindFirstChild("HumanoidRootPart")
    if not humanoidRootPart then return nil end
    
    local particleEmitter = Instance.new("ParticleEmitter")
    particleEmitter.Name = "SprintParticles"
    
    -- Configuration des particules
    particleEmitter.Texture = "rbxasset://textures/particles/sparkles_main.dds"
    particleEmitter.Rate = TrailSystem.Config.ParticleRate
    particleEmitter.Lifetime = NumberRange.new(0.5, 1)
    particleEmitter.Speed = NumberRange.new(5, 10)
    particleEmitter.SpreadAngle = Vector2.new(30, 30)
    particleEmitter.Acceleration = Vector3.new(0, -10, 0)
    particleEmitter.Transparency = NumberSequence.new{
        NumberSequenceKeypoint.new(0, 0.5),
        NumberSequenceKeypoint.new(1, 1)
    }
    particleEmitter.Size = NumberSequence.new{
        NumberSequenceKeypoint.new(0, 0.5),
        NumberSequenceKeypoint.new(1, 0)
    }
    particleEmitter.Color = ColorSequence.new(TrailSystem.Config.StartColor)
    particleEmitter.LightEmission = 0.5
    particleEmitter.EmissionDirection = Enum.NormalId.Bottom
    particleEmitter.Enabled = false
    
    -- Position des particules aux pieds
    local attachment = Instance.new("Attachment")
    attachment.Name = "ParticleAttachment"
    attachment.Position = Vector3.new(0, -3, 0)
    attachment.Parent = humanoidRootPart
    
    particleEmitter.Parent = attachment
    
    return particleEmitter
end

-- Activer le trail pour un joueur
function TrailSystem.EnableTrail(player, trailType)
    local character = player.Character
    if not character then return false end
    
    -- Nettoyer les anciens trails
    TrailSystem.DisableTrail(player)
    
    -- Créer les attachments
    local attachment0, attachment1 = CreateAttachments(character)
    if not attachment0 or not attachment1 then return false end
    
    -- Créer le trail
    local trail = CreateTrail(attachment0, attachment1, trailType or "Default")
    if trail then
        trail.Enabled = true
        activeTrails[player] = {
            trail = trail,
            attachment0 = attachment0,
            attachment1 = attachment1
        }
    end
    
    -- Créer les particules
    local particles = CreateParticleEffect(character)
    if particles then
        particles.Enabled = true
        activeParticles[player] = particles
    end
    
    -- Effet d'activation avec animation
    if trail and TrailSystem.Config.EnableGlow then
        task.spawn(function()
            for i = 0, 5 do
                trail.LightEmission = 0.5 + (math.sin(i) * 0.3)
                task.wait(0.1)
            end
            trail.LightEmission = 0.5
        end)
    end
    
    return true
end

-- Désactiver le trail pour un joueur
function TrailSystem.DisableTrail(player)
    -- Désactiver et nettoyer le trail
    local trailData = activeTrails[player]
    if trailData then
        if trailData.trail then
            trailData.trail.Enabled = false
            -- Attendre que le trail disparaisse avant de le détruire
            Debris:AddItem(trailData.trail, TrailSystem.Config.Lifetime)
        end
        if trailData.attachment0 then
            trailData.attachment0:Destroy()
        end
        if trailData.attachment1 then
            trailData.attachment1:Destroy()
        end
        activeTrails[player] = nil
    end
    
    -- Désactiver et nettoyer les particules
    local particles = activeParticles[player]
    if particles then
        particles.Enabled = false
        Debris:AddItem(particles.Parent, 1) -- Détruire l'attachment parent
        activeParticles[player] = nil
    end
end

-- Changer le type de trail
function TrailSystem.ChangeTrailType(player, newType)
    if activeTrails[player] then
        TrailSystem.DisableTrail(player)
        TrailSystem.EnableTrail(player, newType)
    end
end

-- Nettoyer quand un joueur quitte
function TrailSystem.CleanupPlayer(player)
    TrailSystem.DisableTrail(player)
end

-- Obtenir les types de trails disponibles
function TrailSystem.GetTrailTypes()
    local types = {}
    for name, _ in pairs(TrailSystem.Config.TrailTypes) do
        table.insert(types, name)
    end
    return types
end

return TrailSystem
