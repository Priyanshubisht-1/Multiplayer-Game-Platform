import socket from "../core/socket"
import EVENTS from "../shared/events"
import { renderLobby } from "./renderLobby"

export function setupCreateRoom() {
    const createBtn = document.getElementById("create-room-btn")

    if (!createBtn) return

    createBtn.addEventListener("click", () => {
        socket.emit(EVENTS.ROOM.CREATE, {})
    })

    // Use .once() so the handler doesn't stack on repeated calls
    socket.once(EVENTS.ROOM.CREATED, (data) => {
        renderLobby(data.lobby, true)
    })

    socket.once(EVENTS.ROOM.ERROR, (err) => {
        alert(err.message || "Room error")
    })
}