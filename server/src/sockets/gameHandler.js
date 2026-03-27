const EVENTS = require("../shared/events")

module.exports = (io, socket, roomManager) => {
    socket.on(EVENTS.GAME.SELECT, (data = {}) => {
        try {
            const room = roomManager.getRoomByPlayer(socket.playerId)
            if (!room) {
                socket.emit(EVENTS.GAME.ERROR, { message: "Room not found" })
                return
            }

            if (!room.isHost(socket.playerId)) {
                socket.emit(EVENTS.GAME.ERROR, { message: "Only host can select the game" })
                return
            }

            const gameName = data.game
            if (!gameName) {
                socket.emit(EVENTS.GAME.ERROR, { message: "Game name required" })
                return
            }

            room.setSelectedGame(gameName)
        } catch (err) {
            console.error("[GameHandler] SELECT error:", err.message)
            socket.emit(EVENTS.GAME.ERROR, { message: "Failed to select game" })
        }
    })

    socket.on(EVENTS.GAME.START, (data = {}) => {
        try {
            const room = roomManager.getRoomByPlayer(socket.playerId)
            if (!room) {
                socket.emit(EVENTS.GAME.ERROR, { message: "Room not found" })
                return
            }

            if (!room.isHost(socket.playerId)) {
                socket.emit(EVENTS.GAME.ERROR, { message: "Only host can start the game" })
                return
            }

            const gameName = data.game || room.selectedGame
            if (!gameName) {
                socket.emit(EVENTS.GAME.ERROR, { message: "Game name required" })
                return
            }

            room.loadGame(gameName)

            io.to(room.id).emit(EVENTS.GAME.STARTED, {
                roomId: room.id,
                game: gameName
            })
        } catch (err) {
            console.error("[GameHandler] START error:", err.message)
            socket.emit(EVENTS.GAME.ERROR, { message: "Failed to start game" })
        }
    })
}