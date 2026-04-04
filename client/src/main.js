import socket from "./core/socket.js";
import EVENTS from "./shared/events.js";
import { setupCreateRoom } from "./lobby/CreateRoom.js";
import { setupJoinRoom } from "./lobby/JoinRoom.js";
import { renderLobby } from "./lobby/renderLobby.js";
import { mountHostGame } from "./host/index.js";
import { mountControllerScreen } from "./controller/index.js";
import GameManager from "./host/game/GameManager.js";

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode");

function init() {
  if (mode === "host") {
    renderHostLobbyEntry();
  } else if (mode === "controller") {
    renderControllerLobbyEntry();
  } else {
    renderModeSelection();
  }

  socket.on(EVENTS.ROOM.UPDATE, (lobby) => {
    const playerId = localStorage.getItem("playerId");
    const isHost = lobby.hostId === playerId;
    if (lobby.status === "running") return;
    renderLobby(lobby, isHost);
  });

  socket.on(EVENTS.GAME.STARTED, async ({ game }) => {
    console.log("[Main] Game started:", game);
    if (mode === "host") {
      mountHostGame();
      await GameManager.waitForScene();
      await GameManager.setGame(game);
    } else if (mode === "controller") {
      mountControllerScreen(game);
    }
  });

  socket.on(EVENTS.GAME.ERROR, (err) => {
    console.error("[Main] Game error:", err?.message);
    renderInlineMessage(err?.message || "Something went wrong.");
  });

  socket.on(EVENTS.ROOM.ERROR, (err) => {
    console.error("[Main] Room error:", err?.message);
    renderInlineMessage(err?.message || "Room error.");
  });
}

function renderModeSelection() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="landing-screen">
      <div class="landing-card">
        <div class="landing-logo">
          <div class="logo-icon">🎮</div>
          <span class="logo-wordmark">ARCADELINK</span>
        </div>

        <div class="landing-badge">
          <span class="dot"></span>
          Local Multiplayer
        </div>

        <h1 class="landing-title">Game System</h1>

        <p class="landing-subtitle">
          One host screen runs the game — mobile devices join as controllers.
          No installs, no accounts. Just pick your role and play.
        </p>

        <div class="mode-grid">
          <button id="host-mode-btn" class="mode-card host-card" type="button">
            <div class="mode-icon-wrap">🖥️</div>
            <h2>Host Mode</h2>
            <p>Create a room, manage the lobby, and display the live game on the main screen.</p>
            <span class="mode-card-arrow">↗</span>
          </button>

          <button id="controller-mode-btn" class="mode-card controller-card" type="button">
            <div class="mode-icon-wrap">📱</div>
            <h2>Controller Mode</h2>
            <p>Join an existing room from your mobile device and control your player in the game.</p>
            <span class="mode-card-arrow">↗</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("host-mode-btn")?.addEventListener("click", () => {
    window.location.href = `${window.location.pathname}?mode=host`;
  });
  document.getElementById("controller-mode-btn")?.addEventListener("click", () => {
    window.location.href = `${window.location.pathname}?mode=controller`;
  });
}

function renderHostLobbyEntry() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="entry-screen">
      <div class="entry-card">
        <div class="entry-header">
          <span class="entry-badge host-badge">HOST</span>
          <button id="back-home-btn" class="back-btn" type="button">← Back</button>
        </div>

        <h1 class="entry-title">Host Lobby</h1>
        <p class="entry-subtitle">
          Create a room, select a game, and manage controllers from the main display.
        </p>

        <div class="entry-actions">
          <button id="create-room-btn" class="primary-btn" type="button">
            Create Room
          </button>
        </div>

        <div id="inline-message" class="inline-message"></div>
      </div>
    </div>
  `;

  document.getElementById("back-home-btn")?.addEventListener("click", goHome);
  setupCreateRoom();
}

function renderControllerLobbyEntry() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="entry-screen">
      <div class="entry-card">
        <div class="entry-header">
          <span class="entry-badge controller-badge">CONTROLLER</span>
          <button id="back-home-btn" class="back-btn" type="button">← Back</button>
        </div>

        <h1 class="entry-title">Join Room</h1>
        <p class="entry-subtitle">
          Enter the room code to connect this device as a controller.
        </p>

        <div class="form-group">
          <label class="input-label">Your Name</label>
          <input id="player-name-input" class="text-input" placeholder="Enter your name (optional)" />
        </div>

        <div class="form-group">
          <label class="input-label">Room ID</label>
          <input id="room-id-input" class="text-input" placeholder="Enter Room ID" />
        </div>

        <div class="entry-actions">
          <button id="join-room-btn" class="primary-btn" type="button">
            Join Room
          </button>
        </div>

        <div id="inline-message" class="inline-message"></div>
      </div>
    </div>
  `;

  document.getElementById("back-home-btn")?.addEventListener("click", goHome);
  setupJoinRoom();
}

function renderInlineMessage(message) {
  const messageBox = document.getElementById("inline-message");
  if (!messageBox) return;
  messageBox.textContent = message;
  messageBox.style.display = "block";
}

function goHome() {
  window.location.href = window.location.pathname;
}

init();
