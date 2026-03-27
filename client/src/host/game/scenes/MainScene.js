import Phaser from "phaser"
import GameManager from "../GameManager.js"

export default class MainScene extends Phaser.Scene {
    constructor() {
        super("MainScene")
        this.hostRenderer = null
    }

    create() {
        console.log("[Phaser] MainScene ready")
        GameManager.setScene(this)
    }

    async setHostRenderer(renderer) {
        if (this.hostRenderer && typeof this.hostRenderer.destroy === "function") {
            this.hostRenderer.destroy()
        }

        this.hostRenderer = renderer
    }

    syncState(state) {
        if (!this.hostRenderer || typeof this.hostRenderer.syncState !== "function") {
            return
        }

        this.hostRenderer.syncState(state)
    }

    update(time, delta) {
        if (!this.hostRenderer || typeof this.hostRenderer.update !== "function") {
            return
        }

        this.hostRenderer.update(delta)
    }
}