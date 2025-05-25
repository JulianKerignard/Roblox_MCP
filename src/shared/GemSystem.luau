-- Module GemSystem : Configuration et utilitaires pour le système de gemmes
local GemSystem = {}

-- Configuration des types de gemmes
GemSystem.GemTypes = {
    {
        name = "Rouge",
        color = Color3.fromRGB(255, 0, 0),
        points = 1,
        size = Vector3.new(2, 2, 2),
        material = Enum.Material.Neon
    },
    {
        name = "Bleue",
        color = Color3.fromRGB(0, 100, 255),
        points = 3,
        size = Vector3.new(2.5, 2.5, 2.5),
        material = Enum.Material.Neon
    },
    {
        name = "Verte",
        color = Color3.fromRGB(0, 255, 100),
        points = 5,
        size = Vector3.new(3, 3, 3),
        material = Enum.Material.Neon
    }
}

-- Configuration générale
GemSystem.Config = {
    SpawnInterval = 3, -- Secondes entre chaque spawn
    SpawnRadius = 50, -- Rayon de spawn autour du spawn
    SpawnHeight = 5, -- Hauteur de spawn des gemmes réduite
    GemLifetime = 30, -- Temps avant qu'une gemme disparaisse (secondes)
    RotationSpeed = 2 -- Vitesse de rotation des gemmes
}

-- Objectifs de collection
GemSystem.Objectives = {10, 25, 50, 100, 250, 500, 1000}

-- Fonction pour créer une gemme
function GemSystem.CreateGem(gemType)
    local gem = Instance.new("Part")
    gem.Name = "Gem_" .. gemType.name
    gem.Size = gemType.size
    gem.Material = gemType.material
    gem.Color = gemType.color
    gem.TopSurface = Enum.SurfaceType.Smooth
    gem.BottomSurface = Enum.SurfaceType.Smooth
    gem.CanCollide = false
    gem.Anchored = true
    
    -- Ajouter une lumière pour l'effet
    local pointLight = Instance.new("PointLight")
    pointLight.Color = gemType.color
    pointLight.Brightness = 2
    pointLight.Range = 10
    pointLight.Parent = gem
    
    -- Ajouter un effet de particules
    local attachment = Instance.new("Attachment")
    attachment.Parent = gem
    
    local particleEmitter = Instance.new("ParticleEmitter")
    particleEmitter.Texture = "rbxasset://textures/particles/sparkles_main.dds"
    particleEmitter.Rate = 20
    particleEmitter.Lifetime = NumberRange.new(0.5, 1)
    particleEmitter.SpreadAngle = Vector2.new(360, 360)
    particleEmitter.VelocityInheritance = 0
    particleEmitter.Speed = NumberRange.new(2)
    particleEmitter.Color = ColorSequence.new(gemType.color)
    particleEmitter.Size = NumberSequence.new({
        NumberSequenceKeypoint.new(0, 0.5),
        NumberSequenceKeypoint.new(1, 0)
    })
    particleEmitter.Parent = attachment
    
    -- Stocker les données de la gemme
    local gemData = Instance.new("Configuration")
    gemData.Name = "GemData"
    gemData.Parent = gem
    
    local pointsValue = Instance.new("IntValue")
    pointsValue.Name = "Points"
    pointsValue.Value = gemType.points
    pointsValue.Parent = gemData
    
    local typeValue = Instance.new("StringValue")
    typeValue.Name = "Type"
    typeValue.Value = gemType.name
    typeValue.Parent = gemData
    
    return gem
end

-- Fonction pour positionner aléatoirement une gemme
function GemSystem.GetRandomSpawnPosition()
    local x = math.random(-GemSystem.Config.SpawnRadius, GemSystem.Config.SpawnRadius)
    local z = math.random(-GemSystem.Config.SpawnRadius, GemSystem.Config.SpawnRadius)
    local y = GemSystem.Config.SpawnHeight
    return Vector3.new(x, y, z)
end

-- Fonction pour obtenir un type de gemme aléatoire (avec probabilités)
function GemSystem.GetRandomGemType()
    local roll = math.random(1, 100)
    if roll <= 50 then
        return GemSystem.GemTypes[1] -- Rouge (50%)
    elseif roll <= 80 then
        return GemSystem.GemTypes[2] -- Bleue (30%)
    else
        return GemSystem.GemTypes[3] -- Verte (20%)
    end
end

-- Fonction pour obtenir le prochain objectif
function GemSystem.GetNextObjective(currentGems)
    for _, objective in ipairs(GemSystem.Objectives) do
        if currentGems < objective then
            return objective
        end
    end
    -- Si tous les objectifs sont atteints, retourner un objectif dynamique
    return math.ceil(currentGems / 1000) * 1000 + 1000
end

-- Créer les RemoteEvents nécessaires
function GemSystem.SetupRemotes()
    local replicatedStorage = game:GetService("ReplicatedStorage")
    
    -- Créer un dossier pour les remotes si nécessaire
    local remotesFolder = replicatedStorage:FindFirstChild("GemRemotes")
    if not remotesFolder then
        remotesFolder = Instance.new("Folder")
        remotesFolder.Name = "GemRemotes"
        remotesFolder.Parent = replicatedStorage
    end
    
    -- Créer ou récupérer GemCollected
    local gemCollectedRemote = remotesFolder:FindFirstChild("GemCollected")
    if not gemCollectedRemote then
        gemCollectedRemote = Instance.new("RemoteEvent")
        gemCollectedRemote.Name = "GemCollected"
        gemCollectedRemote.Parent = remotesFolder
    end
    
    -- Créer ou récupérer UpdateScore
    local updateScoreRemote = remotesFolder:FindFirstChild("UpdateScore")
    if not updateScoreRemote then
        updateScoreRemote = Instance.new("RemoteEvent")
        updateScoreRemote.Name = "UpdateScore"
        updateScoreRemote.Parent = remotesFolder
    end
    
    -- Retourner la table des remotes
    return {
        GemCollected = gemCollectedRemote,
        UpdateScore = updateScoreRemote
    }
end

return GemSystem