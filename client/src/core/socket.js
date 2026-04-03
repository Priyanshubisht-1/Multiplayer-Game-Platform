import { io } from "socket.io-client";

function getPlayerId() {
  let playerId = localStorage.getItem("playerId");

  if (!playerId) {
    playerId = "p_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("playerId", playerId);
  }

  return playerId;
}

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

const socket = io(SERVER_URL, {
  transports: ["websocket"],
  auth: {
    playerId: getPlayerId(),
  },
});

socket.on("connect", () => {
  console.log("[Socket] Connected:", socket.playerId);
});

socket.on("disconnect", () => {
  console.log("[Socket] Disconnected");
});

export default socket;