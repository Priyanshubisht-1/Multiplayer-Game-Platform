const roomHandler = require("./roomHandler")
const controllerHandler = require("./controllerHandler")
const gameHandler = require("./gameHandler")

module.exports = (io, roomManager) => {
    io.on("connection", (socket) => {
        const playerId = socket.handshake.auth?.playerId

        if (!playerId || typeof playerId !== "string") {
            console.log("[Socket] Missing or invalid playerId. Disconnecting.")
            socket.disconnect(true)
            return
        }

        socket.playerId = playerId

        console.log(
            `[Socket] Connected | socketId=${socket.id} | playerId=${socket.playerId}`
        )

        roomHandler(io, socket, roomManager)
        controllerHandler(io, socket, roomManager)
        gameHandler(io, socket, roomManager)

        socket.on("disconnect", (reason) => {
            console.log(
                `[Socket] Disconnected | playerId=${socket.playerId} | reason=${reason}`
            )

            roomManager.removeParticipant(socket)
        })
    })
}