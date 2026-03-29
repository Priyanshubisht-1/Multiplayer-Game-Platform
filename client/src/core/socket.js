import { io } from "socket.io-client";

function getPlayerId() {
  let playerId = localStorage.getItem("playerId");

  if (!playerId) {
    playerId = "p_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("playerId", playerId);
  }

  return playerId;
}
const socket = io("http://192.168.1.5:3000", {
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
