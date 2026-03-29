const EVENTS = require("../shared/events");
const { getGameById } = require("../shared/games");

module.exports = (io, socket, roomManager) => {
  socket.on(EVENTS.GAME.SELECT, (data = {}) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.playerId);
      if (!room) {
        socket.emit(EVENTS.GAME.ERROR, { message: "Room not found" });
        return;
      }

      if (!room.isHost(socket.playerId)) {
        socket.emit(EVENTS.GAME.ERROR, {
          message: "Only host can select the game",
        });
        return;
      }

      const gameName = data.game;
      if (!gameName) {
        socket.emit(EVENTS.GAME.ERROR, { message: "Game name required" });
        return;
      }

      room.setSelectedGame(gameName);
    } catch (err) {
      console.error("[GameHandler] SELECT error:", err.message);
      socket.emit(EVENTS.GAME.ERROR, { message: "Failed to select game" });
    }
  });

  socket.on(EVENTS.GAME.START, (data = {}) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.playerId);
      if (!room) {
        socket.emit(EVENTS.GAME.ERROR, { message: "Room not found" });
        return;
      }

      if (!room.isHost(socket.playerId)) {
        socket.emit(EVENTS.GAME.ERROR, {
          message: "Only host can start the game",
        });
        return;
      }

      const gameName = data.game || room.selectedGame;
      if (!gameName) {
        socket.emit(EVENTS.GAME.ERROR, { message: "Game name required" });
        return;
      }

      const connectedControllers = Object.values(room.players).filter(
        (player) => player.connected,
      );

      const gameConfig = getGameById(gameName);

      if (!gameConfig) {
        socket.emit(EVENTS.GAME.ERROR, { message: "Invalid game" });
        return;
      }

      if (connectedControllers.length < gameConfig.minPlayers) {
        socket.emit(EVENTS.GAME.ERROR, {
          message: `Minimum ${gameConfig.minPlayers} players required`,
        });
        return;
      }

      if (connectedControllers.length > gameConfig.maxPlayers) {
        socket.emit(EVENTS.GAME.ERROR, {
          message: `Maximum ${gameConfig.maxPlayers} players allowed`,
        });
        return;
      }

      room.loadGame(gameName);

      io.to(room.id).emit(EVENTS.GAME.STARTED, {
        roomId: room.id,
        game: gameName,
      });
    } catch (err) {
      console.error("[GameHandler] START error:", err.message);
      socket.emit(EVENTS.GAME.ERROR, { message: "Failed to start game" });
    }
  });
  socket.on(EVENTS.GAME.END, () => {
    const room = roomManager.getRoomByPlayer(socket.playerId);
    if (!room) return;

    if (!room.isHost(socket.playerId)) return;

    room.resetToLobby();
  });
};
