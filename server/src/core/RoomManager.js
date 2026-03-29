const Room = require("../rooms/Room");

class RoomManager {
  constructor(io) {
    if (!io) {
      throw new Error("RoomManager requires Socket.IO instance");
    }

    this.io = io;
    this.rooms = new Map();
    this.playerRoomMap = new Map();
  }

  createRoom(roomId) {
    if (!roomId) {
      throw new Error("Room ID is required");
    }

    if (this.rooms.has(roomId)) {
      throw new Error("Room already exists");
    }

    const room = new Room(roomId, this.io);
    this.rooms.set(roomId, room);

    return room;
  }

  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.destroy();
    this.rooms.delete(roomId);

    for (const [playerId, rId] of this.playerRoomMap.entries()) {
      if (rId === roomId) {
        this.playerRoomMap.delete(playerId);
      }
    }
  }

  attachHostToRoom(roomId, socket) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    this.removeParticipant(socket);

    room.setHost(socket);
    this.playerRoomMap.set(socket.playerId, roomId);

    return room;
  }

  addPlayerToRoom(roomId, socket) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    this.removeParticipant(socket);

    room.addPlayer(socket);
    this.playerRoomMap.set(socket.playerId, roomId);

    return room;
  }

  removeParticipant(socket) {
    const roomId = this.playerRoomMap.get(socket.playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.removeParticipant(socket);
    if (room.isEmpty() && room.status !== "running") {
      this.deleteRoom(roomId);
    }
  }
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getRoomByPlayer(playerId) {
    const roomId = this.playerRoomMap.get(playerId);
    if (!roomId) return null;

    return this.rooms.get(roomId);
  }

  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  hasRoom(roomId) {
    return this.rooms.has(roomId);
  }
}

module.exports = RoomManager;
