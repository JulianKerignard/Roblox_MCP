-- Script serveur principal pour le jeu Collecteur de Gemmes
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local Debris = game:GetService("Debris")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- Charger le module GemSystem avec WaitForChild
local GemSystem = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("GemSystem"))

-- Variables
local gemsFolder = nil
local remotes = nil
local activeGems = {}

-- Initialisation
local function Initialize()
    -- Créer le dossier pour les gemmes
    -- Créer le dossier pour les gemmes
    if not gemsFolder then
        gemsFolder = Instance.new("Folder")
        gemsFolder.Name = "GemsFolder"
        gemsFolder.Parent = workspace
    end
    
    
    -- Configurer les RemoteEvents
    remotes = GemSystem.SetupRemotes()
    if remotes then
        print("🎮 Collecteur de Gemmes initialisé!")
        print("✅ RemoteEvents créés:")
        print("  - GemCollected:", remotes.GemCollected)
        print("  - UpdateScore:", remotes.UpdateScore)
        local remotesFolder = ReplicatedStorage:FindFirstChild("GemRemotes")
        if remotesFolder then
            print("✅ Dossier GemRemotes trouvé dans ReplicatedStorage")
        else
            warn("❌ Dossier GemRemotes introuvable après création!")
        end
    else
        warn("⚠️ Erreur lors de l'initialisation des RemoteEvents")
    end
end

-- Créer les leaderstats pour un joueur
local function SetupLeaderstats(player)
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"
    leaderstats.Parent = player
    
    local gems = Instance.new("IntValue")
    gems.Name = "Gems"
    gems.Value = 0
    gems.Parent = leaderstats
    
    -- Envoyer le score initial au client
    task.wait(1) -- Attendre que le client soit prêt
    if remotes and remotes.UpdateScore then
        remotes.UpdateScore:FireClient(player, gems.Value)
    end
end

-- Gérer la collection d'une gemme
local function CollectGem(gem, character)
    print("🔍 CollectGem appelée pour", gem.Name)
    local humanoid = character:FindFirstChild("Humanoid")
    if not humanoid or humanoid.Health <= 0 then 
        print("❌ Pas d'humanoid ou humanoid mort")
        return 
    end
    
    local player = Players:GetPlayerFromCharacter(character)
    if not player then 
        print("❌ Pas de joueur trouvé")
        return 
    end
    
    -- Récupérer les données de la gemme
    local gemData = gem:FindFirstChild("GemData")
    if not gemData then 
        print("❌ Pas de GemData")
        return 
    end
    
    local points = gemData:FindFirstChild("Points")
    local gemType = gemData:FindFirstChild("Type")
    if not points or not gemType then 
        print("❌ Points ou Type manquant")
        return 
    end
    
    print("✅ Gemme valide:", gemType.Value, "Points:", points.Value)
    
    -- Mettre à jour le score
    local leaderstats = player:FindFirstChild("leaderstats")
    if leaderstats then
        local gems = leaderstats:FindFirstChild("Gems")
        if gems then
            gems.Value = gems.Value + points.Value
            print("💎 Score mis à jour:", gems.Value)
            
            -- Notifier le client
            if remotes and remotes.GemCollected and remotes.UpdateScore then
                print("📡 Envoi des événements au client")
                remotes.GemCollected:FireClient(player, gemType.Value, points.Value)
                remotes.UpdateScore:FireClient(player, gems.Value)
            end
        end
    end
    
    -- Supprimer la gemme de la liste active
    for i, activeGem in ipairs(activeGems) do
        if activeGem == gem then
            table.remove(activeGems, i)
            break
        end
    end
    
    -- Détruire la gemme avec un effet
    -- Recherche manuelle du ParticleEmitter au lieu de FindFirstDescendant
    local function findParticleEmitter(parent)
        for _, child in pairs(parent:GetChildren()) do
            if child:IsA("ParticleEmitter") then
                return child
            elseif child:IsA("Attachment") then
                for _, subchild in pairs(child:GetChildren()) do
                    if subchild:IsA("ParticleEmitter") then
                        return subchild
                    end
                end
            end
        end
        return nil
end
    end
    
    local particleEmitter = findParticleEmitter(gem)
    if particleEmitter then
        particleEmitter.Rate = 100
        particleEmitter:Emit(50)
    end
    
    gem.Transparency = 1
    gem.CanCollide = false
    Debris:AddItem(gem, 0.5)
end

-- Faire apparaître une gemme
local function SpawnGem()
    -- Vérifier si gemsFolder existe
    if not gemsFolder then
        warn("❌ gemsFolder est nil!")
        return
    end
    
    -- Choisir un type de gemme aléatoire
    local gemType = GemSystem.GetRandomGemType()
    print("🎲 Spawn d'une gemme:", gemType.name)
    
    -- Créer la gemme
    local gem = GemSystem.CreateGem(gemType)
    if not gem then
        warn("❌ Échec de création de la gemme!")
        return
    end
    
    local position = GemSystem.GetRandomSpawnPosition()
    gem.Position = position
    gem.Parent = gemsFolder
    -- Configurer la détection de collision avec debounce
    local debounce = false
    gem.Touched:Connect(function(hit)
        if debounce then return end
        local character = hit.Parent
        if character and character:FindFirstChild("Humanoid") then
            -- Éviter les collections multiples
            if gem.Parent then
                debounce = true
                gem.Parent = nil
                CollectGem(gem, character)
            end
        end
    end)
    
    -- Supprimer automatiquement après un certain temps
    Debris:AddItem(gem, GemSystem.Config.GemLifetime)
    
    
    -- Ajouter la gemme à la liste active
    table.insert(activeGems, gem)
end

-- Animation des gemmes (rotation et flottement)
local function AnimateGems()
    RunService.Heartbeat:Connect(function(deltaTime)
        for _, gem in ipairs(activeGems) do
            if gem and gem.Parent then
                -- Rotation
                gem.CFrame = gem.CFrame * CFrame.Angles(0, deltaTime * GemSystem.Config.RotationSpeed, 0)
                
                -- Flottement sinusoïdal
                local time = tick()
                local basePosition = gem.Position
                local floatOffset = math.sin(time * 2 + gem.Position.X) * 0.5
                gem.Position = Vector3.new(basePosition.X, basePosition.Y + floatOffset * deltaTime, basePosition.Z)
            end
        end
    end)
end
local function StartGemSpawning()
    print("🚀 Début du spawn des gemmes...")
    print("📊 Config: Interval =", GemSystem.Config.SpawnInterval, "| Lifetime =", GemSystem.Config.GemLifetime)
    while true do
        SpawnGem()
        task.wait(GemSystem.Config.SpawnInterval)
    end
end

-- Événements des joueurs
Players.PlayerAdded:Connect(function(player)
    SetupLeaderstats(player)
    print("👋 " .. player.Name .. " a rejoint le jeu!")
end)

Players.PlayerRemoving:Connect(function(player)
    print("👋 " .. player.Name .. " a quitté le jeu!")
end)

-- Démarrer le jeu
Initialize()
AnimateGems()
task.spawn(StartGemSpawning)

print("🚀 Serveur du Collecteur de Gemmes démarré!")