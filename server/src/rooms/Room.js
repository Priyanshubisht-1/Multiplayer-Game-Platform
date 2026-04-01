const GameLoader = require("../core/GameLoader");
const EVENTS = require("../shared/events");
const COLORS = [
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ffff00",
  "#a855f7",
  "#14b8a6",
];
class Room {
  constructor(id, io) {
    if (!id) {
      throw new Error("Room must have an ID");
    }

    this.id = id;
    this.io = io;

    this.hostId = null;
    this.players = {};
    this.game = null;
    this.selectedGame = null;
    this.status = "waiting";
    this.createdAt = Date.now();
  }

  setHost(socket) {
    if (!socket || !socket.playerId) return;

    this.hostId = socket.playerId;
    socket.join(this.id);

    this.broadcastRoomUpdate();
  }

  addPlayer(socket) {
    if (!socket || !socket.playerId) return;

    const playerId = socket.playerId;

    if (this.players[playerId]) {
      this.players[playerId].connected = true;

      if (socket.playerName && typeof socket.playerName === "string") {
        this.players[playerId].name =
          socket.playerName.trim() || this.players[playerId].name;
      }

      socket.join(this.id);
      this.broadcastRoomUpdate();
      return;
    }

    const usedColors = Object.values(this.players)
      .map((player) => player.color)
      .filter(Boolean);

    const color = COLORS.find((c) => !usedColors.includes(c)) || COLORS[0];

    this.players[playerId] = {
      id: playerId,
      name:
        socket.playerName?.trim() ||
        `Player_${Object.keys(this.players).length + 1}`,
      connected: true,
      color,
    };

    socket.join(this.id);

    if (this.game) {
      this.game.addPlayer(playerId);
    }

    this.broadcastRoomUpdate();
  }

  removeParticipant(socket) {
    if (!socket || !socket.playerId) return;

    const playerId = socket.playerId;

    if (this.hostId === playerId) {
      this.hostId = null;
      socket.leave(this.id);
      this.broadcastRoomUpdate();
      return;
    }

    const player = this.players[playerId];
    if (!player) return;

    player.connected = false;
    socket.leave(this.id);

    this.broadcastRoomUpdate();
  }

  setSelectedGame(gameName) {
    this.selectedGame = gameName;
    this.broadcastRoomUpdate();
  }

  loadGame(gameName) {
    this.selectedGame = gameName;
    this.game = GameLoader.load(gameName, this);

    if (!this.game) {
      throw new Error("Failed to load game");
    }

    Object.keys(this.players).forEach((playerId) => {
      this.game.addPlayer(playerId);
    });

    this.game.init();
    this.game.start();
    this.status = "running";

    this.broadcastRoomUpdate();
  }

  handleInput(playerId, data) {
    if (!this.game) return;
    if (!this.players[playerId]) return;
    if (!this.players[playerId].connected) return;
    if (!this.game.isRunning()) return;

    this.game.handleInput(playerId, data);
  }

  update(delta) {
    if (!this.game) return;
    if (!this.game.isRunning()) return;

    this.game.update(delta);
    this.broadcastGameState();
  }

  resetToLobby() {
    if (this.game) {
      this.game.destroy();
    }

    this.game = null;
    this.status = "waiting";

    this.broadcastRoomUpdate();
  }

  getLobbyState() {
    return {
      roomId: this.id,
      hostId: this.hostId,
      players: Object.values(this.players),
      selectedGame: this.selectedGame,
      status: this.status,
    };
  }

  broadcastRoomUpdate() {
    this.io.to(this.id).emit(EVENTS.ROOM.UPDATE, this.getLobbyState());
  }

  broadcastGameState() {
    if (!this.game) return;
    this.io.to(this.id).emit(EVENTS.GAME.STATE, this.game.getState());
  }

  isHost(playerId) {
    return this.hostId === playerId;
  }

  isEmpty() {
    return !this.hostId && Object.keys(this.players).length === 0;
  }

  destroy() {
    if (this.game) {
      this.game.destroy();
    }

    this.hostId = null;
    this.players = {};
    this.game = null;
    this.selectedGame = null;
  }
}

module.exports = Room;
