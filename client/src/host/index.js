import Phaser from "phaser";
import socket from "../core/socket.js";
import EVENTS from "../shared/events.js";
import GameManager from "./game/GameManager.js";
import MainScene from "./game/scenes/MainScene.js";

let gameInstance = null;
let stateListenerAttached = false;
let hostGameStylesMounted = false;

export function mountHostGame() {
  const app = document.getElementById("app");
  if (!app) return null;

  mountHostGameStyles();

  app.innerHTML = `
        <div class="host-game-page">
            <div class="host-game-layout">
                <section class="host-game-main">
                    <div class="host-game-topbar">
                        <div>
                            <div class="host-game-kicker">Common Display</div>
                            <h1 class="host-game-title">Live Game Screen</h1>
                        </div>

                        <div class="host-game-room-meta">
                            <div class="host-game-room-pill">
                                Room: <span id="host-room-id">--</span>
                            </div>
                            <div class="host-game-status-pill" id="host-game-status">
                                Running
                            </div>
                        </div>
                    </div>

                    <div class="host-game-canvas-card">
                        <div id="phaser-root" class="host-phaser-root"></div>
                    </div>
                </section>

                <aside class="host-game-sidebar">
                    <div class="host-sidebar-card">
                        <div class="host-sidebar-head">
                            <h2>Controllers in Game</h2>
                            <span class="host-sidebar-count" id="host-player-count">0</span>
                        </div>

                        <ul id="host-player-list" class="host-player-list">
                            <li class="host-player-empty">Waiting for game state...</li>
                        </ul>
                    </div>

                    <div class="host-sidebar-card">
                        <div class="host-sidebar-head">
                            <h2>Game Info</h2>
                        </div>

                        <div class="host-game-info-grid">
                            <div class="host-info-row">
                                <span class="host-info-label">Current Game</span>
                                <strong id="host-current-game">Tag</strong>
                            </div>

                            <div class="host-info-row">
                                <span class="host-info-label">Tagger</span>
                                <strong id="host-current-tagger">--</strong>
                            </div>

                            <div class="host-info-row">
                                <span class="host-info-label">Phase</span>
                                <strong id="host-current-phase">Running</strong>
                            </div>
                            <button id="host-return-btn" class="host-return-btn">
                                Return to Lobby
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    `;
  const returnBtn = document.getElementById("host-return-btn");

  if (returnBtn) {
    returnBtn.onclick = () => {
      socket.emit(EVENTS.GAME.END);
    };
  }

  if (gameInstance) {
    const canvas = gameInstance.canvas;
    const root = document.getElementById("phaser-root");

    if (canvas && root && canvas.parentElement !== root) {
      root.appendChild(canvas);
    }

    if (
      gameInstance.domContainer &&
      root &&
      gameInstance.domContainer.parentElement !== root
    ) {
      root.appendChild(gameInstance.domContainer);
    }

    gameInstance.scale?.refresh?.();
  } else {
    const config = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: "phaser-root",
      backgroundColor: "#222222",
      scene: [MainScene],
    };

    gameInstance = new Phaser.Game(config);
  }

  if (!stateListenerAttached) {
    socket.on(EVENTS.GAME.STATE, (state) => {
      GameManager.updateState(state);
      updateHostGameSidebar(state);
    });

    stateListenerAttached = true;
  }

  return gameInstance;
}

function updateHostGameSidebar(state) {
  if (!state) return;

  const roomIdEl = document.getElementById("host-room-id");
  const playerCountEl = document.getElementById("host-player-count");
  const playerListEl = document.getElementById("host-player-list");
  const taggerEl = document.getElementById("host-current-tagger");
  const phaseEl = document.getElementById("host-current-phase");
  const statusEl = document.getElementById("host-game-status");

  const players = state.players ? Object.entries(state.players) : [];
  const playerCount = players.length;

  if (roomIdEl) {
    roomIdEl.textContent = state.roomId || "--";
  }

  if (playerCountEl) {
    playerCountEl.textContent = String(playerCount);
  }

  if (taggerEl) {
    taggerEl.textContent = state.tagger || "--";
  }

  if (phaseEl) {
    phaseEl.textContent = state.meta?.paused ? "Paused" : "Running";
  }

  if (statusEl) {
    statusEl.textContent = state.meta?.paused ? "Paused" : "Running";
    statusEl.className = `host-game-status-pill ${state.meta?.paused ? "paused" : "running"}`;
  }

  if (playerListEl) {
    if (players.length === 0) {
      playerListEl.innerHTML = `
                <li class="host-player-empty">No active controllers in the game.</li>
            `;
      return;
    }

    playerListEl.innerHTML = players
      .map(([id, data]) => {
        const isTagger = id === state.tagger;
        const avatarColor = escapeHtml(data.color || "#3b82f6");
        const initial = escapeHtml((data.name || id).charAt(0).toUpperCase());

        return `
      <li class="host-player-item ${isTagger ? "is-tagger" : ""}">
        <div class="host-player-avatar" style="background:${avatarColor}">
          ${initial}
        </div>
        <div class="host-player-meta">
          <span class="host-player-name">${escapeHtml(data.name || id)}</span>
          <span class="host-player-role">
            ${isTagger ? "Tagger" : "Runner"}
          </span>
        </div>
      </li>
    `;
      })
      .join("");
  }
}

function mountHostGameStyles() {
  if (hostGameStylesMounted) return;

  const style = document.createElement("style");
  style.id = "host-game-page-styles";
  style.textContent = `
        .host-game-page {
            min-height: 100vh;
            padding: 20px;
            color: #f8fafc;
            font-family: Arial, sans-serif;
        }

        .host-game-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 320px;
            gap: 20px;
            align-items: start;
        }

        .host-game-main,
        .host-sidebar-card {
            background: rgba(15, 23, 42, 0.78);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 22px;
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.22);
            backdrop-filter: blur(10px);
        }

        .host-game-main {
            padding: 20px;
        }

        .host-game-topbar {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 16px;
        }

        .host-game-kicker {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #93c5fd;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .host-game-title {
            margin: 0;
            font-size: 2rem;
            line-height: 1.1;
        }

        .host-game-room-meta {
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: flex-end;
        }

        .host-game-room-pill,
        .host-game-status-pill {
            padding: 10px 14px;
            border-radius: 999px;
            font-weight: 700;
            font-size: 0.92rem;
            background: rgba(255, 255, 255, 0.08);
        }

        .host-game-status-pill.running {
            background: rgba(34, 197, 94, 0.16);
            color: #86efac;
            border: 1px solid rgba(34, 197, 94, 0.28);
        }

        .host-game-status-pill.paused {
            background: rgba(245, 158, 11, 0.16);
            color: #fcd34d;
            border: 1px solid rgba(245, 158, 11, 0.28);
        }

        .host-game-canvas-card {
            background: rgba(2, 6, 23, 0.65);
            border-radius: 18px;
            padding: 14px;
            border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .host-phaser-root {
            width: fit-content;
            max-width: 100%;
            margin: 0 auto;
        }

        .host-phaser-root canvas {
            display: block;
            max-width: 100%;
            height: auto;
            border-radius: 14px;
        }

        .host-game-sidebar {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .host-sidebar-card {
            padding: 18px;
        }

        .host-sidebar-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 16px;
        }

        .host-sidebar-head h2 {
            margin: 0;
            font-size: 1.15rem;
        }

        .host-sidebar-count {
            min-width: 34px;
            height: 34px;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(59, 130, 246, 0.16);
            color: #bfdbfe;
            font-weight: 700;
        }
            .host-return-btn {
             margin-top: 16px;
             width: 100%;
             padding: 12px;
             border-radius: 12px;
             border: none;
             background: #ef4444;
             color: white;
             font-weight: 700;
             cursor: pointer;
}

        .host-player-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .host-player-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .host-player-item.is-tagger {
            border-color: rgba(239, 68, 68, 0.35);
            background: rgba(239, 68, 68, 0.12);
        }

        .host-player-avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #2563eb, #7c3aed);
            font-weight: 700;
            color: #ffffff;
            flex-shrink: 0;
        }

        .host-player-meta {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;
        }

        .host-player-name {
            font-weight: 700;
            word-break: break-word;
        }

        .host-player-role {
            color: #cbd5e1;
            font-size: 0.9rem;
        }

        .host-player-empty {
            padding: 14px;
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.04);
            color: #cbd5e1;
            border: 1px dashed rgba(255, 255, 255, 0.12);
        }

        .host-game-info-grid {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .host-info-row {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 12px;
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .host-info-label {
            color: #94a3b8;
            font-size: 0.88rem;
        }

        @media (max-width: 1100px) {
            .host-game-layout {
                grid-template-columns: 1fr;
            }

            .host-game-room-meta {
                align-items: flex-start;
            }

            .host-game-topbar {
                flex-direction: column;
            }
        }
    `;

  document.head.appendChild(style);
  hostGameStylesMounted = true;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
