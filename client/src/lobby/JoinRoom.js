import socket from "../core/socket.js";
import EVENTS from "../shared/events.js";
import { renderLobby } from "./renderLobby.js";
import { mountControllerScreen } from "../controller/index.js";

let joinHandlersAttached = false;

export function setupJoinRoom() {
  const joinBtn = document.getElementById("join-room-btn");
  const roomInput = document.getElementById("room-id-input");
  const nameInput = document.getElementById("player-name-input");

  if (!joinBtn || !roomInput) return;

  attachJoinHandlers();

  joinBtn.onclick = () => {
    const roomId = roomInput.value.trim().toUpperCase();
    let name = nameInput?.value.trim();

    if (!roomId) {
      showJoinMessage("Enter room ID");
      return;
    }

    // fallback name
    if (!name) {
      name = "Player_" + Math.floor(Math.random() * 1000);
    }

    clearJoinMessage();

    joinBtn.disabled = true;
    joinBtn.textContent = "Joining...";

    socket.emit(EVENTS.ROOM.JOIN, {
      roomId,
      name,
    });
  };
}

function attachJoinHandlers() {
  if (joinHandlersAttached) return;

  socket.on(EVENTS.ROOM.JOINED, (data) => {
    const joinBtn = document.getElementById("join-room-btn");

    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.textContent = "Join Room";
    }

    const lobby = data?.lobby;

    if (!lobby) {
      showJoinMessage("Invalid room response");
      return;
    }

    const playerId = localStorage.getItem("playerId");
    const selfPlayer = Array.isArray(lobby.players)
      ? lobby.players.find((player) => player.id === playerId)
      : null;

    if (selfPlayer?.color) {
      localStorage.setItem("playerColor", selfPlayer.color);
    }

    if (selfPlayer?.name) {
      localStorage.setItem("playerName", selfPlayer.name);
    }

    if (lobby.status === "running") {
      if (!lobby.selectedGame) {
        showJoinMessage("Game is running but game info is missing");
        return;
      }

      mountControllerScreen(lobby.selectedGame);
      return;
    }

    renderLobby(lobby, false);
  });

  socket.on(EVENTS.ROOM.ERROR, (err) => {
    const joinBtn = document.getElementById("join-room-btn");

    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.textContent = "Join Room";
    }

    showJoinMessage(err?.message || "Room error");
  });

  joinHandlersAttached = true;
}

function showJoinMessage(msg) {
  const box = document.getElementById("inline-message");
  if (!box) return;

  box.textContent = msg;
  box.style.display = "block";
}

function clearJoinMessage() {
  const box = document.getElementById("inline-message");
  if (!box) return;

  box.textContent = "";
  box.style.display = "none";
}
