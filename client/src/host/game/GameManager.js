import { loadHostModule, clearActiveHostModule } from "../HostLoader.js"

class GameManager {
    constructor() {
        this.scene = null
        this.currentGame = null
        this.pendingGame = null
        this.readyResolvers = []
    }

    setScene(scene) {
        this.scene = scene

        // Resolve anything waiting for scene readiness
        this.readyResolvers.forEach(resolve => resolve(scene))
        this.readyResolvers = []

        // Apply pending game if it exists
        if (this.pendingGame) {
            const game = this.pendingGame
            this.pendingGame = null
            this.setGame(game)
        }
    }

    waitForScene() {
        if (this.scene) {
            return Promise.resolve(this.scene)
        }

        return new Promise(resolve => {
            this.readyResolvers.push(resolve)
        })
    }

    async setGame(game) {
        if (!this.scene) {
            this.pendingGame = game
            return
        }

        if (this.currentGame === game) {
            return
        }

        this.currentGame = game

        clearActiveHostModule()

        const renderer = await loadHostModule(game, this.scene)
        await this.scene.setHostRenderer(renderer)
    }

    updateState(state) {
        if (!this.scene) return
        this.scene.syncState(state)
    }

    reset() {
        this.currentGame = null
        this.pendingGame = null
    }
}

export default new GameManager()