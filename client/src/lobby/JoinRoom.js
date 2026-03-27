import socket from "../core/socket"
import EVENTS from "../shared/events"
import { renderLobby } from "./renderLobby"

export function setupJoinRoom() {
    const joinBtn = document.getElementById("join-room-btn")
    const input = document.getElementById("room-id-input")

    if (!joinBtn || !input) return

    joinBtn.addEventListener("click", () => {
        const roomId = input.value.trim().toUpperCase()

        if (!roomId) {
            alert("Enter room ID")
            return
        }

        socket.emit(EVENTS.ROOM.JOIN, { roomId })
    })

    socket.once(EVENTS.ROOM.JOINED, (data) => {
        renderLobby(data.lobby, false)
    })

    socket.once(EVENTS.ROOM.ERROR, (err) => {
        alert(err.message || "Room error")
    })
}