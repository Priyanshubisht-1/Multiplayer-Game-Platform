import Phaser from "phaser"
import socket from "../core/socket.js"
import EVENTS from "../shared/events.js"
import GameManager from "./game/GameManager.js"
import MainScene from "./game/scenes/MainScene.js"

let gameInstance = null
let stateListenerAttached = false

export function mountHostGame() {
    if (gameInstance) {
        return gameInstance
    }

    const app = document.getElementById("app")
    if (!app) return null

    app.innerHTML = `<div id="phaser-root"></div>`

    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: "phaser-root",
        backgroundColor: "#222222",
        scene: [MainScene]
    }

    gameInstance = new Phaser.Game(config)

    if (!stateListenerAttached) {
        socket.on(EVENTS.GAME.STATE, (state) => {
            GameManager.updateState(state)
        })

        stateListenerAttached = true
    }

    return gameInstance
}