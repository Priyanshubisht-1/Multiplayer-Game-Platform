
class BaseGame {
    constructor(room) {
        if (!room) {
            throw new Error("Game must be initialized with a room")
        }

        this.room = room

        /**
         * Core game state
         */
        this.state = {
            players: {},   // { playerId: { x, y, ... } }
            meta: {}       // game-specific metadata
        }

        /**
         * Game lifecycle
         */
        this.phase = "waiting"   // waiting | running | ended

        /**
         * Timing
         */
        this.lastUpdateTime = Date.now()
    }

    /**
     * Initialize game
     * Called when game starts
     */
    init() {
        throw new Error("init() must be implemented by game")
    }

    /**
     * Game loop update
     * @param {number} delta - time since last update (ms)
     */
    update(delta) {
        throw new Error("update(delta) must be implemented by game")
    }

    /**
     * Handle player input
     * @param {string} playerId
     * @param {object} input
     */
    handleInput(playerId, input) {
        throw new Error("handleInput(playerId, input) must be implemented")
    }

    /**
     * Add player to game
     */
    addPlayer(playerId) {
        if (!playerId) return

        // Default spawn logic (can be overridden)
        this.state.players[playerId] = {
            x: 100,
            y: 100,
            speed: 5,
            lastInputTime: 0
        }
    }

    /**
     * Remove player from game
     */
    removePlayer(playerId) {
        if (!playerId) return

        delete this.state.players[playerId]
    }

    /**
     * Get current game state
     * This is what gets sent to clients
     */
    getState() {
        return this.state
    }

    /**
     * Utility: Check if game is running
     */
    isRunning() {
        return this.phase === "running"
    }

    /**
     * Utility: Start game
     */
    start() {
        this.phase = "running"
        this.lastUpdateTime = Date.now()
    }

    /**
     * Utility: End game
     */
    end() {
        this.phase = "ended"
    }

    /**
     * Utility: Validate player exists
     */
    hasPlayer(playerId) {
        return !!this.state.players[playerId]
    }

    /**
     * Utility: Clamp position inside bounds
     */
    clampPosition(player, width = 800, height = 600) {
        if (!player) return

        player.x = Math.max(0, Math.min(width, player.x))
        player.y = Math.max(0, Math.min(height, player.y))
    }

    /**
     * Utility: Basic rate limiting per player
     */
    canProcessInput(player, delay = 50) {
        const now = Date.now()

        if (now - player.lastInputTime < delay) {
            return false
        }

        player.lastInputTime = now
        return true
    }

    /**
     * Cleanup (called when room/game is destroyed)
     */
    destroy() {
        this.state = null
        this.room = null
    }
}

module.exports = BaseGame