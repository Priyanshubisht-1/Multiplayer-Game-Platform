const GameLoader = require("../core/GameLoader")
const EVENTS = require("../shared/events")

class Room {
    constructor(id, io) {
        if (!id) {
            throw new Error("Room must have an ID")
        }

        this.id = id
        this.io = io

        this.hostId = null
        this.players = {}
        this.game = null
        this.selectedGame = null
        this.status = "waiting"
        this.createdAt = Date.now()
    }

    setHost(socket) {
        if (!socket || !socket.playerId) return

        this.hostId = socket.playerId
        socket.join(this.id)

        this.broadcastRoomUpdate()
    }

    addPlayer(socket) {
        if (!socket || !socket.playerId) return

        this.players[socket.playerId] = {
            id: socket.playerId,
            name: socket.playerName || `Player_${Object.keys(this.players).length + 1}`,
            connected: true
        }

        socket.join(this.id)

        if (this.game) {
            this.game.addPlayer(socket.playerId)
        }

        this.broadcastRoomUpdate()
    }

    removeParticipant(socket) {
        if (!socket || !socket.playerId) return

        if (this.hostId === socket.playerId) {
            this.hostId = null
            socket.leave(this.id)
            this.broadcastRoomUpdate()
            return
        }

        if (this.players[socket.playerId]) {
            delete this.players[socket.playerId]
            socket.leave(this.id)

            if (this.game) {
                this.game.removePlayer(socket.playerId)
            }

            this.broadcastRoomUpdate()
        }
    }

    setSelectedGame(gameName) {
        this.selectedGame = gameName
        this.broadcastRoomUpdate()
    }

    loadGame(gameName) {
        this.selectedGame = gameName
        this.game = GameLoader.load(gameName, this)

        if (!this.game) {
            throw new Error("Failed to load game")
        }

        Object.keys(this.players).forEach((playerId) => {
            this.game.addPlayer(playerId)
        })

        this.game.init()
        this.game.start()
        this.status = "running"

        this.broadcastRoomUpdate()
    }

    handleInput(playerId, data) {
        if (!this.game) return
        if (!this.players[playerId]) return
        if (!this.game.isRunning()) return

        this.game.handleInput(playerId, data)
    }

    update(delta) {
        if (!this.game) return
        if (!this.game.isRunning()) return

        this.game.update(delta)
        this.broadcastGameState()
    }

    getLobbyState() {
        return {
            roomId: this.id,
            hostId: this.hostId,
            players: Object.values(this.players),
            selectedGame: this.selectedGame,
            status: this.status
        }
    }

    broadcastRoomUpdate() {
        this.io.to(this.id).emit(EVENTS.ROOM.UPDATE, this.getLobbyState())
    }

    broadcastGameState() {
        if (!this.game) return
        this.io.to(this.id).emit(EVENTS.GAME.STATE, this.game.getState())
    }

    isHost(playerId) {
        return this.hostId === playerId
    }

    isEmpty() {
        return !this.hostId && Object.keys(this.players).length === 0
    }

    destroy() {
        if (this.game) {
            this.game.destroy()
        }

        this.hostId = null
        this.players = {}
        this.game = null
        this.selectedGame = null
    }
}

module.exports = Room