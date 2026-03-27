import socket from "./core/socket.js"
import EVENTS from "./shared/events.js"
import { setupCreateRoom } from "./lobby/CreateRoom.js"
import { setupJoinRoom } from "./lobby/JoinRoom.js"
import { renderLobby } from "./lobby/renderLobby.js"
import { mountHostGame } from "./host/index.js"
import { mountControllerScreen } from "./controller/index.js"
import GameManager from "./host/game/GameManager.js"

const params = new URLSearchParams(window.location.search)
const mode = params.get("mode")

function init() {
    if (mode === "host") {
        renderHostLobbyEntry()
    } else if (mode === "controller") {
        renderControllerLobbyEntry()
    } else {
        renderModeError()
    }

    // Single, persistent ROOM.UPDATE listener for the whole session
    socket.on(EVENTS.ROOM.UPDATE, (lobby) => {
        const playerId = localStorage.getItem("playerId")
        const isHost = lobby.hostId === playerId
        renderLobby(lobby, isHost)
    })

    socket.on(EVENTS.GAME.STARTED, async ({ game }) => {
        console.log("[Main] Game started:", game)

        if (mode === "host") {
            mountHostGame()

            await GameManager.waitForScene()
            await GameManager.setGame(game)
        } else if (mode === "controller") {
            mountControllerScreen(game)
        }
    })

    socket.on(EVENTS.GAME.ERROR, (err) => {
        console.error("[Main] Game error:", err.message)
    })
}

function renderHostLobbyEntry() {
    const app = document.getElementById("app")
    if (!app) return

    app.innerHTML = `
        <div style="padding:20px">
            <h1>Host Lobby</h1>
            <button id="create-room-btn">Create Room</button>
        </div>
    `

    setupCreateRoom()
}

function renderControllerLobbyEntry() {
    const app = document.getElementById("app")
    if (!app) return

    app.innerHTML = `
        <div style="padding:20px">
            <h1>Join Room</h1>
            <input id="room-id-input" placeholder="Enter Room ID" />
            <button id="join-room-btn">Join Room</button>
        </div>
    `

    setupJoinRoom()
}

function renderModeError() {
    const app = document.getElementById("app")
    if (!app) return

    app.innerHTML = `
        <div style="padding:20px">
            <h2>Invalid mode</h2>
            <p>Use ?mode=host or ?mode=controller</p>
        </div>
    `
}

init()