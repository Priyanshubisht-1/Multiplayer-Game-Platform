const EVENTS = require("../shared/events")

module.exports = (io, socket, roomManager) => {
    socket.on(EVENTS.INPUT.MOVE, (data) => {
        if (!data || typeof data !== "object") return

        const room = roomManager.getRoomByPlayer(socket.playerId)
        if (!room) return
        room.handleInput(socket.playerId, data)
    })

    socket.on(EVENTS.INPUT.ACTION, (data) => {
        if (!data || typeof data !== "object") return

        const room = roomManager.getRoomByPlayer(socket.playerId)
        if (!room) return

        room.handleInput(socket.playerId, data)
    })
}