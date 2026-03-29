const EVENTS = require("../shared/events");
const { getGameById } = require("../shared/games");
module.exports = (io, socket, roomManager) => {
  socket.on(EVENTS.ROOM.CREATE, (data = {}) => {
    try {
      let roomId = data.roomId;

      if (!roomId) {
        roomId = generateRoomId();
      }

      if (roomManager.hasRoom(roomId)) {
        socket.emit(EVENTS.ROOM.ERROR, { message: "Room already exists" });
        return;
      }

      roomManager.createRoom(roomId);
      const room = roomManager.attachHostToRoom(roomId, socket);

      socket.emit(EVENTS.ROOM.CREATED, {
        success: true,
        roomId,
        lobby: room.getLobbyState(),
      });
    } catch (err) {
      console.error("[RoomHandler] CREATE error:", err.message);
      socket.emit(EVENTS.ROOM.ERROR, { message: "Failed to create room" });
    }
  });

  socket.on(EVENTS.ROOM.JOIN, (data = {}) => {
    try {
      const { roomId, name } = data;

      if (name && typeof name === "string") {
        socket.playerName = name;
      }

      if (!roomId) {
        socket.emit(EVENTS.ROOM.ERROR, { message: "Room ID required" });
        return;
      }

      const room = roomManager.getRoom(roomId);
      if (!room) {
        socket.emit(EVENTS.ROOM.ERROR, { message: "Room not found" });
        return;
      }

      const existingPlayer = room.players[socket.playerId];

      if (room.status === "running" && !existingPlayer) {
        socket.emit(EVENTS.ROOM.ERROR, {
          message:
            "Room is currently running a game. Please wait for the next round.",
        });
        return;
      }
      const gameConfig = getGameById(room.selectedGame);

      if (room.status === "waiting" && gameConfig) {
        const playerCount = Object.keys(room.players).length;

        if (playerCount >= gameConfig.maxPlayers) {
          socket.emit(EVENTS.ROOM.ERROR, {
            message: "Room is full",
          });
          return;
        }
      }

      if (typeof name === "string" && name.trim()) {
        socket.playerName = name.trim();
      }

      roomManager.addPlayerToRoom(roomId, socket);

      socket.emit(EVENTS.ROOM.JOINED, {
        success: true,
        roomId,
        lobby: room.getLobbyState(),
      });
    } catch (err) {
      console.error("[RoomHandler] JOIN error:", err.message);
      socket.emit(EVENTS.ROOM.ERROR, { message: "Failed to join room" });
    }
  });

  socket.on(EVENTS.ROOM.LEAVE, () => {
    try {
      roomManager.removeParticipant(socket);
    } catch (err) {
      console.error("[RoomHandler] LEAVE error:", err.message);
      socket.emit(EVENTS.ROOM.ERROR, { message: "Failed to leave room" });
    }
  });
};

function generateRoomId() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}
