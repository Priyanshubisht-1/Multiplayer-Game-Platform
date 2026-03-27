import socket from "../core/socket"
import EVENTS from "../shared/events"
import GAMES from "../shared/games"

export function renderLobby(lobby, isHost) {
    const app = document.getElementById("app")
    if (!app) return

    const playersHtml = lobby.players
        .map(player => {
            const isHostPlayer = player.id === lobby.hostId
            return `<li>${player.name}${isHostPlayer ? " (Host)" : ""}</li>`
        })
        .join("")

    const gameButtons = GAMES.map(g => {
        const isSelected = lobby.selectedGame === g.id

        return `
            <button
                class="game-btn ${isSelected ? "selected" : ""}"
                data-game="${g.id}"
                style="
                    padding:10px 14px;
                    margin:6px;
                    border:2px solid ${isSelected ? "#22c55e" : "#999"};
                    background:${isSelected ? "#dcfce7" : "#fff"};
                    color:#111;
                    border-radius:8px;
                    cursor:pointer;
                    font-weight:${isSelected ? "700" : "400"};
                "
            >
                ${g.name}
            </button>
        `
    }).join("")

    app.innerHTML = `
        <div style="padding:20px; font-family:Arial, sans-serif;">
            <h2>Room: ${lobby.roomId}</h2>
            <p>Status: ${lobby.status}</p>
            <p>Selected Game: ${lobby.selectedGame || "None"}</p>

            <h3>Players</h3>
            <ul>${playersHtml}</ul>

            ${
                isHost
                    ? `
                        <div style="margin-top:20px;">
                            <h3>Select Game</h3>
                            <div id="game-list">
                                ${gameButtons}
                            </div>

                            <button
                                id="start-game-btn"
                                style="
                                    margin-top:16px;
                                    padding:10px 16px;
                                    border:none;
                                    border-radius:8px;
                                    background:#2563eb;
                                    color:white;
                                    cursor:pointer;
                                "
                            >
                                Start Game
                            </button>
                        </div>
                    `
                    : `
                        <p>Waiting for host to start the game...</p>
                    `
            }
        </div>
    `

    if (isHost) {
        attachHostHandlers(lobby)
    }
}

function attachHostHandlers(lobby) {
    const buttons = document.querySelectorAll(".game-btn")

    buttons.forEach(btn => {
        btn.onclick = () => {
            const game = btn.dataset.game
            socket.emit(EVENTS.GAME.SELECT, { game })
        }
    })

    const startBtn = document.getElementById("start-game-btn")

    if (startBtn) {
        startBtn.onclick = () => {
            if (!lobby.selectedGame) {
                alert("Select a game first")
                return
            }

            socket.emit(EVENTS.GAME.START, {
                game: lobby.selectedGame
            })
        }
    }
}

// ROOM.UPDATE is handled in main.js to avoid re-registering on every render cycle