const roomHandler = require("./roomHandler");
const controllerHandler = require("./controllerHandler");
const gameHandler = require("./gameHandler");

module.exports = (io, roomManager) => {
  io.on("connection", (socket) => {
    const playerId = socket.handshake.auth?.playerId;
    const existingRoom = roomManager.getRoomByPlayer(socket.playerId);

    if (existingRoom) {
      console.log("[Reconnect] Restoring player:", socket.playerId);

      // Re-attach player to room
      socket.join(existingRoom.id);

      // Mark connected again
      if (existingRoom.players[socket.playerId]) {
        existingRoom.players[socket.playerId].connected = true;
      }

      existingRoom.broadcastRoomUpdate();
    }
    if (!playerId || typeof playerId !== "string") {
      console.log("[Socket] Missing or invalid playerId. Disconnecting.");
      socket.disconnect(true);
      return;
    }

    socket.playerId = playerId;

    console.log(
      `[Socket] Connected | socketId=${socket.id} | playerId=${socket.playerId}`,
    );

    roomHandler(io, socket, roomManager);
    controllerHandler(io, socket, roomManager);
    gameHandler(io, socket, roomManager);

    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket] Disconnected | playerId=${socket.playerId} | reason=${reason}`,
      );

      roomManager.removeParticipant(socket);
    });
  });
};
