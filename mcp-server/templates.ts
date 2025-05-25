export interface LuauTemplate {
  name: string;
  description: string;
  category: 'event' | 'service' | 'data' | 'ui' | 'utility' | 'pattern';
  code: string;
  variables?: string[]; // Variables à remplacer
}

export const luauTemplates: LuauTemplate[] = [
  // === REMOTE EVENTS ===
  {
    name: "remote-event-server",
    description: "Configuration RemoteEvent côté serveur",
    category: "event",
    code: `-- RemoteEvent Server Setup
local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- Créer le RemoteEvent
local {{eventName}} = Instance.new("RemoteEvent")
{{eventName}}.Name = "{{eventName}}"
{{eventName}}.Parent = ReplicatedStorage

-- Gestionnaire d'événement
{{eventName}}.OnServerEvent:Connect(function(player, {{parameters}})
    -- Valider les données reçues
    if not player or not player.Parent then return end
    
    -- Logique du serveur ici
    print(player.Name .. " a déclenché " .. {{eventName}}.Name)
    
    -- Répondre au client si nécessaire
    {{eventName}}:FireClient(player, {success = true})
end)`,
    variables: ["eventName", "parameters"]
  },
  
  {
    name: "remote-event-client",
    description: "Configuration RemoteEvent côté client",
    category: "event",
    code: `-- RemoteEvent Client Setup
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local player = Players.LocalPlayer
local {{eventName}} = ReplicatedStorage:WaitForChild("{{eventName}}")

-- Envoyer au serveur
local function send{{eventName}}({{parameters}})
    {{eventName}}:FireServer({{parameters}})
end

-- Recevoir du serveur
{{eventName}}.OnClientEvent:Connect(function(data)
    print("Reçu du serveur:", data)
end)`,
    variables: ["eventName", "parameters"]
  },

  // === TWEEN SERVICE ===
  {
    name: "tween-animation",
    description: "Animation fluide avec TweenService",
    category: "service",
    code: `-- TweenService Animation
local TweenService = game:GetService("TweenService")

local {{object}} = {{targetObject}}
local tweenInfo = TweenInfo.new(
    {{duration}}, -- Durée en secondes
    Enum.EasingStyle.{{easingStyle}}, -- Style d'animation
    Enum.EasingDirection.{{easingDirection}}, -- Direction
    {{repeatCount}}, -- Nombre de répétitions (-1 = infini)
    {{reverses}}, -- Inverser l'animation
    {{delayTime}} -- Délai avant de commencer
)

local goal = {
    {{property}} = {{targetValue}}
}

local tween = TweenService:Create({{object}}, tweenInfo, goal)

-- Événements
tween.Completed:Connect(function()
    print("Animation terminée")
end)

-- Démarrer l'animation
tween:Play()`,
    variables: ["object", "targetObject", "duration", "easingStyle", "easingDirection", "repeatCount", "reverses", "delayTime", "property", "targetValue"]
  },

  // === DATA STORES ===
  {
    name: "datastore-setup",
    description: "Configuration DataStore avec gestion d'erreurs",
    category: "data",
    code: `-- DataStore Setup with Error Handling
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local {{storeName}} = DataStoreService:GetDataStore("{{storeName}}")

-- Charger les données du joueur
local function loadPlayerData(player)
    local key = "Player_" .. player.UserId
    
    local success, data = pcall(function()
        return {{storeName}}:GetAsync(key)
    end)
    
    if success then
        if data then
            -- Données trouvées
            return data
        else
            -- Nouvelles données par défaut
            return {
                {{defaultData}}
            }
        end
    else
        warn("Erreur de chargement pour " .. player.Name .. ": " .. tostring(data))
        return nil
    end
end

-- Sauvegarder les données du joueur
local function savePlayerData(player, data)
    local key = "Player_" .. player.UserId
    
    local success, errorMessage = pcall(function()
        {{storeName}}:SetAsync(key, data)
    end)
    
    if not success then
        warn("Erreur de sauvegarde pour " .. player.Name .. ": " .. errorMessage)
    end
end

-- Auto-save toutes les 60 secondes
local function autoSave()
    while true do
        wait(60)
        for _, player in ipairs(Players:GetPlayers()) do
            -- Sauvegarder les données du joueur
            local data = {} -- Récupérer les données actuelles
            savePlayerData(player, data)
        end
    end
end

spawn(autoSave)`,
    variables: ["storeName", "defaultData"]
  },

  // === UI PATTERNS ===
  {
    name: "ui-button-handler",
    description: "Gestionnaire de bouton UI avec effets",
    category: "ui",
    code: `-- UI Button Handler with Effects
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local {{button}} = {{buttonPath}}

-- Sons (optionnel)
local clickSound = nil -- Ajouter un son si nécessaire

-- Hover Effect
local originalSize = {{button}}.Size
local hoverSize = UDim2.new(
    originalSize.X.Scale * 1.1,
    originalSize.X.Offset,
    originalSize.Y.Scale * 1.1,
    originalSize.Y.Offset
)

-- Tweens
local hoverTween = TweenService:Create(
    {{button}},
    TweenInfo.new(0.2, Enum.EasingStyle.Quad),
    {Size = hoverSize}
)

local unhoverTween = TweenService:Create(
    {{button}},
    TweenInfo.new(0.2, Enum.EasingStyle.Quad),
    {Size = originalSize}
)

-- Events
{{button}}.MouseEnter:Connect(function()
    hoverTween:Play()
end)

{{button}}.MouseLeave:Connect(function()
    unhoverTween:Play()
end)

{{button}}.Activated:Connect(function()
    -- Effet de clic
    local clickTween = TweenService:Create(
        {{button}},
        TweenInfo.new(0.1, Enum.EasingStyle.Back),
        {Size = originalSize}
    )
    clickTween:Play()
    
    -- Son de clic
    if clickSound then
        clickSound:Play()
    end
    
    -- Action du bouton
    {{buttonAction}}
end)`,
    variables: ["button", "buttonPath", "buttonAction"]
  },

  // === UTILITY PATTERNS ===
  {
    name: "debounce-pattern",
    description: "Pattern de debounce pour éviter le spam",
    category: "pattern",
    code: `-- Debounce Pattern
local debounce = false
local COOLDOWN = {{cooldownTime}} -- Temps en secondes

local function {{functionName}}()
    if debounce then
        return -- Déjà en cours
    end
    
    debounce = true
    
    -- Code à exécuter
    {{actionCode}}
    
    -- Attendre avant de permettre une nouvelle exécution
    wait(COOLDOWN)
    debounce = false
end`,
    variables: ["cooldownTime", "functionName", "actionCode"]
  },

  {
    name: "spawn-loop",
    description: "Boucle de spawn avec gestion de vie",
    category: "pattern",
    code: `-- Spawn Loop Pattern
local RunService = game:GetService("RunService")
local Debris = game:GetService("Debris")

local SPAWN_INTERVAL = {{spawnInterval}} -- Secondes entre chaque spawn
local MAX_OBJECTS = {{maxObjects}}
local OBJECT_LIFETIME = {{objectLifetime}} -- Durée de vie en secondes

local spawnedObjects = {}

local function spawn{{objectType}}()
    if #spawnedObjects >= MAX_OBJECTS then
        return -- Limite atteinte
    end
    
    -- Créer l'objet
    local object = {{createObject}}
    
    -- Position aléatoire
    object.Position = Vector3.new(
        math.random(-50, 50),
        10,
        math.random(-50, 50)
    )
    
    -- Ajouter à la liste
    table.insert(spawnedObjects, object)
    
    -- Nettoyer après la durée de vie
    Debris:AddItem(object, OBJECT_LIFETIME)
    
    -- Retirer de la liste quand détruit
    object.AncestryChanged:Connect(function()
        if not object.Parent then
            for i, obj in ipairs(spawnedObjects) do
                if obj == object then
                    table.remove(spawnedObjects, i)
                    break
                end
            end
        end
    end)
end

-- Boucle de spawn
while true do
    spawn{{objectType}}()
    wait(SPAWN_INTERVAL)
end`,
    variables: ["spawnInterval", "maxObjects", "objectLifetime", "objectType", "createObject"]
  },

  // === LEADERSTATS ===
  {
    name: "leaderstats-setup",
    description: "Configuration complète des leaderstats",
    category: "utility",
    code: `-- Leaderstats Setup
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

local statsToTrack = {
    {{statsConfig}} -- Ex: {name = "Points", default = 0}, {name = "Level", default = 1}
}

local function createLeaderstats(player)
    -- Créer le dossier leaderstats
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"
    leaderstats.Parent = player
    
    -- Créer chaque stat
    for _, statConfig in ipairs(statsToTrack) do
        local stat = Instance.new("IntValue")
        stat.Name = statConfig.name
        stat.Value = statConfig.default
        stat.Parent = leaderstats
    end
    
    return leaderstats
end

Players.PlayerAdded:Connect(function(player)
    local leaderstats = createLeaderstats(player)
    
    -- Charger les données sauvegardées si nécessaire
    -- loadPlayerStats(player, leaderstats)
end)`,
    variables: ["statsConfig"]
  },

  // === RAYCAST PATTERN ===
  {
    name: "raycast-detection",
    description: "Détection par raycast pour tir ou vision",
    category: "utility",
    code: `-- Raycast Detection Pattern
local function performRaycast(origin, direction, filterList, filterType)
    local raycastParams = RaycastParams.new()
    raycastParams.FilterDescendantsInstances = filterList or {}
    raycastParams.FilterType = filterType or Enum.RaycastFilterType.Blacklist
    
    local raycastResult = workspace:Raycast(origin, direction, raycastParams)
    
    if raycastResult then
        return {
            hit = true,
            instance = raycastResult.Instance,
            position = raycastResult.Position,
            normal = raycastResult.Normal,
            material = raycastResult.Material,
            distance = (origin - raycastResult.Position).Magnitude
        }
    else
        return {
            hit = false
        }
    end
end

-- Exemple d'utilisation
local origin = {{originPosition}}
local direction = {{targetPosition}} - origin
local maxDistance = {{maxDistance}}

-- Normaliser et limiter la direction
direction = direction.Unit * math.min(direction.Magnitude, maxDistance)

local result = performRaycast(origin, direction, {{{ignoreList}}})

if result.hit then
    print("Touché:", result.instance.Name)
    print("Distance:", result.distance)
end`,
    variables: ["originPosition", "targetPosition", "maxDistance", "ignoreList"]
  }
];

// Fonction pour récupérer un template
export function getTemplate(name: string): LuauTemplate | undefined {
  return luauTemplates.find(t => t.name === name);
}

// Fonction pour lister les templates par catégorie
export function getTemplatesByCategory(category: string): LuauTemplate[] {
  return luauTemplates.filter(t => t.category === category);
}

// Fonction pour remplacer les variables dans un template
export function applyTemplate(template: LuauTemplate, variables: Record<string, string>): string {
  let code = template.code;
  
  // Remplacer chaque variable
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    code = code.replace(regex, value);
  }
  
  return code;
}