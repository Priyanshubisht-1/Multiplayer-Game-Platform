class GameLoop {
    constructor(roomManager) {
        if (!roomManager) {
            throw new Error("GameLoop requires a RoomManager")
        }

        this.roomManager = roomManager

        /**
         * Loop settings
         */
        this.TPS = 60                          // ticks per second
        this.INTERVAL = 1000 / this.TPS        // ~16.67 ms

        /**
         * Timing
         */
        this.lastTime = Date.now()

        /**
         * Loop control
         */
        this.timer = null
        this.running = false
    }

    /**
     * Start the loop
     */
    start() {
        if (this.running) return

        this.running = true
        this.lastTime = Date.now()

        this.timer = setInterval(() => {
            this._tick()
        }, this.INTERVAL)

        console.log(`[GameLoop] Started at ${this.TPS} TPS`)
    }

    /**
     * Stop the loop
     */
    stop() {
        if (!this.running) return

        clearInterval(this.timer)
        this.running = false

        console.log("[GameLoop] Stopped")
    }

    /**
     * Single tick execution
     */
    _tick() {
        const now = Date.now()
        const delta = now - this.lastTime
        this.lastTime = now

        const rooms = this.roomManager.getAllRooms()

        for (let room of rooms) {
            try {
                room.update(delta)
            } catch (err) {
                console.error(`[GameLoop] Error in room ${room.id}:`, err.message)
            }
        }
    }
}

module.exports = GameLoop