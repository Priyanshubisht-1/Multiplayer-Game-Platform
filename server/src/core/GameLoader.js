const path = require("path")
const fs = require("fs")

class GameLoader {

    static load(gameName, room) {
        try {
            if (!gameName || typeof gameName !== "string") {
                throw new Error("Invalid game name")
            }

            // Normalize game name
            const normalized = gameName.toLowerCase()

            // Build file path
            const gameFileName = this._formatGameClassName(normalized)
            const gamePath = path.join(__dirname, `../games/${normalized}/${gameFileName}`)

            // Check if file exists
            if (!fs.existsSync(gamePath)) {
                throw new Error(`Game file not found: ${gamePath}`)
            }

            // Clear cache (important for development hot reload)
            delete require.cache[require.resolve(gamePath)]

            const GameClass = require(gamePath)

            // Validate class
            if (typeof GameClass !== "function") {
                throw new Error("Game module does not export a class")
            }

            const instance = new GameClass(room)

            // Validate required methods (basic contract enforcement)
            this._validateGame(instance)

            return instance

        } catch (err) {
            console.error("[GameLoader] Load failed:", err.message)
            return null
        }
    }

    /**
     * Convert "tag" → "TagGame.js"
     */
    static _formatGameClassName(name) {
        const capitalized = name.charAt(0).toUpperCase() + name.slice(1)
        return `${capitalized}Game.js`
    }

    /**
     * Validate game implements required methods
     */
    static _validateGame(gameInstance) {
        const requiredMethods = [
            "init",
            "update",
            "handleInput",
            "getState"
        ]

        requiredMethods.forEach(method => {
            if (typeof gameInstance[method] !== "function") {
                throw new Error(`Game missing method: ${method}`)
            }
        })
    }

    /**
     * Optional: List all available games dynamically
     * (Useful for game selection UI later)
     */
    static listAvailableGames() {
        const gamesDir = path.join(__dirname, "../games")

        try {
            const folders = fs.readdirSync(gamesDir)

            return folders.filter(folder => {
                const fullPath = path.join(gamesDir, folder)
                return fs.statSync(fullPath).isDirectory()
            })

        } catch (err) {
            console.error("[GameLoader] Failed to list games:", err.message)
            return []
        }
    }
}

module.exports = GameLoader