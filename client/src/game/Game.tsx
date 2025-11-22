import * as BABYLON from '@babylonjs/core';
import { Player } from './Player';
import { Network } from './network/Network';
import { GameNetworkHandler } from './handlers/GameNetworkHandler';
import { WoodcuttingHandler } from './handlers/WoodcuttingHandler';
import { PlayerHandler } from './handlers/PlayerHandler';
import { InteractionHandler } from './handlers/InteractionHandler';
import { ChatHandler, type ChatMessage } from './handlers/ChatHandler';
import { MovementHandler } from './handlers/MovementHandler';
import { TradeHandler, type TradeItem } from './handlers/TradeHandler';

// Re-export ChatMessage for external use
export type { ChatMessage };

/**
 * Game Class - Main coordinator for the Babylon.js 3D game
 * 
 * Responsibilities:
 * - Initialize Babylon.js engine, scene, camera, lights
 * - Create and manage local player (controlled by this client)
 * - Create and manage remote players (controlled by other clients)
 * - Handle network events through GameNetworkHandler
 * - Coordinate between Player instances and Network layer
 * - Manage game loop (movement updates, rendering)
 */
class Game {
    private canvas: HTMLCanvasElement;                      // HTML canvas element for rendering
    private engine: BABYLON.Engine;                         // Babylon.js WebGL engine
    private scene: BABYLON.Scene;                           // 3D scene containing all meshes
    private playerData: any;                                // Initial player data from database
    private network: Network;                               // Network coordinator (Socket.IO)
    private networkHandler: GameNetworkHandler;             // Handles network event callbacks
    private localPlayer: Player | null = null;              // The player controlled by this client
    private camera!: BABYLON.ArcRotateCamera;               // Camera reference for follow logic
    private userControllingCamera: boolean = false;         // Track if user is manually moving camera
    private onPlayerSelected?: (playerData: { name: string; health: number; maxHealth: number; mesh: BABYLON.Mesh | null; woodcuttingLevel: number } | null) => void;  // Callback when player is selected
    private onPlayerRightClick?: (playerData: { id: string; name: string; x: number; y: number }) => void;  // Callback when player is right-clicked
    private onTradeRequest?: (fromPlayerId: string, fromPlayerName: string) => void;  // Callback when receiving trade request
    private onTradeResponse?: (fromPlayerId: string, fromPlayerName: string, accepted: boolean) => void;  // Callback when trade request is responded to
    private onTradeUpdate?: (fromPlayerId: string, offeredItems: TradeItem[]) => void;  // Callback when trade offer updates
    private onTradeAccept?: (fromPlayerId: string) => void;  // Callback when other player accepts
    private onTradeDecline?: (fromPlayerId: string) => void;  // Callback when other player declines
    
    // Handlers
    private woodcuttingHandler!: WoodcuttingHandler;
    private playerHandler!: PlayerHandler;
    private interactionHandler!: InteractionHandler;
    private chatHandler!: ChatHandler;
    private movementHandler!: MovementHandler;
    private tradeHandler!: TradeHandler;

    /**
     * Constructor: Initialize game systems
     * @param canvasId - ID of HTML canvas element to render to
     * @param player - Player data from authentication (username, position, etc.)
     * @param token - JWT token for WebSocket authentication
     * @param onMessageReceived - Callback to pass chat messages to React UI
     * @param onPlayerSelected - Callback when a player is clicked for UI display
     * @param onPlayerRightClick - Callback when a player is right-clicked for context menu
     * @param onTradeRequest - Callback when receiving a trade request
     * @param onTradeResponse - Callback when trade request is responded to
     * @param onTradeUpdate - Callback when trade offer updates
     * @param onTradeAccept - Callback when other player accepts trade
     * @param onTradeDecline - Callback when other player declines trade
     */
    constructor(
        canvasId: string, 
        player: any, 
        token: string, 
        onMessageReceived: (msg: ChatMessage) => void,
        onPlayerSelected?: (playerData: { name: string; health: number; maxHealth: number; mesh: BABYLON.Mesh | null; woodcuttingLevel: number } | null) => void,
        onPlayerRightClick?: (playerData: { id: string; name: string; x: number; y: number }) => void,
        onTradeRequest?: (fromPlayerId: string, fromPlayerName: string) => void,
        onTradeResponse?: (fromPlayerId: string, fromPlayerName: string, accepted: boolean) => void,
        onTradeUpdate?: (fromPlayerId: string, offeredItems: TradeItem[]) => void,
        onTradeAccept?: (fromPlayerId: string) => void,
        onTradeDecline?: (fromPlayerId: string) => void
    ) {
        // Get canvas element and initialize Babylon.js WebGL engine
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.engine = new BABYLON.Engine(this.canvas, true);  // true = enable antialiasing
        this.playerData = player;
        this.onPlayerSelected = onPlayerSelected;
        this.onPlayerRightClick = onPlayerRightClick;
        this.onTradeRequest = onTradeRequest;
        this.onTradeResponse = onTradeResponse;
        this.onTradeUpdate = onTradeUpdate;
        this.onTradeAccept = onTradeAccept;
        this.onTradeDecline = onTradeDecline;
        
        // Initialize player handler first (needed for scene creation)
        this.scene = new BABYLON.Scene(this.engine);
        this.playerHandler = new PlayerHandler(this.scene);
        
        // Create scene with player
        this.setupScene();
        
        // Create network handler - we'll pass these callbacks to Network
        // (we define them now even though some handlers don't exist yet, they'll work when called)
        this.networkHandler = new GameNetworkHandler(
            (data) => this.playerHandler.updateRemotePlayer(data),
            (playerId) => this.playerHandler.removeRemotePlayer(playerId),
            (players) => this.playerHandler.handlePlayersUpdate(players),
            () => this.network?.getSocketId() || '',
            (msg) => this.chatHandler?.handleMessageReceived(msg),
            (treeData) => this.woodcuttingHandler?.handleTreeUpdate(treeData),
            (trees) => this.woodcuttingHandler?.handleTreesUpdate(trees),
            (reward) => this.woodcuttingHandler?.handleWoodcuttingReward(reward),
            (data) => this.handleTreeShake(data)
        );
        
        // Initialize network connection with JWT authentication
        this.network = new Network('http://localhost:3000', token, this.networkHandler.getNetworkCallbacks());
        
        // Initialize chat handler with local player and network
        this.chatHandler = new ChatHandler(this.playerHandler, this.localPlayer, onMessageReceived, this.network);
        
        // Initialize movement handler
        this.movementHandler = new MovementHandler(this.localPlayer, this.network);
        
        // Initialize trade handler
        this.tradeHandler = new TradeHandler(
            this.network.getSocket(),
            this.onTradeRequest,
            this.onTradeResponse,
            this.onTradeUpdate,
            this.onTradeAccept,
            this.onTradeDecline
        );
        
        // Initialize woodcutting handler - but delay tree creation until terrain is ready
        this.woodcuttingHandler = new WoodcuttingHandler(this.scene, this.network);
        
        // Wait for terrain and structures to be ready before creating trees
        setTimeout(() => {
            this.woodcuttingHandler.createTreesDelayed();
            
            // Initialize interaction handler after trees are created
            this.interactionHandler = new InteractionHandler(
                this.scene,
                this.woodcuttingHandler.getTrees(),
                this.playerHandler,
                this.localPlayer,
                this.woodcuttingHandler,
                (treeId) => this.woodcuttingHandler.handleTreeChop(treeId),
                this.onPlayerSelected,
                this.onPlayerRightClick
            );
        }, 100); // Short delay to ensure structures are created
        
        /**
         * Game loop: Runs every frame (~60 FPS)
         * 1. Update player movement (check keyboard input, send to server)
         * 2. Update camera to follow player
         * 3. Render the scene
         */
        this.engine.runRenderLoop(() => {
            const playerMoved = this.movementHandler.update();
            
            // If player moved, reset camera to follow mode
            if (playerMoved) {
                this.userControllingCamera = false;
            }
            
            // Update camera to follow player
            this.updateCamera();
            
            this.scene.render();
        });
        
        // Handle window resize to maintain correct aspect ratio
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }

    /**
     * Get chat handler for external use
     * Allows React UI to send messages directly
     */
    public getChatHandler(): ChatHandler {
        return this.chatHandler;
    }

    /**
     * Get woodcutting handler for external use
     * Allows React UI to access skills and inventory
     */
    public getWoodcuttingHandler(): WoodcuttingHandler {
        return this.woodcuttingHandler;
    }

    /**
     * Get trade handler for external use
     * Allows React UI to send and manage trades
     */
    public getTradeHandler(): TradeHandler {
        return this.tradeHandler;
    }

    /**
     * Handle tree shake event from network
     * When another player hits a tree, animate it locally
     */
    private handleTreeShake(data: { treeId: string; playerId: string }): void {
        const tree = this.woodcuttingHandler.getTrees().get(data.treeId);
        if (tree) {
            tree.shake();
        }
    }

    /**
     * Setup the scene with camera, lights, ground, and local player
     * Called during initialization after scene and playerHandler are created
     */
    private setupScene(): void {
        // Camera - positioned behind and above player
        this.camera = new BABYLON.ArcRotateCamera(
            'Camera',
            -Math.PI / 2,  // Alpha: angle around Y axis (start behind player)
            Math.PI / 3,   // Beta: angle from vertical
            15,            // Radius: distance from target
            BABYLON.Vector3.Zero(),
            this.scene
        );
        this.camera.attachControl(this.canvas, true);
        this.camera.lowerRadiusLimit = 5;
        this.camera.upperRadiusLimit = 30;
        
        // Disable right-click panning (prevents camera from moving player under map)
        // Only allow left-click rotation and scroll wheel zoom
        const pointerInput = this.camera.inputs.attached.pointers as any;
        if (pointerInput) {
            pointerInput.buttons = [0, 1]; // 0 = left click, 1 = middle click (disable right click = 2)
        }
        this.camera.panningSensibility = 0; // Disable panning entirely
        
        // Detect when user manually controls camera
        this.camera.onViewMatrixChangedObservable.add(() => {
            // If camera is being moved by user input (not by our code)
            if (this.camera.inertialAlphaOffset !== 0 || this.camera.inertialBetaOffset !== 0) {
                this.userControllingCamera = true;
            }
        });
        
        // Light
        new BABYLON.HemisphericLight(
            'light1',
            new BABYLON.Vector3(1, 1, 0),
            this.scene
        );
        
        // Create procedurally generated terrain
        this.createTerrain();
        
        // Create local player
        const initialPosition = this.playerData.position || { x: 0, y: 0.5, z: 0 };
        const initialRotation = this.playerData.rotation || { x: 0, y: 0, z: 0 };
        
        this.localPlayer = new Player(
            this.scene,
            {
                id: 'local',
                username: this.playerData.username,
                position: { ...initialPosition, y: initialPosition.y || 0.5 },
                rotation: initialRotation
            },
            true
        );
        
        // Initial camera setup to follow player
        this.camera.target = this.localPlayer.getMesh().position;
    }

    /**
     * Create flat terrain with larger size
     */
    private createTerrain(): BABYLON.GroundMesh {
        const terrainSize = 500; // Much larger map (500x500 instead of 100x100)
        const subdivisions = 10; // Fewer subdivisions for flat terrain
        
        // Create flat ground mesh
        const ground = BABYLON.MeshBuilder.CreateGround(
            'ground',
            { width: terrainSize, height: terrainSize, subdivisions: subdivisions },
            this.scene
        );

        // Material with grass-like color
        const groundMaterial = new BABYLON.StandardMaterial('groundMat', this.scene);
        groundMaterial.diffuseColor = new BABYLON.Color3(0.35, 0.7, 0.35);
        groundMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
        ground.material = groundMaterial;
        
        // Enable collisions
        ground.checkCollisions = true;
        ground.metadata = { type: 'terrain' };
        
        // Create structures
        this.createCastle();
        this.createCourtyardWall();
        this.createVillage();
        this.createOuterCityWall();
        this.createCave();
        
        return ground;
    }

    /**
     * Create a castle structure with towers and walkable interior
     */
    private createCastle(): void {
        const castlePosition = new BABYLON.Vector3(80, 0, 80);
        
        // Main castle walls (hollow box for interior)
        const wallThickness = 2;
        const wallHeight = 15;
        const castleWidth = 40;
        
        // Create four walls
        const wallMaterial = new BABYLON.StandardMaterial('wallMat', this.scene);
        wallMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.55);
        
        // North wall
        const northWall = BABYLON.MeshBuilder.CreateBox('northWall', {
            width: castleWidth,
            height: wallHeight,
            depth: wallThickness
        }, this.scene);
        northWall.position = castlePosition.add(new BABYLON.Vector3(0, wallHeight / 2, castleWidth / 2));
        northWall.material = wallMaterial;
        northWall.checkCollisions = true;
        
        // South wall
        const southWall = BABYLON.MeshBuilder.CreateBox('southWall', {
            width: castleWidth,
            height: wallHeight,
            depth: wallThickness
        }, this.scene);
        southWall.position = castlePosition.add(new BABYLON.Vector3(0, wallHeight / 2, -castleWidth / 2));
        southWall.material = wallMaterial;
        southWall.checkCollisions = true;
        
        // East wall
        const eastWall = BABYLON.MeshBuilder.CreateBox('eastWall', {
            width: wallThickness,
            height: wallHeight,
            depth: castleWidth
        }, this.scene);
        eastWall.position = castlePosition.add(new BABYLON.Vector3(castleWidth / 2, wallHeight / 2, 0));
        eastWall.material = wallMaterial;
        eastWall.checkCollisions = true;
        
        // West wall with entrance (two separate pieces)
        const entranceWidth = 8;
        const westWallLeft = BABYLON.MeshBuilder.CreateBox('westWallLeft', {
            width: wallThickness,
            height: wallHeight,
            depth: (castleWidth - entranceWidth) / 2
        }, this.scene);
        westWallLeft.position = castlePosition.add(new BABYLON.Vector3(-castleWidth / 2, wallHeight / 2, castleWidth / 4 + entranceWidth / 4));
        westWallLeft.material = wallMaterial;
        westWallLeft.checkCollisions = true;
        
        const westWallRight = BABYLON.MeshBuilder.CreateBox('westWallRight', {
            width: wallThickness,
            height: wallHeight,
            depth: (castleWidth - entranceWidth) / 2
        }, this.scene);
        westWallRight.position = castlePosition.add(new BABYLON.Vector3(-castleWidth / 2, wallHeight / 2, -castleWidth / 4 - entranceWidth / 4));
        westWallRight.material = wallMaterial;
        westWallRight.checkCollisions = true;
        
        // Corner towers
        const towerRadius = 3;
        const towerHeight = 20;
        const towerMaterial = new BABYLON.StandardMaterial('towerMat', this.scene);
        towerMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.45);
        
        const towerPositions = [
            new BABYLON.Vector3(castleWidth / 2, towerHeight / 2, castleWidth / 2),
            new BABYLON.Vector3(-castleWidth / 2, towerHeight / 2, castleWidth / 2),
            new BABYLON.Vector3(castleWidth / 2, towerHeight / 2, -castleWidth / 2),
            new BABYLON.Vector3(-castleWidth / 2, towerHeight / 2, -castleWidth / 2)
        ];
        
        towerPositions.forEach((pos, index) => {
            const tower = BABYLON.MeshBuilder.CreateCylinder(`tower${index}`, {
                diameter: towerRadius * 2,
                height: towerHeight
            }, this.scene);
            tower.position = castlePosition.add(pos);
            tower.material = towerMaterial;
            tower.checkCollisions = true;
            
            // Tower roof (cone)
            const roof = BABYLON.MeshBuilder.CreateCylinder(`towerRoof${index}`, {
                diameterTop: 0,
                diameterBottom: towerRadius * 2.5,
                height: 5
            }, this.scene);
            roof.position = castlePosition.add(pos).add(new BABYLON.Vector3(0, towerHeight / 2 + 2.5, 0));
            const roofMaterial = new BABYLON.StandardMaterial('roofMat', this.scene);
            roofMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.3, 0.2);
            roof.material = roofMaterial;
            roof.checkCollisions = true;
        });
        
        // Interior floor (so players don't fall through)
        const floor = BABYLON.MeshBuilder.CreateGround('castleFloor', {
            width: castleWidth - wallThickness * 2,
            height: castleWidth - wallThickness * 2
        }, this.scene);
        floor.position = castlePosition.add(new BABYLON.Vector3(0, 0.1, 0));
        const floorMaterial = new BABYLON.StandardMaterial('floorMat', this.scene);
        floorMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);
        floor.material = floorMaterial;
        floor.checkCollisions = true;
    }

    /**
     * Create outer courtyard wall around the castle with entrance
     */
    private createCourtyardWall(): void {
        const castlePosition = new BABYLON.Vector3(80, 0, 80);
        const courtyardSize = 100; // Large courtyard for trees
        const wallHeight = 8;
        const wallThickness = 1.5;
        
        const courtyardWallMaterial = new BABYLON.StandardMaterial('courtyardWallMat', this.scene);
        courtyardWallMaterial.diffuseColor = new BABYLON.Color3(0.45, 0.45, 0.5);
        
        // North courtyard wall
        const northCourtyardWall = BABYLON.MeshBuilder.CreateBox('northCourtyardWall', {
            width: courtyardSize,
            height: wallHeight,
            depth: wallThickness
        }, this.scene);
        northCourtyardWall.position = castlePosition.add(new BABYLON.Vector3(0, wallHeight / 2, courtyardSize / 2));
        northCourtyardWall.material = courtyardWallMaterial;
        northCourtyardWall.checkCollisions = true;
        
        // South courtyard wall
        const southCourtyardWall = BABYLON.MeshBuilder.CreateBox('southCourtyardWall', {
            width: courtyardSize,
            height: wallHeight,
            depth: wallThickness
        }, this.scene);
        southCourtyardWall.position = castlePosition.add(new BABYLON.Vector3(0, wallHeight / 2, -courtyardSize / 2));
        southCourtyardWall.material = courtyardWallMaterial;
        southCourtyardWall.checkCollisions = true;
        
        // East courtyard wall
        const eastCourtyardWall = BABYLON.MeshBuilder.CreateBox('eastCourtyardWall', {
            width: wallThickness,
            height: wallHeight,
            depth: courtyardSize
        }, this.scene);
        eastCourtyardWall.position = castlePosition.add(new BABYLON.Vector3(courtyardSize / 2, wallHeight / 2, 0));
        eastCourtyardWall.material = courtyardWallMaterial;
        eastCourtyardWall.checkCollisions = true;
        
        // West courtyard wall with gate (two pieces)
        const gateWidth = 12;
        const westCourtyardWallLeft = BABYLON.MeshBuilder.CreateBox('westCourtyardWallLeft', {
            width: wallThickness,
            height: wallHeight,
            depth: (courtyardSize - gateWidth) / 2
        }, this.scene);
        westCourtyardWallLeft.position = castlePosition.add(new BABYLON.Vector3(-courtyardSize / 2, wallHeight / 2, courtyardSize / 4 + gateWidth / 4));
        westCourtyardWallLeft.material = courtyardWallMaterial;
        westCourtyardWallLeft.checkCollisions = true;
        
        const westCourtyardWallRight = BABYLON.MeshBuilder.CreateBox('westCourtyardWallRight', {
            width: wallThickness,
            height: wallHeight,
            depth: (courtyardSize - gateWidth) / 2
        }, this.scene);
        westCourtyardWallRight.position = castlePosition.add(new BABYLON.Vector3(-courtyardSize / 2, wallHeight / 2, -courtyardSize / 4 - gateWidth / 4));
        westCourtyardWallRight.material = courtyardWallMaterial;
        westCourtyardWallRight.checkCollisions = true;
        
        // Gate towers
        const gateTowerRadius = 2;
        const gateTowerHeight = 12;
        
        const gateTowerPositions = [
            new BABYLON.Vector3(-courtyardSize / 2, gateTowerHeight / 2, gateWidth / 2),
            new BABYLON.Vector3(-courtyardSize / 2, gateTowerHeight / 2, -gateWidth / 2)
        ];
        
        gateTowerPositions.forEach((pos, index) => {
            const gateTower = BABYLON.MeshBuilder.CreateCylinder(`gateTower${index}`, {
                diameter: gateTowerRadius * 2,
                height: gateTowerHeight
            }, this.scene);
            gateTower.position = castlePosition.add(pos);
            gateTower.material = courtyardWallMaterial;
            gateTower.checkCollisions = true;
            
            // Tower roof
            const gateRoof = BABYLON.MeshBuilder.CreateCylinder(`gateRoof${index}`, {
                diameterTop: 0,
                diameterBottom: gateTowerRadius * 2.3,
                height: 3
            }, this.scene);
            gateRoof.position = castlePosition.add(pos).add(new BABYLON.Vector3(0, gateTowerHeight / 2 + 1.5, 0));
            const roofMaterial = new BABYLON.StandardMaterial('gateRoofMat', this.scene);
            roofMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.3, 0.2);
            gateRoof.material = roofMaterial;
            gateRoof.checkCollisions = true;
        });
    }

    /**
     * Create a small village with houses
     */
    private createVillage(): void {
        const villageCenter = new BABYLON.Vector3(-20, 0, 0);
        
        // House material
        const houseMaterial = new BABYLON.StandardMaterial('houseMat', this.scene);
        houseMaterial.diffuseColor = new BABYLON.Color3(0.7, 0.6, 0.5);
        
        // Roof material
        const roofMaterial = new BABYLON.StandardMaterial('houseRoofMat', this.scene);
        roofMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.25, 0.15);
        
        // Create 8 houses in a circular arrangement
        const housePositions = [
            new BABYLON.Vector3(0, 0, 0),
            new BABYLON.Vector3(20, 0, 0),
            new BABYLON.Vector3(10, 0, 15),
            new BABYLON.Vector3(-10, 0, 15),
            new BABYLON.Vector3(-20, 0, 0),
            new BABYLON.Vector3(-10, 0, -15),
            new BABYLON.Vector3(10, 0, -15),
            new BABYLON.Vector3(0, 0, -20)
        ];
        
        housePositions.forEach((offset, index) => {
            const housePos = villageCenter.add(offset);
            
            // House base
            const houseWidth = 8;
            const houseDepth = 8;
            const houseHeight = 6;
            
            const house = BABYLON.MeshBuilder.CreateBox(`house${index}`, {
                width: houseWidth,
                height: houseHeight,
                depth: houseDepth
            }, this.scene);
            house.position = housePos.add(new BABYLON.Vector3(0, houseHeight / 2, 0));
            house.material = houseMaterial;
            house.checkCollisions = true;
            
            // Roof (pyramid shape)
            const roof = BABYLON.MeshBuilder.CreateCylinder(`houseRoof${index}`, {
                diameterTop: 0,
                diameterBottom: houseWidth * 1.4,
                height: 4,
                tessellation: 4
            }, this.scene);
            roof.rotation.y = Math.PI / 4; // Rotate to align with house
            roof.position = housePos.add(new BABYLON.Vector3(0, houseHeight + 2, 0));
            roof.material = roofMaterial;
            roof.checkCollisions = true;
            
            // Door (darker box on front)
            const door = BABYLON.MeshBuilder.CreateBox(`door${index}`, {
                width: 2,
                height: 3,
                depth: 0.2
            }, this.scene);
            door.position = housePos.add(new BABYLON.Vector3(0, 1.5, houseDepth / 2 + 0.1));
            const doorMaterial = new BABYLON.StandardMaterial('doorMat', this.scene);
            doorMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.1);
            door.material = doorMaterial;
            
            // Window
            const window = BABYLON.MeshBuilder.CreateBox(`window${index}`, {
                width: 1.5,
                height: 1.5,
                depth: 0.2
            }, this.scene);
            window.position = housePos.add(new BABYLON.Vector3(2.5, 3, houseDepth / 2 + 0.1));
            const windowMaterial = new BABYLON.StandardMaterial('windowMat', this.scene);
            windowMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.8, 1.0);
            windowMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.3, 0.4);
            window.material = windowMaterial;
        });
        
        // Add a well in the center of the village
        const well = BABYLON.MeshBuilder.CreateCylinder('well', {
            diameter: 3,
            height: 2
        }, this.scene);
        well.position = villageCenter.add(new BABYLON.Vector3(0, 1, 0));
        const wellMaterial = new BABYLON.StandardMaterial('wellMat', this.scene);
        wellMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        well.material = wellMaterial;
        well.checkCollisions = true;
        
        // Well roof structure
        const wellRoof = BABYLON.MeshBuilder.CreateCylinder('wellRoof', {
            diameterTop: 0,
            diameterBottom: 4,
            height: 2
        }, this.scene);
        wellRoof.position = villageCenter.add(new BABYLON.Vector3(0, 3, 0));
        wellRoof.material = roofMaterial;
        wellRoof.checkCollisions = true;
    }

    /**
     * Create outer city wall surrounding castle and village in pentagon shape
     */
    private createOuterCityWall(): void {
        const wallHeight = 12;
        const wallThickness = 2;
        
        const cityWallMaterial = new BABYLON.StandardMaterial('cityWallMat', this.scene);
        cityWallMaterial.diffuseColor = new BABYLON.Color3(0.55, 0.55, 0.6);
        
        // Pentagon vertices to encompass castle (80, 80) with 100x100 courtyard and village (-20, 0)
        // Castle courtyard extends from (30, 0, 30) to (130, 0, 130)
        // Points arranged clockwise: West gate, Northwest, Northeast (castle), Southeast, Southwest
        const pentagonPoints = [
            new BABYLON.Vector3(-70, 0, 40),   // West point (gate location)
            new BABYLON.Vector3(-30, 0, 150),  // Northwest point (past castle north edge at z=130)
            new BABYLON.Vector3(150, 0, 150),  // Northeast point (past castle northeast corner)
            new BABYLON.Vector3(150, 0, -40),  // Southeast point (past castle east edge at x=130)
            new BABYLON.Vector3(-30, 0, -40)   // Southwest point
        ];
        
        // Create helper function to create wall segment between two points
        const createWallSegment = (point1: BABYLON.Vector3, point2: BABYLON.Vector3, name: string, hasGate: boolean = false) => {
            const distance = BABYLON.Vector3.Distance(point1, point2);
            const midpoint = BABYLON.Vector3.Center(point1, point2);
            
            // Calculate rotation angle
            const direction = point2.subtract(point1);
            const angle = Math.atan2(direction.x, direction.z);
            
            if (hasGate) {
                // Split wall into two pieces for gate
                const gateWidth = 15;
                const sideWallLength = (distance - gateWidth) / 2;
                
                // Left side of gate - position at correct offset from midpoint
                const leftWall = BABYLON.MeshBuilder.CreateBox(`${name}Left`, {
                    width: wallThickness,
                    height: wallHeight,
                    depth: sideWallLength
                }, this.scene);
                const leftOffset = direction.normalize().scale(-(sideWallLength / 2 + gateWidth / 2));
                leftWall.position = midpoint.add(leftOffset).add(new BABYLON.Vector3(0, wallHeight / 2, 0));
                leftWall.rotation.y = angle;
                leftWall.material = cityWallMaterial;
                leftWall.checkCollisions = true;
                
                // Right side of gate - position at correct offset from midpoint
                const rightWall = BABYLON.MeshBuilder.CreateBox(`${name}Right`, {
                    width: wallThickness,
                    height: wallHeight,
                    depth: sideWallLength
                }, this.scene);
                const rightOffset = direction.normalize().scale(sideWallLength / 2 + gateWidth / 2);
                rightWall.position = midpoint.add(rightOffset).add(new BABYLON.Vector3(0, wallHeight / 2, 0));
                rightWall.rotation.y = angle;
                rightWall.material = cityWallMaterial;
                rightWall.checkCollisions = true;
                
                // Gate towers at the edges of the gate opening
                const mainGateTowerRadius = 4;
                const mainGateTowerHeight = 18;
                
                const gateOffset1 = direction.normalize().scale(gateWidth / 2);
                const gateOffset2 = direction.normalize().scale(-gateWidth / 2);
                
                [gateOffset1, gateOffset2].forEach((offset, index) => {
                    const gateTower = BABYLON.MeshBuilder.CreateCylinder(`mainGateTower${name}${index}`, {
                        diameter: mainGateTowerRadius * 2,
                        height: mainGateTowerHeight
                    }, this.scene);
                    gateTower.position = midpoint.add(offset).add(new BABYLON.Vector3(0, mainGateTowerHeight / 2, 0));
                    gateTower.material = cityWallMaterial;
                    gateTower.checkCollisions = true;
                    
                    // Tower roof
                    const gateRoof = BABYLON.MeshBuilder.CreateCylinder(`mainGateRoof${name}${index}`, {
                        diameterTop: 0,
                        diameterBottom: mainGateTowerRadius * 2.5,
                        height: 5
                    }, this.scene);
                    gateRoof.position = midpoint.add(offset).add(new BABYLON.Vector3(0, mainGateTowerHeight / 2 + 2.5, 0));
                    const roofMaterial = new BABYLON.StandardMaterial('gateRoofMat', this.scene);
                    roofMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.3, 0.2);
                    gateRoof.material = roofMaterial;
                    gateRoof.checkCollisions = true;
                });
            } else {
                // Create solid wall
                const wall = BABYLON.MeshBuilder.CreateBox(name, {
                    width: wallThickness,
                    height: wallHeight,
                    depth: distance
                }, this.scene);
                wall.position = midpoint.add(new BABYLON.Vector3(0, wallHeight / 2, 0));
                wall.rotation.y = angle;
                wall.material = cityWallMaterial;
                wall.checkCollisions = true;
            }
        };
        
        // Create five wall segments
        createWallSegment(pentagonPoints[0], pentagonPoints[1], 'westNorthWall', true); // West gate
        createWallSegment(pentagonPoints[1], pentagonPoints[2], 'northWall', false);
        createWallSegment(pentagonPoints[2], pentagonPoints[3], 'eastWall', false);
        createWallSegment(pentagonPoints[3], pentagonPoints[4], 'southWall', false);
        createWallSegment(pentagonPoints[4], pentagonPoints[0], 'westSouthWall', false);
        
        // Corner watchtowers at each vertex
        const watchtowerRadius = 3;
        const watchtowerHeight = 16;
        
        pentagonPoints.forEach((point, index) => {
            const watchtower = BABYLON.MeshBuilder.CreateCylinder(`watchtower${index}`, {
                diameter: watchtowerRadius * 2,
                height: watchtowerHeight
            }, this.scene);
            watchtower.position = point.add(new BABYLON.Vector3(0, watchtowerHeight / 2, 0));
            watchtower.material = cityWallMaterial;
            watchtower.checkCollisions = true;
            
            // Watchtower roof
            const watchtowerRoof = BABYLON.MeshBuilder.CreateCylinder(`watchtowerRoof${index}`, {
                diameterTop: 0,
                diameterBottom: watchtowerRadius * 2.3,
                height: 4
            }, this.scene);
            watchtowerRoof.position = point.add(new BABYLON.Vector3(0, watchtowerHeight / 2 + 2, 0));
            const roofMaterial = new BABYLON.StandardMaterial('watchtowerRoofMat', this.scene);
            roofMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.3, 0.2);
            watchtowerRoof.material = roofMaterial;
            watchtowerRoof.checkCollisions = true;
        });
    }

    /**
     * Create a cave entrance with walkable interior
     */
    private createCave(): void {
        const cavePosition = new BABYLON.Vector3(-100, 0, -100);
        
        // Cave entrance (large sphere carved out)
        const caveMaterial = new BABYLON.StandardMaterial('caveMat', this.scene);
        caveMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.25, 0.2);
        
        // Main hill/mountain
        const hill = BABYLON.MeshBuilder.CreateSphere('hill', {
            diameter: 40,
            segments: 16
        }, this.scene);
        hill.position = cavePosition.add(new BABYLON.Vector3(0, 15, 0));
        hill.scaling.y = 0.6; // Flatten it
        hill.material = caveMaterial;
        hill.checkCollisions = true;
        
        // Cave entrance tunnel
        const entranceTunnel = BABYLON.MeshBuilder.CreateCylinder('entranceTunnel', {
            diameter: 10,
            height: 20
        }, this.scene);
        entranceTunnel.rotation.z = Math.PI / 2; // Rotate to horizontal
        entranceTunnel.position = cavePosition.add(new BABYLON.Vector3(-10, 5, 0));
        const tunnelMaterial = new BABYLON.StandardMaterial('tunnelMat', this.scene);
        tunnelMaterial.diffuseColor = new BABYLON.Color3(0.15, 0.12, 0.1);
        tunnelMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.05);
        entranceTunnel.material = tunnelMaterial;
        
        // Cave interior chamber (invisible walls for collision)
        const chamberWidth = 30;
        const chamberHeight = 12;
        const chamberDepth = 30;
        
        // Create invisible box for cave interior bounds
        const caveInteriorPos = cavePosition.add(new BABYLON.Vector3(-25, chamberHeight / 2, 0));
        
        // Cave floor
        const caveFloor = BABYLON.MeshBuilder.CreateGround('caveFloor', {
            width: chamberWidth,
            height: chamberDepth
        }, this.scene);
        caveFloor.position = caveInteriorPos.add(new BABYLON.Vector3(0, -chamberHeight / 2 + 0.5, 0));
        const caveFloorMaterial = new BABYLON.StandardMaterial('caveFloorMat', this.scene);
        caveFloorMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.18, 0.15);
        caveFloor.material = caveFloorMaterial;
        caveFloor.checkCollisions = true;
        
        // Add some rocks inside cave
        for (let i = 0; i < 5; i++) {
            const rock = BABYLON.MeshBuilder.CreateSphere(`caveRock${i}`, {
                diameter: 3 + Math.random() * 3,
                segments: 8
            }, this.scene);
            rock.position = caveInteriorPos.add(new BABYLON.Vector3(
                (Math.random() - 0.5) * 20,
                -chamberHeight / 2 + 1.5,
                (Math.random() - 0.5) * 20
            ));
            rock.scaling.y = 0.6;
            rock.material = caveMaterial;
            rock.checkCollisions = true;
        }
        
        // Add dim lighting in cave
        const caveLight = new BABYLON.PointLight('caveLight', caveInteriorPos, this.scene);
        caveLight.diffuse = new BABYLON.Color3(1, 0.8, 0.5);
        caveLight.intensity = 0.3;
        caveLight.range = 50;
    }

    /**
     * Update camera to follow player
     * Camera stays behind player and rotates with them
     * Only updates if user is not manually controlling camera
     */
    private updateCamera(): void {
        if (!this.localPlayer || this.userControllingCamera) {
            return;
        }

        const playerMesh = this.localPlayer.getMesh();
        const playerRotation = playerMesh.rotation.y;

        // Update camera target to player position
        this.camera.target = playerMesh.position;

        // Set camera angle to be behind the player (offset by player's rotation)
        // Adding Math.PI positions camera behind player, subtracting player rotation makes it follow
        this.camera.alpha = -playerRotation - Math.PI / 2;
    }

    public dispose(): void {
        console.log('Disposing game, cleaning up resources...');
        
        // Clean up local player
        if (this.localPlayer) {
            this.localPlayer.dispose();
            this.localPlayer = null;
        }
        
        // Clean up handlers (which clean up remote players and trees)
        this.playerHandler.dispose();
        this.woodcuttingHandler.dispose();
        
        // Disconnect from network
        this.network.disconnect();
        this.engine.dispose();
    }
}

export default Game;