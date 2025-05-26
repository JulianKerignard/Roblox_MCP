-- Interface client moderne pour le jeu Collecteur de Gemmes
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterGui = game:GetService("StarterGui")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Lighting = game:GetService("Lighting")

-- Attendre que le jeu soit chargé
local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Charger les modules
local GemSystem = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("GemSystem"))
local ShopSystem = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("ShopSystem"))
local SprintSystem = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("SprintSystem"))
local TrailSystem = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("TrailSystem"))

-- Variables globales
local gui = nil
local currentScore = 0
local camera = workspace.CurrentCamera

-- Configuration des couleurs
local COLORS = {
    primary = Color3.fromRGB(45, 45, 55),
    secondary = Color3.fromRGB(35, 35, 45),
    accent = Color3.fromRGB(100, 200, 255),
    gold = Color3.fromRGB(255, 215, 0),
    success = Color3.fromRGB(100, 255, 150),
    danger = Color3.fromRGB(255, 100, 100),
    text = {
        primary = Color3.new(1, 1, 1),
        secondary = Color3.fromRGB(200, 200, 200),
        muted = Color3.fromRGB(150, 150, 150)
    }
}

-- === SYSTÈME D'INTERFACE MODULAIRE ===

-- Module pour créer des éléments UI réutilisables
local UIComponents = {}

function UIComponents.CreateFrame(props)
    local frame = Instance.new("Frame")
    frame.BackgroundColor3 = props.color or COLORS.primary
    frame.BorderSizePixel = 0
    frame.Size = props.size
    frame.Position = props.position
    frame.BackgroundTransparency = props.transparency or 0
    
    if props.gradient then
        local gradient = Instance.new("UIGradient")
        gradient.Color = props.gradient
        gradient.Rotation = props.gradientRotation or 90
        gradient.Parent = frame
    end
    
    if props.cornerRadius then
        local corner = Instance.new("UICorner")
        corner.CornerRadius = UDim.new(0, props.cornerRadius)
        corner.Parent = frame
    end
    
    if props.stroke then
        local stroke = Instance.new("UIStroke")
        stroke.Color = props.stroke.color or COLORS.accent
        stroke.Thickness = props.stroke.thickness or 2
        stroke.Transparency = props.stroke.transparency or 0.5
        stroke.Parent = frame
    end
    
    return frame
end

function UIComponents.CreateText(props)
    local label = Instance.new("TextLabel")
    label.BackgroundTransparency = 1
    label.Size = props.size
    label.Position = props.position
    label.Text = props.text or ""
    label.Font = props.font or Enum.Font.Gotham
    label.TextColor3 = props.color or COLORS.text.primary
    label.TextScaled = props.scaled ~= false
    if props.xAlignment then
        label.TextXAlignment = props.xAlignment
    end
    if props.yAlignment then
        label.TextYAlignment = props.yAlignment
    end
    
    if props.stroke then
        label.TextStrokeTransparency = props.stroke.transparency or 0.8
        label.TextStrokeColor3 = props.stroke.color or Color3.new(0, 0, 0)
    end
    
    return label
end

function UIComponents.CreateButton(props)
    local button = Instance.new("TextButton")
    button.BackgroundColor3 = props.color or COLORS.accent
    button.BorderSizePixel = 0
    button.Size = props.size
    button.Position = props.position
    button.Text = props.text or ""
    button.Font = props.font or Enum.Font.GothamBold
    button.TextColor3 = props.textColor or COLORS.text.primary
    button.TextScaled = true
    button.AutoButtonColor = false
    
    if props.cornerRadius then
        local corner = Instance.new("UICorner")
        corner.CornerRadius = UDim.new(0, props.cornerRadius)
        corner.Parent = button
    end
    
    -- Effets de survol
    local originalColor = button.BackgroundColor3
    button.MouseEnter:Connect(function()
        TweenService:Create(button, TweenInfo.new(0.2), {
            BackgroundColor3 = props.hoverColor or originalColor:Lerp(Color3.new(1, 1, 1), 0.2)
        }):Play()
    end)
    
    button.MouseLeave:Connect(function()
        TweenService:Create(button, TweenInfo.new(0.2), {
            BackgroundColor3 = originalColor
        }):Play()
    end)
    
    return button
end

-- === MODULE HUD PRINCIPAL ===
local HUD = {}

function HUD.Create()
    -- Container principal centré en bas
    local hudContainer = UIComponents.CreateFrame({
        size = UDim2.new(0, 400, 0, 120),
        position = UDim2.new(0.5, -200, 1, -140),
        cornerRadius = 20,
        gradient = ColorSequence.new({
            ColorSequenceKeypoint.new(0, COLORS.primary),
            ColorSequenceKeypoint.new(1, COLORS.secondary)
        }),
        stroke = {
            color = COLORS.accent,
            thickness = 2,
            transparency = 0.5
        }
    })
    hudContainer.Name = "HUDContainer"
    hudContainer.Parent = gui
    
    -- Conteneur pour les stats
    local statsContainer = Instance.new("Frame")
    statsContainer.Size = UDim2.new(1, -20, 1, -20)
    statsContainer.Position = UDim2.new(0, 10, 0, 10)
    statsContainer.BackgroundTransparency = 1
    statsContainer.Parent = hudContainer
    
    -- Score
    local scoreContainer = Instance.new("Frame")
    scoreContainer.Size = UDim2.new(0.5, -5, 0.6, 0)
    scoreContainer.Position = UDim2.new(0, 0, 0, 0)
    scoreContainer.BackgroundTransparency = 1
    scoreContainer.Parent = statsContainer
    
    local gemIcon = UIComponents.CreateText({
        size = UDim2.new(0, 40, 0, 40),
        position = UDim2.new(0, 0, 0, 0),
        text = "💎",
        font = Enum.Font.SourceSansBold,
        scaled = true
    })
    gemIcon.Parent = scoreContainer
    
    HUD.scoreLabel = UIComponents.CreateText({
        size = UDim2.new(1, -50, 0, 30),
        position = UDim2.new(0, 50, 0, 0),
        text = "0",
        font = Enum.Font.GothamBold,
        color = COLORS.text.primary,
        xAlignment = Enum.TextXAlignment.Left
    })
    HUD.scoreLabel.Parent = scoreContainer
    
    local scoreSubtext = UIComponents.CreateText({
        size = UDim2.new(1, -50, 0, 20),
        position = UDim2.new(0, 50, 0, 25),
        text = "gemmes collectées",
        font = Enum.Font.Gotham,
        color = COLORS.text.muted,
        xAlignment = Enum.TextXAlignment.Left
    })
    scoreSubtext.TextScaled = false
    scoreSubtext.TextSize = 14
    scoreSubtext.Parent = scoreContainer
    
    -- Objectif
    local objectiveContainer = Instance.new("Frame")
    objectiveContainer.Size = UDim2.new(0.5, -5, 0.6, 0)
    objectiveContainer.Position = UDim2.new(0.5, 5, 0, 0)
    objectiveContainer.BackgroundTransparency = 1
    objectiveContainer.Parent = statsContainer
    
    HUD.objectiveLabel = UIComponents.CreateText({
        size = UDim2.new(1, 0, 0, 30),
        position = UDim2.new(0, 0, 0, 0),
        text = "10",
        font = Enum.Font.GothamBold,
        color = COLORS.gold,
        xAlignment = Enum.TextXAlignment.Right
    })
    HUD.objectiveLabel.Parent = objectiveContainer
    
    local objectiveSubtext = UIComponents.CreateText({
        size = UDim2.new(1, 0, 0, 20),
        position = UDim2.new(0, 0, 0, 25),
        text = "prochain objectif",
        font = Enum.Font.Gotham,
        color = COLORS.text.muted,
        xAlignment = Enum.TextXAlignment.Right
    })
    objectiveSubtext.TextScaled = false
    objectiveSubtext.TextSize = 14
    objectiveSubtext.Parent = objectiveContainer
    
    -- Barre de progression
    local progressContainer = UIComponents.CreateFrame({
        size = UDim2.new(1, 0, 0, 12),
        position = UDim2.new(0, 0, 1, -25),
        color = Color3.fromRGB(25, 25, 35),
        cornerRadius = 6
    })
    progressContainer.Parent = statsContainer
    
    HUD.progressBar = UIComponents.CreateFrame({
        size = UDim2.new(0, 0, 1, 0),
        position = UDim2.new(0, 0, 0, 0),
        color = COLORS.accent,
        cornerRadius = 6,
        gradient = ColorSequence.new({
            ColorSequenceKeypoint.new(0, COLORS.accent),
            ColorSequenceKeypoint.new(1, COLORS.accent:Lerp(COLORS.success, 0.5))
        }),
        gradientRotation = 0
    })
    HUD.progressBar.Parent = progressContainer
    
    -- Animation d'entrée
    hudContainer.Position = UDim2.new(0.5, -200, 1, 20)
    TweenService:Create(hudContainer, TweenInfo.new(0.8, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
        Position = UDim2.new(0.5, -200, 1, -140)
    }):Play()
    
    return hudContainer
end

function HUD.UpdateScore(score)
    if HUD.scoreLabel then
        HUD.scoreLabel.Text = tostring(score)
        
        -- Animation de mise à jour
        local tween = TweenService:Create(HUD.scoreLabel, TweenInfo.new(0.1, Enum.EasingStyle.Quad), {
            TextTransparency = 0.3
        })
        tween:Play()
        tween.Completed:Connect(function()
            TweenService:Create(HUD.scoreLabel, TweenInfo.new(0.1), {
                TextTransparency = 0
            }):Play()
        end)
    end
    
    -- Mettre à jour l'objectif et la progression
    local nextObjective = GemSystem.GetNextObjective(score)
    if HUD.objectiveLabel then
        HUD.objectiveLabel.Text = tostring(nextObjective)
    end
    
    -- Calculer la progression
    local previousObjective = 0
    for _, obj in ipairs(GemSystem.Objectives) do
        if obj <= score then
            previousObjective = obj
        else
            break
        end
    end
    
    local progress = 0
    if nextObjective > previousObjective then
        progress = (score - previousObjective) / (nextObjective - previousObjective)
    end
    
    if HUD.progressBar then
        TweenService:Create(HUD.progressBar, TweenInfo.new(0.5, Enum.EasingStyle.Quad), {
            Size = UDim2.new(progress, 0, 1, 0)
        }):Play()
    end
end

-- === MODULE STAMINA ===
local StaminaUI = {}

function StaminaUI.Create()
    local staminaContainer = UIComponents.CreateFrame({
        size = UDim2.new(0, 250, 0, 60),
        position = UDim2.new(0, 20, 1, -90),
        cornerRadius = 15,
        gradient = ColorSequence.new({
            ColorSequenceKeypoint.new(0, COLORS.primary),
            ColorSequenceKeypoint.new(1, COLORS.secondary)
        })
    })
    staminaContainer.Name = "StaminaContainer"
    staminaContainer.Parent = gui
    
    local content = Instance.new("Frame")
    content.Size = UDim2.new(1, -20, 1, -20)
    content.Position = UDim2.new(0, 10, 0, 10)
    content.BackgroundTransparency = 1
    content.Parent = staminaContainer
    
    -- Icône et titre
    local titleContainer = Instance.new("Frame")
    titleContainer.Size = UDim2.new(1, 0, 0, 20)
    titleContainer.BackgroundTransparency = 1
    titleContainer.Parent = content
    
    local icon = UIComponents.CreateText({
        size = UDim2.new(0, 20, 0, 20),
        position = UDim2.new(0, 0, 0, 0),
        text = "⚡",
        font = Enum.Font.SourceSansBold
    })
    icon.Parent = titleContainer
    
    local title = UIComponents.CreateText({
        size = UDim2.new(1, -30, 1, 0),
        position = UDim2.new(0, 25, 0, 0),
        text = "STAMINA",
        font = Enum.Font.GothamBold,
        color = COLORS.text.secondary,
        xAlignment = Enum.TextXAlignment.Left
    })
    title.TextScaled = false
    title.TextSize = 14
    title.Parent = titleContainer
    
    local hint = UIComponents.CreateText({
        size = UDim2.new(0, 50, 1, 0),
        position = UDim2.new(1, -50, 0, 0),
        text = "[SHIFT]",
        font = Enum.Font.Gotham,
        color = COLORS.text.muted,
        xAlignment = Enum.TextXAlignment.Right
    })
    hint.TextScaled = false
    hint.TextSize = 12
    hint.Parent = titleContainer
    
    -- Barre de stamina
    local barBg = UIComponents.CreateFrame({
        size = UDim2.new(1, 0, 0, 10),
        position = UDim2.new(0, 0, 1, -15),
        color = Color3.fromRGB(25, 25, 35),
        cornerRadius = 5
    })
    barBg.Parent = content
    
    StaminaUI.bar = UIComponents.CreateFrame({
        size = UDim2.new(1, 0, 1, 0),
        position = UDim2.new(0, 0, 0, 0),
        color = COLORS.accent,
        cornerRadius = 5,
        gradient = ColorSequence.new({
            ColorSequenceKeypoint.new(0, Color3.fromRGB(150, 220, 255)),
            ColorSequenceKeypoint.new(1, Color3.fromRGB(50, 150, 200))
        }),
        gradientRotation = 0
    })
    StaminaUI.bar.Parent = barBg
    
    return staminaContainer
end

function StaminaUI.Update()
    if StaminaUI.bar then
        local percentage = SprintSystem.GetStaminaPercentage()
        TweenService:Create(StaminaUI.bar, TweenInfo.new(0.1), {
            Size = UDim2.new(percentage, 0, 1, 0)
        }):Play()
        
        -- Changer la couleur selon le niveau
        local color
        if percentage > 0.6 then
            color = COLORS.accent
        elseif percentage > 0.3 then
            color = Color3.fromRGB(255, 200, 100)
        else
            color = COLORS.danger
        end
        
        TweenService:Create(StaminaUI.bar, TweenInfo.new(0.3), {
            BackgroundColor3 = color
        }):Play()
    end
end

-- === MODULE NOTIFICATIONS ===
local NotificationSystem = {}
NotificationSystem.queue = {}
NotificationSystem.active = {}

function NotificationSystem.Create(text, icon, color, duration)
    local notification = UIComponents.CreateFrame({
        size = UDim2.new(0, 350, 0, 70),
        position = UDim2.new(0.5, -175, 0, -100),
        cornerRadius = 15,
        gradient = ColorSequence.new({
            ColorSequenceKeypoint.new(0, COLORS.primary),
            ColorSequenceKeypoint.new(1, COLORS.secondary)
        }),
        stroke = {
            color = color or COLORS.accent,
            thickness = 2,
            transparency = 0
        }
    })
    notification.Parent = gui
    
    -- Contenu
    local content = Instance.new("Frame")
    content.Size = UDim2.new(1, -20, 1, -20)
    content.Position = UDim2.new(0, 10, 0, 10)
    content.BackgroundTransparency = 1
    content.Parent = notification
    
    if icon then
        local iconLabel = UIComponents.CreateText({
            size = UDim2.new(0, 50, 1, 0),
            position = UDim2.new(0, 0, 0, 0),
            text = icon,
            font = Enum.Font.SourceSansBold
        })
        iconLabel.Parent = content
    end
    
    local textLabel = UIComponents.CreateText({
        size = icon and UDim2.new(1, -60, 1, 0) or UDim2.new(1, 0, 1, 0),
        position = icon and UDim2.new(0, 60, 0, 0) or UDim2.new(0, 0, 0, 0),
        text = text,
        font = Enum.Font.GothamMedium,
        xAlignment = Enum.TextXAlignment.Left
    })
    textLabel.Parent = content
    
    -- Animation d'entrée
    notification.Position = UDim2.new(0.5, -175, 0, -100)
    local targetY = 20 + (#NotificationSystem.active * 80)
    
    TweenService:Create(notification, TweenInfo.new(0.5, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
        Position = UDim2.new(0.5, -175, 0, targetY)
    }):Play()
    
    table.insert(NotificationSystem.active, notification)
    
    -- Auto-destruction
    task.wait(duration or 3)
    
    -- Animation de sortie
    TweenService:Create(notification, TweenInfo.new(0.3, Enum.EasingStyle.Quad), {
        Position = UDim2.new(0.5, -175, 0, -100),
        BackgroundTransparency = 1
    }):Play()
    
    for _, desc in pairs(notification:GetDescendants()) do
        if desc:IsA("TextLabel") then
            TweenService:Create(desc, TweenInfo.new(0.3), {TextTransparency = 1}):Play()
        elseif desc:IsA("UIStroke") then
            TweenService:Create(desc, TweenInfo.new(0.3), {Transparency = 1}):Play()
        end
    end
    
    task.wait(0.3)
    
    -- Retirer de la liste et réorganiser
    local index = table.find(NotificationSystem.active, notification)
    if index then
        table.remove(NotificationSystem.active, index)
        
        -- Réorganiser les notifications restantes
        for i, notif in ipairs(NotificationSystem.active) do
            TweenService:Create(notif, TweenInfo.new(0.3, Enum.EasingStyle.Quad), {
                Position = UDim2.new(0.5, -175, 0, 20 + ((i-1) * 80))
            }):Play()
        end
    end
    
    notification:Destroy()
end

-- === MODULE BOUTIQUE ===
local ShopUI = {}
ShopUI.isOpen = false
ShopUI.ownedItems = {}
ShopUI.equippedItems = {}
ShopUI.selectedCategory = "Trails"

function ShopUI.Create()
    -- Overlay sombre
    ShopUI.overlay = UIComponents.CreateFrame({
        size = UDim2.new(1, 0, 1, 0),
        position = UDim2.new(0, 0, 0, 0),
        color = Color3.new(0, 0, 0),
        transparency = 0.5
    })
    ShopUI.overlay.Visible = false
    ShopUI.overlay.Parent = gui
    
    -- Container principal
    ShopUI.container = UIComponents.CreateFrame({
        size = UDim2.new(0.9, 0, 0.9, 0),
        position = UDim2.new(0.05, 0, 0.05, 0),
        cornerRadius = 20,
        gradient = ColorSequence.new({
            ColorSequenceKeypoint.new(0, COLORS.primary),
            ColorSequenceKeypoint.new(1, COLORS.secondary)
        })
    })
    ShopUI.container.Visible = false
    ShopUI.container.Parent = gui
    
    -- Header
    local header = UIComponents.CreateFrame({
        size = UDim2.new(1, 0, 0, 80),
        position = UDim2.new(0, 0, 0, 0),
        color = COLORS.secondary,
        cornerRadius = 20
    })
    header.Parent = ShopUI.container
    
    local headerContent = Instance.new("Frame")
    headerContent.Size = UDim2.new(1, -40, 1, -20)
    headerContent.Position = UDim2.new(0, 20, 0, 10)
    headerContent.BackgroundTransparency = 1
    headerContent.Parent = header
    
    local title = UIComponents.CreateText({
        size = UDim2.new(0.5, 0, 1, 0),
        position = UDim2.new(0, 0, 0, 0),
        text = "🛍️ BOUTIQUE MAGIQUE",
        font = Enum.Font.GothamBold,
        color = COLORS.gold,
        xAlignment = Enum.TextXAlignment.Left
    })
    title.TextScaled = false
    title.TextSize = 28
    title.Parent = headerContent
    
    -- Affichage des gemmes
    ShopUI.gemsDisplay = UIComponents.CreateFrame({
        size = UDim2.new(0, 200, 0, 50),
        position = UDim2.new(0.5, -100, 0.5, -25),
        cornerRadius = 25,
        color = COLORS.primary
    })
    ShopUI.gemsDisplay.Parent = headerContent
    
    local gemsContent = Instance.new("Frame")
    gemsContent.Size = UDim2.new(1, -20, 1, 0)
    gemsContent.Position = UDim2.new(0, 10, 0, 0)
    gemsContent.BackgroundTransparency = 1
    gemsContent.Parent = ShopUI.gemsDisplay
    
    local gemIcon = UIComponents.CreateText({
        size = UDim2.new(0, 40, 1, 0),
        position = UDim2.new(0, 0, 0, 0),
        text = "💎",
        font = Enum.Font.SourceSansBold
    })
    gemIcon.Parent = gemsContent
    
    ShopUI.gemsLabel = UIComponents.CreateText({
        size = UDim2.new(1, -50, 1, 0),
        position = UDim2.new(0, 50, 0, 0),
        text = "0",
        font = Enum.Font.GothamBold,
        xAlignment = Enum.TextXAlignment.Left
    })
    ShopUI.gemsLabel.Parent = gemsContent
    
    -- Bouton fermer
    local closeButton = UIComponents.CreateButton({
        size = UDim2.new(0, 50, 0, 50),
        position = UDim2.new(1, -60, 0.5, -25),
        text = "✕",
        color = COLORS.danger,
        cornerRadius = 25
    })
    closeButton.Parent = headerContent
    closeButton.MouseButton1Click:Connect(function()
        ShopUI.Toggle()
    end)
    
    -- Container principal pour catégories et items
    local mainContent = Instance.new("Frame")
    mainContent.Size = UDim2.new(1, -40, 1, -100)
    mainContent.Position = UDim2.new(0, 20, 0, 90)
    mainContent.BackgroundTransparency = 1
    mainContent.Parent = ShopUI.container
    
    -- Panneau des catégories
    ShopUI.categoriesPanel = UIComponents.CreateFrame({
        size = UDim2.new(0.25, -10, 1, 0),
        position = UDim2.new(0, 0, 0, 0),
        cornerRadius = 15,
        color = COLORS.secondary
    })
    ShopUI.categoriesPanel.Parent = mainContent
    
    local categoriesContent = Instance.new("Frame")
    categoriesContent.Size = UDim2.new(1, -20, 1, -20)
    categoriesContent.Position = UDim2.new(0, 10, 0, 10)
    categoriesContent.BackgroundTransparency = 1
    categoriesContent.Parent = ShopUI.categoriesPanel
    
    -- Créer les boutons de catégories
    local categories = {"Trails", "Boosts", "Abilities", "Cosmetics"}
    ShopUI.categoryButtons = {}
    
    for i, category in ipairs(categories) do
        local button = UIComponents.CreateButton({
            size = UDim2.new(1, 0, 0, 60),
            position = UDim2.new(0, 0, 0, (i-1) * 70),
            text = category,
            color = category == ShopUI.selectedCategory and COLORS.accent or COLORS.primary,
            cornerRadius = 10
        })
        button.Parent = categoriesContent
        
        button.MouseButton1Click:Connect(function()
            ShopUI.SelectCategory(category)
        end)
        
        ShopUI.categoryButtons[category] = button
    end
    
    -- Panneau des items
    ShopUI.itemsPanel = UIComponents.CreateFrame({
        size = UDim2.new(0.75, -10, 1, 0),
        position = UDim2.new(0.25, 10, 0, 0),
        cornerRadius = 15,
        color = COLORS.secondary
    })
    ShopUI.itemsPanel.Parent = mainContent
    
    local itemsScroll = Instance.new("ScrollingFrame")
    itemsScroll.Size = UDim2.new(1, -20, 1, -20)
    itemsScroll.Position = UDim2.new(0, 10, 0, 10)
    itemsScroll.BackgroundTransparency = 1
    itemsScroll.ScrollBarThickness = 6
    itemsScroll.ScrollBarImageColor3 = COLORS.accent
    itemsScroll.BorderSizePixel = 0
    itemsScroll.Parent = ShopUI.itemsPanel
    
    ShopUI.itemsGrid = Instance.new("UIGridLayout")
    ShopUI.itemsGrid.CellSize = UDim2.new(0.3, -10, 0.4, -10)
    ShopUI.itemsGrid.CellPadding = UDim2.new(0.035, 0, 0.025, 0)
    ShopUI.itemsGrid.SortOrder = Enum.SortOrder.LayoutOrder
    ShopUI.itemsGrid.Parent = itemsScroll
    
    ShopUI.itemsContainer = itemsScroll
    
    -- Bouton d'ouverture de la boutique
    ShopUI.openButton = UIComponents.CreateButton({
        size = UDim2.new(0, 120, 0, 50),
        position = UDim2.new(1, -140, 0, 20),
        text = "🛍️ BOUTIQUE",
        color = COLORS.gold,
        cornerRadius = 25
    })
    ShopUI.openButton.Parent = gui
    ShopUI.openButton.MouseButton1Click:Connect(function()
        ShopUI.Toggle()
    end)
    
    return ShopUI.container
end

function ShopUI.SelectCategory(category)
    ShopUI.selectedCategory = category
    
    -- Mettre à jour les boutons
    for cat, button in pairs(ShopUI.categoryButtons) do
        TweenService:Create(button, TweenInfo.new(0.2), {
            BackgroundColor3 = cat == category and COLORS.accent or COLORS.primary
        }):Play()
    end
    
    -- Afficher les items
    ShopUI.DisplayItems(category)
end

function ShopUI.CreateItemCard(item)
    local card = UIComponents.CreateFrame({
        size = UDim2.new(1, 0, 1, 0),
        position = UDim2.new(0, 0, 0, 0),
        cornerRadius = 15,
        color = COLORS.primary
    })
    
    local content = Instance.new("Frame")
    content.Size = UDim2.new(1, -20, 1, -20)
    content.Position = UDim2.new(0, 10, 0, 10)
    content.BackgroundTransparency = 1
    content.Parent = card
    
    -- Icône
    local icon = UIComponents.CreateText({
        size = UDim2.new(1, 0, 0.3, 0),
        position = UDim2.new(0, 0, 0, 0),
        text = item.icon,
        font = Enum.Font.SourceSansBold
    })
    icon.Parent = content
    
    -- Nom
    local name = UIComponents.CreateText({
        size = UDim2.new(1, 0, 0.15, 0),
        position = UDim2.new(0, 0, 0.3, 0),
        text = item.name,
        font = Enum.Font.GothamBold,
        color = COLORS.text.primary
    })
    name.TextScaled = false
    name.TextSize = 16
    name.Parent = content
    
    -- Description
    local desc = UIComponents.CreateText({
        size = UDim2.new(1, 0, 0.25, 0),
        position = UDim2.new(0, 0, 0.45, 0),
        text = item.description,
        font = Enum.Font.Gotham,
        color = COLORS.text.secondary
    })
    desc.TextScaled = false
    desc.TextSize = 12
    desc.TextWrapped = true
    desc.Parent = content
    
    -- Bouton d'action
    local isOwned = table.find(ShopUI.ownedItems, item.id) ~= nil
    local isEquipped = false
    for _, equippedId in pairs(ShopUI.equippedItems) do
        if equippedId == item.id then
            isEquipped = true
            break
        end
    end
    
    local actionButton = UIComponents.CreateButton({
        size = UDim2.new(1, 0, 0.2, 0),
        position = UDim2.new(0, 0, 0.75, 0),
        text = isOwned and (isEquipped and "ÉQUIPÉ ✓" or "ÉQUIPER") or ("💎 " .. item.price),
        color = isOwned and (isEquipped and COLORS.success or COLORS.accent) or COLORS.gold,
        cornerRadius = 10
    })
    actionButton.Parent = content
    
    actionButton.MouseButton1Click:Connect(function()
        ShopUI.HandleItemAction(item, isOwned, isEquipped)
    end)
    
    return card
end

function ShopUI.DisplayItems(category)
    -- Nettoyer les items existants
    for _, child in ipairs(ShopUI.itemsContainer:GetChildren()) do
        if child:IsA("Frame") then
            child:Destroy()
        end
    end
    
    -- Obtenir et afficher les items
    local items = ShopSystem.GetItemsByCategory(category)
    
    for _, item in ipairs(items) do
        local card = ShopUI.CreateItemCard(item)
        card.Parent = ShopUI.itemsContainer
    end
end

function ShopUI.HandleItemAction(item, isOwned, isEquipped)
    local shopRemotes = ShopSystem.SetupRemotes()
    
    if isOwned then
        -- Équiper/Déséquiper
        shopRemotes.EquipItem:FireServer(item.id, not isEquipped)
        task.wait(0.1)
        ShopUI.UpdateData()
        ShopUI.DisplayItems(ShopUI.selectedCategory)
    else
        -- Acheter
        local success, message = shopRemotes.PurchaseItem:InvokeServer(item.id)
        
        if success then
            NotificationSystem.Create(message, "✅", COLORS.success)
            ShopUI.UpdateData()
            ShopUI.DisplayItems(ShopUI.selectedCategory)
        else
            NotificationSystem.Create(message, "❌", COLORS.danger)
        end
    end
end

function ShopUI.UpdateData()
    local shopRemotes = ShopSystem.SetupRemotes()
    local owned, equipped = shopRemotes.GetOwnedItems:InvokeServer()
    ShopUI.ownedItems = owned or {}
    ShopUI.equippedItems = equipped or {}
end

function ShopUI.UpdateGems()
    if ShopUI.gemsLabel and player.leaderstats and player.leaderstats:FindFirstChild("Gems") then
        ShopUI.gemsLabel.Text = tostring(player.leaderstats.Gems.Value)
    end
end

function ShopUI.Toggle()
    ShopUI.isOpen = not ShopUI.isOpen
    
    if ShopUI.isOpen then
        ShopUI.UpdateData()
        ShopUI.UpdateGems()
        ShopUI.DisplayItems(ShopUI.selectedCategory)
        
        -- Animation d'ouverture
        ShopUI.overlay.Visible = true
        ShopUI.container.Visible = true
        ShopUI.overlay.BackgroundTransparency = 1
        ShopUI.container.Size = UDim2.new(0.8, 0, 0.8, 0)
        ShopUI.container.Position = UDim2.new(0.1, 0, 0.1, 0)
        
        TweenService:Create(ShopUI.overlay, TweenInfo.new(0.3), {
            BackgroundTransparency = 0.5
        }):Play()
        
        TweenService:Create(ShopUI.container, TweenInfo.new(0.5, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
            Size = UDim2.new(0.9, 0, 0.9, 0),
            Position = UDim2.new(0.05, 0, 0.05, 0)
        }):Play()
    else
        -- Animation de fermeture
        TweenService:Create(ShopUI.overlay, TweenInfo.new(0.3), {
            BackgroundTransparency = 1
        }):Play()
        
        local closeTween = TweenService:Create(ShopUI.container, TweenInfo.new(0.3, Enum.EasingStyle.Back, Enum.EasingDirection.In), {
            Size = UDim2.new(0.8, 0, 0.8, 0),
            Position = UDim2.new(0.1, 0, 0.1, 0)
        })
        closeTween:Play()
        
        closeTween.Completed:Connect(function()
            ShopUI.overlay.Visible = false
            ShopUI.container.Visible = false
        end)
    end
end

-- === SYSTÈME DE SPRINT ===
local SprintController = {}
SprintController.connection = nil

function SprintController.Setup()
    local character = player.Character or player.CharacterAdded:Wait()
    local humanoid = character:WaitForChild("Humanoid")
    
    -- Déconnecter l'ancienne connexion
    if SprintController.connection then
        SprintController.connection:Disconnect()
    end
    
    -- Mise à jour de la stamina
    SprintController.connection = RunService.Heartbeat:Connect(function(deltaTime)
        SprintSystem.UpdateStamina(deltaTime, humanoid)
        StaminaUI.Update()
    end)
    
    -- Gestion des touches
    UserInputService.InputBegan:Connect(function(input, gameProcessed)
        if gameProcessed then return end
        
        if input.KeyCode == SprintSystem.Config.SprintKey then
            if SprintSystem.StartSprint(humanoid) then
                TrailSystem.EnableTrail(player, "Electric")
                
                -- Effet FOV
                if SprintSystem.Config.EnableFOVEffect then
                    TweenService:Create(camera, 
                        TweenInfo.new(SprintSystem.Config.FOVTransitionTime, Enum.EasingStyle.Quad), {
                        FieldOfView = SprintSystem.Config.SprintFOV
                    }):Play()
                end
            end
        end
    end)
    
    UserInputService.InputEnded:Connect(function(input, gameProcessed)
        if gameProcessed then return end
        
        if input.KeyCode == SprintSystem.Config.SprintKey then
            if SprintSystem.StopSprint(humanoid) then
                TrailSystem.DisableTrail(player)
                
                -- Retour FOV normal
                if SprintSystem.Config.EnableFOVEffect then
                    TweenService:Create(camera, 
                        TweenInfo.new(SprintSystem.Config.FOVTransitionTime, Enum.EasingStyle.Quad), {
                        FieldOfView = SprintSystem.Config.NormalFOV
                    }):Play()
                end
            end
        end
    end)
    
    -- Gérer la mort
    humanoid.Died:Connect(function()
        SprintSystem.Reset()
        TrailSystem.DisableTrail(player)
        if SprintController.connection then
            SprintController.connection:Disconnect()
        end
    end)
end

-- === GESTION DES ÉVÉNEMENTS ===
local function OnGemCollected(gemType, points)
    -- Notification de collection
    NotificationSystem.Create(
        string.format("Gemme %s collectée! +%d points", gemType, points),
        "💎",
        gemType == "Rouge" and COLORS.danger or
        gemType == "Bleue" and COLORS.accent or
        gemType == "Verte" and COLORS.success
    )
    
    -- Effet de particules
    local character = player.Character
    if character and character:FindFirstChild("HumanoidRootPart") then
        for i = 1, 15 do
            local particle = Instance.new("Part")
            particle.Name = "GemParticle"
            particle.Size = Vector3.new(0.3, 0.3, 0.3)
            particle.Material = Enum.Material.Neon
            particle.Color = gemType == "Rouge" and COLORS.danger or
                           gemType == "Bleue" and COLORS.accent or
                           gemType == "Verte" and COLORS.success
            particle.CanCollide = false
            particle.Position = character.HumanoidRootPart.Position
            particle.Parent = workspace
            
            local velocity = Instance.new("BodyVelocity")
            velocity.Velocity = Vector3.new(
                math.random(-15, 15),
                math.random(20, 30),
                math.random(-15, 15)
            )
            velocity.MaxForce = Vector3.new(math.huge, math.huge, math.huge)
            velocity.Parent = particle
            
            game:GetService("Debris"):AddItem(particle, 1)
            
            task.spawn(function()
                for j = 0, 1, 0.05 do
                    particle.Transparency = j
                    task.wait(0.05)
                end
            end)
        end
    end
end

local function OnScoreUpdate(newScore)
    currentScore = newScore
    HUD.UpdateScore(newScore)
    
    -- Vérifier les objectifs atteints
    for _, objective in ipairs(GemSystem.Objectives) do
        if newScore == objective then
            NotificationSystem.Create(
                string.format("🎉 OBJECTIF ATTEINT! %d gemmes collectées!", objective),
                "🏆",
                COLORS.gold,
                5
            )
            break
        end
    end
end

-- === INITIALISATION ===
local function Initialize()
    -- Créer le GUI principal
    gui = Instance.new("ScreenGui")
    gui.Name = "GemCollectorGUI"
    gui.ResetOnSpawn = false
    gui.IgnoreGuiInset = true
    gui.Parent = playerGui
    
    -- Créer les modules UI
    HUD.Create()
    StaminaUI.Create()
    ShopUI.Create()
    
    -- Attendre les RemoteEvents avec plusieurs tentatives
    task.wait(2) -- Attendre un peu plus longtemps que le serveur s'initialise
    
    print("🔍 Recherche des RemoteEvents...")
    local remotesFolder = ReplicatedStorage:WaitForChild("GemRemotes", 15) -- Attendre jusqu'à 15 secondes
    if remotesFolder then
        print("✅ Dossier GemRemotes trouvé!")
        local gemCollected = remotesFolder:WaitForChild("GemCollected", 5)
        local updateScore = remotesFolder:WaitForChild("UpdateScore", 5)
        
        if gemCollected and updateScore then
            print("✅ RemoteEvents connectés!")
            gemCollected.OnClientEvent:Connect(OnGemCollected)
            updateScore.OnClientEvent:Connect(OnScoreUpdate)
        else
            warn("❌ RemoteEvents non trouvés dans le dossier")
            print("  - GemCollected:", gemCollected)
            print("  - UpdateScore:", updateScore)
        end
    else
        warn("❌ Dossier GemRemotes non trouvé après 15 secondes d'attente")
        -- Lister ce qui est dans ReplicatedStorage pour déboguer
        print("📂 Contenu de ReplicatedStorage:")
        for _, child in pairs(ReplicatedStorage:GetChildren()) do
            print("  -", child.Name, "(" .. child.ClassName .. ")")
        end
    end
    
    -- Initialiser le système de sprint
    if player.Character then
        SprintController.Setup()
    end
    
    player.CharacterAdded:Connect(function()
        task.wait(0.5)
        SprintController.Setup()
    end)
    
    -- Mettre à jour les gemmes de la boutique périodiquement
    task.spawn(function()
        while gui and gui.Parent do
            ShopUI.UpdateGems()
            task.wait(0.5)
        end
    end)
    
    -- Messages de bienvenue
    task.wait(1)
    NotificationSystem.Create("🎮 Bienvenue dans le Collecteur de Gemmes!", "👋", COLORS.success, 5)
    task.wait(0.5)
    NotificationSystem.Create("💎 Rouge: 1pt | Bleue: 3pts | Verte: 5pts", "📊", COLORS.accent, 5)
    task.wait(0.5)
    NotificationSystem.Create("⚡ SHIFT pour sprinter | 🛍️ Boutique en haut à droite", "💡", COLORS.gold, 5)
end

-- Démarrer l'initialisation
Initialize()