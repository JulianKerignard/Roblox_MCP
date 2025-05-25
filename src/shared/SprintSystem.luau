-- Module de système de sprint
local SprintSystem = {}

-- Configuration du sprint
SprintSystem.Config = {
    -- Vitesse normale et de sprint
    NormalSpeed = 16,
    SprintSpeed = 28,
    
    -- Stamina
    MaxStamina = 100,
    StaminaDrainRate = 20, -- Stamina perdue par seconde en sprint
    StaminaRegenRate = 15, -- Stamina récupérée par seconde au repos
    StaminaRegenDelay = 1, -- Délai avant régénération après sprint (en secondes)
    
    -- Touches
    SprintKey = Enum.KeyCode.LeftShift,
    
    -- Effets visuels
    EnableFOVEffect = true,
    NormalFOV = 70,
    SprintFOV = 80,
    FOVTransitionTime = 0.3,
    
    -- Sons (optionnel)
    EnableSounds = true
}

-- Variables internes
local currentStamina = SprintSystem.Config.MaxStamina
local isSprinting = false
local canSprint = true
local lastSprintTime = 0

-- Obtenir la stamina actuelle
function SprintSystem.GetStamina()
    return currentStamina
end

-- Obtenir le pourcentage de stamina
function SprintSystem.GetStaminaPercentage()
    return currentStamina / SprintSystem.Config.MaxStamina
end

-- Vérifier si le joueur peut sprinter
function SprintSystem.CanSprint()
    return canSprint and currentStamina > 0
end

-- Commencer le sprint
function SprintSystem.StartSprint(humanoid)
    if not SprintSystem.CanSprint() or isSprinting then
        return false
    end
    
    isSprinting = true
    humanoid.WalkSpeed = SprintSystem.Config.SprintSpeed
    return true
end

-- Arrêter le sprint
function SprintSystem.StopSprint(humanoid)
    if not isSprinting then
        return false
    end
    
    isSprinting = false
    lastSprintTime = tick()
    humanoid.WalkSpeed = SprintSystem.Config.NormalSpeed
    return true
end

-- Mettre à jour la stamina (appelé chaque frame)
function SprintSystem.UpdateStamina(deltaTime, humanoid)
    local currentTime = tick()
    local character = humanoid.Parent
    local rootPart = character:FindFirstChild("HumanoidRootPart")
    
    -- Vérifier si le joueur bouge en regardant sa vélocité
    local isMoving = false
    if rootPart then
        local velocity = rootPart.AssemblyLinearVelocity
        local horizontalVelocity = Vector3.new(velocity.X, 0, velocity.Z).Magnitude
        isMoving = horizontalVelocity > 0.1
    end
    
    if isSprinting and isMoving then
        -- Drainer la stamina pendant le sprint
        currentStamina = math.max(0, currentStamina - SprintSystem.Config.StaminaDrainRate * deltaTime)
        
        -- Arrêter le sprint si plus de stamina
        if currentStamina <= 0 then
            SprintSystem.StopSprint(humanoid)
            canSprint = false
        end
    else
        -- Régénérer la stamina après le délai
        if currentTime - lastSprintTime >= SprintSystem.Config.StaminaRegenDelay then
            currentStamina = math.min(SprintSystem.Config.MaxStamina, 
                currentStamina + SprintSystem.Config.StaminaRegenRate * deltaTime)
            
            -- Réactiver le sprint quand on a assez de stamina
            if currentStamina >= 10 and not canSprint then
                canSprint = true
            end
        end
    end
    
    return currentStamina
end

-- Réinitialiser le système
function SprintSystem.Reset()
    currentStamina = SprintSystem.Config.MaxStamina
    isSprinting = false
    canSprint = true
    lastSprintTime = 0
end

-- Obtenir l'état du sprint
function SprintSystem.IsSprinting()
    return isSprinting
end

return SprintSystem
