export interface RobloxAPI {
  service: string;
  methods: Array<{
    name: string;
    description: string;
    signature: string;
    example?: string;
    deprecated?: boolean;
  }>;
  properties?: Array<{
    name: string;
    type: string;
    description: string;
    readonly?: boolean;
  }>;
}

export const robloxAPIs: RobloxAPI[] = [
  // === SERVICES LES PLUS UTILISÉS ===
  {
    service: "Players",
    methods: [
      {
        name: "GetPlayers",
        description: "Retourne tous les joueurs connectés",
        signature: "GetPlayers(): {Player}",
        example: "for _, player in ipairs(game.Players:GetPlayers()) do"
      },
      {
        name: "GetPlayerFromCharacter",
        description: "Obtient le joueur à partir de son personnage",
        signature: "GetPlayerFromCharacter(character: Model): Player?",
        example: "local player = game.Players:GetPlayerFromCharacter(hit.Parent)"
      },
      {
        name: "GetUserIdFromNameAsync",
        description: "Obtient l'UserId à partir du nom (async)",
        signature: "GetUserIdFromNameAsync(userName: string): number",
        example: "local userId = game.Players:GetUserIdFromNameAsync('Username')"
      }
    ],
    properties: [
      {
        name: "MaxPlayers",
        type: "number",
        description: "Nombre maximum de joueurs"
      },
      {
        name: "LocalPlayer",
        type: "Player?",
        description: "Le joueur local (client seulement)",
        readonly: true
      }
    ]
  },
  
  {
    service: "Workspace",
    methods: [
      {
        name: "Raycast",
        description: "Lance un rayon pour détecter des collisions",
        signature: "Raycast(origin: Vector3, direction: Vector3, params?: RaycastParams): RaycastResult?",
        example: "local result = workspace:Raycast(origin, direction * 100)"
      },
      {
        name: "GetPartBoundsInBox",
        description: "Trouve les parts dans une boîte",
        signature: "GetPartBoundsInBox(cframe: CFrame, size: Vector3, params?: OverlapParams): {BasePart}",
        example: "local parts = workspace:GetPartBoundsInBox(CFrame.new(0,10,0), Vector3.new(20,20,20))"
      },
      {
        name: "GetPartBoundsInRadius",
        description: "Trouve les parts dans un rayon",
        signature: "GetPartBoundsInRadius(position: Vector3, radius: number, params?: OverlapParams): {BasePart}",
        example: "local parts = workspace:GetPartBoundsInRadius(position, 50)"
      }
    ],
    properties: [
      {
        name: "CurrentCamera",
        type: "Camera",
        description: "La caméra active"
      },
      {
        name: "Gravity",
        type: "number",
        description: "Force de gravité (défaut: 196.2)"
      }
    ]
  },
  
  {
    service: "TweenService",
    methods: [
      {
        name: "Create",
        description: "Crée une nouvelle animation Tween",
        signature: "Create(instance: Instance, tweenInfo: TweenInfo, propertyTable: table): Tween",
        example: "local tween = TweenService:Create(part, TweenInfo.new(2), {Position = Vector3.new(0,10,0)})"
      },
      {
        name: "GetValue",
        description: "Calcule une valeur d'interpolation",
        signature: "GetValue(alpha: number, easingStyle: Enum.EasingStyle, easingDirection: Enum.EasingDirection): number"
      }
    ]
  },
  
  {
    service: "RunService",
    methods: [
      {
        name: "Heartbeat",
        description: "Se déclenche après chaque frame de physique (~60Hz)",
        signature: "Heartbeat: RBXScriptSignal<deltaTime: number>",
        example: "RunService.Heartbeat:Connect(function(dt) end)"
      },
      {
        name: "Stepped",
        description: "Se déclenche avant chaque frame de physique",
        signature: "Stepped: RBXScriptSignal<time: number, deltaTime: number>",
        deprecated: true
      },
      {
        name: "RenderStepped",
        description: "Se déclenche avant chaque rendu (client seulement)",
        signature: "RenderStepped: RBXScriptSignal<deltaTime: number>",
        example: "RunService.RenderStepped:Connect(function(dt) end)"
      },
      {
        name: "IsClient",
        description: "Vérifie si on est côté client",
        signature: "IsClient(): boolean"
      },
      {
        name: "IsServer",
        description: "Vérifie si on est côté serveur",
        signature: "IsServer(): boolean"
      },
      {
        name: "IsStudio",
        description: "Vérifie si on est dans Studio",
        signature: "IsStudio(): boolean"
      }
    ]
  },
  
  {
    service: "DataStoreService",
    methods: [
      {
        name: "GetDataStore",
        description: "Obtient ou crée un DataStore",
        signature: "GetDataStore(name: string, scope?: string): DataStore",
        example: "local dataStore = DataStoreService:GetDataStore('PlayerData')"
      },
      {
        name: "GetGlobalDataStore",
        description: "Obtient le DataStore global",
        signature: "GetGlobalDataStore(): DataStore"
      },
      {
        name: "GetOrderedDataStore",
        description: "Obtient un DataStore ordonné (pour leaderboards)",
        signature: "GetOrderedDataStore(name: string, scope?: string): OrderedDataStore"
      }
    ]
  },
  
  {
    service: "ReplicatedStorage",
    methods: [
      {
        name: "WaitForChild",
        description: "Attend qu'un enfant existe",
        signature: "WaitForChild(childName: string, timeout?: number): Instance?",
        example: "local remoteEvent = ReplicatedStorage:WaitForChild('MyRemote')"
      },
      {
        name: "FindFirstChild",
        description: "Trouve un enfant par nom",
        signature: "FindFirstChild(name: string, recursive?: boolean): Instance?"
      }
    ]
  },
  
  {
    service: "UserInputService",
    methods: [
      {
        name: "IsKeyDown",
        description: "Vérifie si une touche est enfoncée",
        signature: "IsKeyDown(keyCode: Enum.KeyCode): boolean",
        example: "if UserInputService:IsKeyDown(Enum.KeyCode.Space) then"
      },
      {
        name: "GetMouseLocation",
        description: "Obtient la position de la souris",
        signature: "GetMouseLocation(): Vector2"
      },
      {
        name: "InputBegan",
        description: "Se déclenche quand une entrée commence",
        signature: "InputBegan: RBXScriptSignal<InputObject, gameProcessedEvent: boolean>",
        example: "UserInputService.InputBegan:Connect(function(input, gameProcessed) end)"
      }
    ],
    properties: [
      {
        name: "TouchEnabled",
        type: "boolean",
        description: "Si l'appareil a un écran tactile",
        readonly: true
      },
      {
        name: "KeyboardEnabled",
        type: "boolean",
        description: "Si un clavier est disponible",
        readonly: true
      }
    ]
  },
  
  {
    service: "HttpService",
    methods: [
      {
        name: "JSONEncode",
        description: "Convertit une table Lua en JSON",
        signature: "JSONEncode(value: any): string",
        example: "local json = HttpService:JSONEncode({name = 'Player', score = 100})"
      },
      {
        name: "JSONDecode",
        description: "Convertit du JSON en table Lua",
        signature: "JSONDecode(json: string): any",
        example: "local data = HttpService:JSONDecode(jsonString)"
      },
      {
        name: "GenerateGUID",
        description: "Génère un identifiant unique",
        signature: "GenerateGUID(wrapInCurlyBraces?: boolean): string"
      }
    ]
  },
  
  {
    service: "MarketplaceService",
    methods: [
      {
        name: "PromptProductPurchase",
        description: "Demande l'achat d'un produit",
        signature: "PromptProductPurchase(player: Player, productId: number, equipIfPurchased?: boolean)",
        example: "MarketplaceService:PromptProductPurchase(player, 123456789)"
      },
      {
        name: "UserOwnsGamePassAsync",
        description: "Vérifie si le joueur possède un game pass",
        signature: "UserOwnsGamePassAsync(userId: number, gamePassId: number): boolean",
        example: "local hasPass = MarketplaceService:UserOwnsGamePassAsync(player.UserId, 123456)"
      }
    ]
  },
  
  {
    service: "TeleportService",
    methods: [
      {
        name: "TeleportAsync",
        description: "Téléporte des joueurs vers un autre lieu",
        signature: "TeleportAsync(placeId: number, players: {Player}, options?: TeleportOptions)",
        example: "TeleportService:TeleportAsync(123456789, {player})"
      },
      {
        name: "GetLocalPlayerTeleportData",
        description: "Obtient les données de téléportation",
        signature: "GetLocalPlayerTeleportData(): any"
      }
    ]
  }
];

// Types communs Roblox
export const commonTypes = {
  Vector3: "Vector3.new(x: number, y: number, z: number)",
  CFrame: "CFrame.new(position: Vector3) | CFrame.lookAt(from: Vector3, to: Vector3)",
  Color3: "Color3.new(r: number, g: number, b: number) | Color3.fromRGB(r: number, g: number, b: number)",
  UDim2: "UDim2.new(xScale: number, xOffset: number, yScale: number, yOffset: number)",
  TweenInfo: "TweenInfo.new(time: number, style?: Enum.EasingStyle, direction?: Enum.EasingDirection)",
  RaycastParams: "RaycastParams.new() -- puis définir FilterType et FilterDescendantsInstances",
  BrickColor: "BrickColor.new(name: string) | BrickColor.new(r: number, g: number, b: number)"
};

// Fonctions utilitaires
export function getServiceAPI(serviceName: string): RobloxAPI | undefined {
  return robloxAPIs.find(api => api.service.toLowerCase() === serviceName.toLowerCase());
}

export function searchAPIs(query: string): Array<{service: string, method?: string, property?: string}> {
  const results: Array<{service: string, method?: string, property?: string}> = [];
  const lowerQuery = query.toLowerCase();
  
  for (const api of robloxAPIs) {
    // Recherche dans les méthodes
    for (const method of api.methods) {
      if (method.name.toLowerCase().includes(lowerQuery) || 
          method.description.toLowerCase().includes(lowerQuery)) {
        results.push({ service: api.service, method: method.name });
      }
    }
    
    // Recherche dans les propriétés
    if (api.properties) {
      for (const prop of api.properties) {
        if (prop.name.toLowerCase().includes(lowerQuery) || 
            prop.description.toLowerCase().includes(lowerQuery)) {
          results.push({ service: api.service, property: prop.name });
        }
      }
    }
  }
  
  return results;
}