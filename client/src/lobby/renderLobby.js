import socket from "../core/socket.js";
import EVENTS from "../shared/events.js";
import GAMES from "../shared/games.js";

let lobbyStylesMounted = false;

export function renderLobby(lobby, isHost) {
  const app = document.getElementById("app");
  if (!app) return;

  mountLobbyStyles();

  const controllers = Array.isArray(lobby.players) ? lobby.players : [];
  const connectedControllers = controllers.filter(
    (controller) => controller.connected,
  );
  const connectedCount = connectedControllers.length;
  const selectedGameMeta = GAMES.find((g) => g.id === lobby.selectedGame);

  const canStart =
    isHost &&
    !!lobby.selectedGame &&
    connectedCount >= 2 &&
    lobby.status !== "running";

  const controllersHtml =
    controllers.length > 0
      ? controllers
          .map((controller) => {
            const initial = escapeHtml(
              controller.name?.charAt(0)?.toUpperCase() || "C",
            );

            return `
                    <li class="lobby-controller-card">
                        <div class="lobby-controller-avatar"
     style="background:${controller.color || "#2563eb"}">
     ${initial}
</div>
                        <div class="lobby-controller-info">
                            <span class="lobby-controller-name">
                                ${escapeHtml(controller.name || "Controller")}
                            </span>
                            <span class="lobby-controller-state ${
                              controller.connected
                                ? "is-connected"
                                : "is-disconnected"
                            }">
                                ${
                                  controller.connected
                                    ? "Controller Connected"
                                    : "Disconnected"
                                }
                            </span>
                        </div>
                    </li>
                `;
          })
          .join("")
      : `
            <li class="lobby-empty-state">
                No controllers have joined yet.
            </li>
        `;

  const gameCardsHtml = GAMES.map((game) => {
    const isSelected = lobby.selectedGame === game.id;
    const disabled = !isHost || lobby.status === "running";

    return `
            <button
                class="lobby-game-card ${isSelected ? "selected" : ""}"
                data-game="${escapeHtml(game.id)}"
                type="button"
                ${disabled ? "disabled" : ""}
            >
                <div class="lobby-game-card-top">
                    <span class="lobby-game-icon">${getGameEmoji(game.id)}</span>
                    <span class="lobby-game-tag ${isSelected ? "selected" : ""}">
                        ${isSelected ? "Selected" : "Available"}
                    </span>
                </div>

                <h4>${escapeHtml(game.name)}</h4>
                <p>${escapeHtml(getGameDescription(game.id))}</p>
            </button>
        `;
  }).join("");

  app.innerHTML = `
        <div class="lobby-shell">
            <section class="lobby-panel lobby-panel--main">
                <div class="lobby-header">
                    <div>
                        <div class="lobby-kicker">Room Lobby</div>
                        <h1 class="lobby-room-title">Room ${escapeHtml(lobby.roomId || "")}</h1>
                        <p class="lobby-subtitle">
                            ${
                              isHost
                                ? "This screen is the common display. Controllers join from their own devices and the host starts the game when ready."
                                : "This device is connected as a controller. Wait for the host display to start the game."
                            }
                        </p>
                    </div>

                    <div class="lobby-room-tools">
                        <div class="lobby-status-pill ${getStatusClass(lobby.status)}">
                            ${formatStatus(lobby.status)}
                        </div>

                        <button id="copy-room-btn" class="lobby-secondary-btn" type="button">
                            Copy Room ID
                        </button>
                    </div>
                </div>

                <div class="lobby-summary-grid">
                    <div class="lobby-summary-card">
                        <span class="lobby-summary-label">Controllers Connected</span>
                        <strong class="lobby-summary-value">${connectedCount}</strong>
                    </div>

                    <div class="lobby-summary-card">
                        <span class="lobby-summary-label">Total Controllers</span>
                        <strong class="lobby-summary-value">${controllers.length}</strong>
                    </div>

                    <div class="lobby-summary-card">
                        <span class="lobby-summary-label">Selected Game</span>
                        <strong class="lobby-summary-value">
                            ${escapeHtml(selectedGameMeta?.name || "None")}
                        </strong>
                    </div>
                </div>

                <div id="lobby-message-box" class="lobby-message-box" style="display:none;"></div>
            </section>

            <section class="lobby-layout-grid">
                <div class="lobby-panel">
                    <div class="lobby-section-head">
                        <h2>Controllers</h2>
                        <span class="lobby-section-count">${controllers.length}</span>
                    </div>

                    <ul class="lobby-controller-list">
                        ${controllersHtml}
                    </ul>
                </div>

                <div class="lobby-panel">
                    <div class="lobby-section-head">
                        <h2>${isHost ? "Select Game" : "Game Selection"}</h2>
                    </div>

                    <div class="lobby-game-grid">
                        ${gameCardsHtml}
                    </div>

                    ${
                      isHost
                        ? `
                                <div class="lobby-action-area">
                                    <button
                                        id="start-game-btn"
                                        class="lobby-primary-btn"
                                        type="button"
                                        ${canStart ? "" : "disabled"}
                                    >
                                        Start Game
                                    </button>

                                    <p class="lobby-helper-text">
                                        ${
                                          !lobby.selectedGame
                                            ? "Select a game before starting."
                                            : connectedCount < 2
                                              ? "At least 2 connected controllers are required to start."
                                              : lobby.status === "running"
                                                ? "The game is already running."
                                                : "The room is ready to start."
                                        }
                                    </p>
                                </div>
                            `
                        : `
                                <div class="lobby-wait-box">
                                    Waiting for the host display to choose a game and start the session.
                                </div>
                            `
                    }
                </div>
            </section>
        </div>
    `;

  attachSharedHandlers(lobby);

  if (isHost) {
    attachHostHandlers(lobby, connectedCount, canStart);
  }
}

function attachSharedHandlers(lobby) {
  const copyBtn = document.getElementById("copy-room-btn");

  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(lobby.roomId || "");
        showLobbyMessage("Room ID copied to clipboard.", "success");
      } catch {
        showLobbyMessage("Could not copy room ID.", "error");
      }
    };
  }
}

function attachHostHandlers(lobby, connectedCount, canStart) {
  const gameCards = document.querySelectorAll(".lobby-game-card");

  gameCards.forEach((card) => {
    card.onclick = () => {
      if (lobby.status === "running") return;

      const game = card.dataset.game;
      if (!game) return;

      socket.emit(EVENTS.GAME.SELECT, { game });
    };
  });

  const startBtn = document.getElementById("start-game-btn");

  if (startBtn) {
    startBtn.onclick = () => {
      if (!lobby.selectedGame) {
        showLobbyMessage("Select a game first.", "error");
        return;
      }

      if (connectedCount < 2) {
        showLobbyMessage(
          "At least 2 connected controllers must join first.",
          "error",
        );
        return;
      }

      if (!canStart) {
        showLobbyMessage("Game cannot be started right now.", "error");
        return;
      }

      startBtn.disabled = true;
      startBtn.textContent = "Starting...";

      socket.emit(EVENTS.GAME.START, {
        game: lobby.selectedGame,
      });
    };
  }
}

function showLobbyMessage(message, type = "error") {
  const box = document.getElementById("lobby-message-box");
  if (!box) return;

  box.textContent = message;
  box.className = `lobby-message-box ${type === "success" ? "is-success" : "is-error"}`;
  box.style.display = "block";
}

function mountLobbyStyles() {
  if (lobbyStylesMounted) return;

  const style = document.createElement("style");
  style.id = "lobby-ui-styles";
  style.textContent = `
        .lobby-shell {
            min-height: 100vh;
            padding: 28px;
            color: #f8fafc;
            font-family: Arial, sans-serif;
        }

        .lobby-panel {
            background: rgba(15, 23, 42, 0.74);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 22px;
            padding: 24px;
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.22);
            backdrop-filter: blur(10px);
        }

        .lobby-panel--main {
            margin-bottom: 22px;
        }

        .lobby-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 24px;
        }

        .lobby-kicker {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #93c5fd;
            margin-bottom: 10px;
            font-weight: 700;
        }

        .lobby-room-title {
            font-size: clamp(1.8rem, 3vw, 2.8rem);
            line-height: 1.1;
            margin: 0 0 10px;
        }

        .lobby-subtitle {
            margin: 0;
            color: #cbd5e1;
            line-height: 1.6;
            max-width: 720px;
        }

        .lobby-room-tools {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 12px;
        }

        .lobby-status-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 36px;
            padding: 8px 14px;
            border-radius: 999px;
            font-size: 0.9rem;
            font-weight: 700;
            border: 1px solid transparent;
        }

        .lobby-status-pill.status-waiting {
            background: rgba(245, 158, 11, 0.16);
            color: #fcd34d;
            border-color: rgba(245, 158, 11, 0.28);
        }

        .lobby-status-pill.status-running {
            background: rgba(34, 197, 94, 0.16);
            color: #86efac;
            border-color: rgba(34, 197, 94, 0.28);
        }

        .lobby-status-pill.status-starting {
            background: rgba(59, 130, 246, 0.16);
            color: #93c5fd;
            border-color: rgba(59, 130, 246, 0.28);
        }

        .lobby-status-pill.status-ended {
            background: rgba(239, 68, 68, 0.16);
            color: #fca5a5;
            border-color: rgba(239, 68, 68, 0.28);
        }

        .lobby-secondary-btn,
        .lobby-primary-btn {
            border: none;
            border-radius: 14px;
            padding: 12px 16px;
            font-size: 0.95rem;
            font-weight: 700;
            cursor: pointer;
            transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
        }

        .lobby-secondary-btn {
            background: rgba(255, 255, 255, 0.08);
            color: #f8fafc;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .lobby-secondary-btn:hover {
            background: rgba(255, 255, 255, 0.12);
        }

        .lobby-primary-btn {
            width: 100%;
            background: linear-gradient(90deg, #2563eb, #7c3aed);
            color: white;
            min-height: 50px;
        }

        .lobby-primary-btn:hover:not(:disabled) {
            opacity: 0.95;
        }

        .lobby-primary-btn:active:not(:disabled),
        .lobby-secondary-btn:active:not(:disabled) {
            transform: scale(0.985);
        }

        .lobby-primary-btn:disabled,
        .lobby-secondary-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .lobby-summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
        }

        .lobby-summary-card {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 18px;
            padding: 18px;
        }

        .lobby-summary-label {
            display: block;
            color: #94a3b8;
            font-size: 0.88rem;
            margin-bottom: 10px;
        }

        .lobby-summary-value {
            font-size: 1.15rem;
            color: #f8fafc;
        }

        .lobby-message-box {
            margin-top: 18px;
            border-radius: 14px;
            padding: 12px 14px;
            font-size: 0.95rem;
            border: 1px solid transparent;
        }

        .lobby-message-box.is-error {
            background: rgba(239, 68, 68, 0.14);
            border-color: rgba(239, 68, 68, 0.28);
            color: #fecaca;
        }

        .lobby-message-box.is-success {
            background: rgba(34, 197, 94, 0.14);
            border-color: rgba(34, 197, 94, 0.28);
            color: #bbf7d0;
        }

        .lobby-layout-grid {
            display: grid;
            grid-template-columns: 1.1fr 1fr;
            gap: 22px;
        }

        .lobby-section-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 18px;
        }

        .lobby-section-head h2 {
            margin: 0;
            font-size: 1.25rem;
        }

        .lobby-section-count {
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

        .lobby-controller-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .lobby-controller-card {
            display: flex;
            align-items: center;
            gap: 14px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 16px;
            padding: 14px;
        }

        .lobby-controller-avatar {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #2563eb, #7c3aed);
            color: white;
            font-weight: 700;
            font-size: 1rem;
            flex-shrink: 0;
        }

        .lobby-controller-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;
        }

        .lobby-controller-name {
            font-weight: 700;
            color: #f8fafc;
            word-break: break-word;
        }

        .lobby-controller-state {
            font-size: 0.88rem;
            font-weight: 600;
        }

        .lobby-controller-state.is-connected {
            color: #86efac;
        }

        .lobby-controller-state.is-disconnected {
            color: #fca5a5;
        }

        .lobby-empty-state {
            padding: 18px;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.04);
            color: #cbd5e1;
            border: 1px dashed rgba(255, 255, 255, 0.12);
        }

        .lobby-game-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 14px;
        }

        .lobby-game-card {
            width: 100%;
            text-align: left;
            border-radius: 18px;
            padding: 18px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.04);
            color: #f8fafc;
            cursor: pointer;
            transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        }

        .lobby-game-card:hover:not(:disabled) {
            transform: translateY(-2px);
            background: rgba(255, 255, 255, 0.07);
            border-color: rgba(147, 197, 253, 0.4);
        }

        .lobby-game-card.selected {
            border-color: rgba(34, 197, 94, 0.5);
            background: rgba(34, 197, 94, 0.12);
        }

        .lobby-game-card:disabled {
            opacity: 0.65;
            cursor: not-allowed;
        }

        .lobby-game-card-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 12px;
        }

        .lobby-game-icon {
            font-size: 1.4rem;
        }

        .lobby-game-tag {
            font-size: 0.8rem;
            font-weight: 700;
            padding: 6px 10px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.08);
            color: #cbd5e1;
        }

        .lobby-game-tag.selected {
            background: rgba(34, 197, 94, 0.16);
            color: #86efac;
        }

        .lobby-game-card h4 {
            margin: 0 0 8px;
            font-size: 1.05rem;
        }

        .lobby-game-card p {
            margin: 0;
            color: #cbd5e1;
            line-height: 1.5;
            font-size: 0.94rem;
        }

        .lobby-action-area {
            margin-top: 18px;
        }

        .lobby-helper-text {
            margin: 12px 0 0;
            color: #cbd5e1;
            line-height: 1.5;
            font-size: 0.92rem;
        }

        .lobby-wait-box {
            margin-top: 18px;
            border-radius: 16px;
            padding: 16px;
            background: rgba(59, 130, 246, 0.12);
            border: 1px solid rgba(59, 130, 246, 0.2);
            color: #dbeafe;
            line-height: 1.5;
        }

        @media (max-width: 900px) {
            .lobby-layout-grid {
                grid-template-columns: 1fr;
            }

            .lobby-summary-grid {
                grid-template-columns: 1fr;
            }

            .lobby-header {
                flex-direction: column;
            }

            .lobby-room-tools {
                width: 100%;
                align-items: stretch;
            }

            .lobby-secondary-btn {
                width: 100%;
            }
        }

        @media (max-width: 640px) {
            .lobby-shell {
                padding: 16px;
            }

            .lobby-panel {
                padding: 18px;
                border-radius: 18px;
            }

            .lobby-room-title {
                font-size: 1.8rem;
            }
        }
    `;

  document.head.appendChild(style);
  lobbyStylesMounted = true;
}

function formatStatus(status) {
  if (!status) return "Unknown";

  const normalized = String(status).toLowerCase();

  if (normalized === "waiting") return "Waiting";
  if (normalized === "starting") return "Starting";
  if (normalized === "running") return "Running";
  if (normalized === "ended") return "Ended";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getStatusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "running") return "status-running";
  if (normalized === "starting") return "status-starting";
  if (normalized === "ended") return "status-ended";
  return "status-waiting";
}

function getGameEmoji(gameId) {
  if (gameId === "tag") return "🏃";
  if (gameId === "car") return "🏎️";
  return "🎮";
}

function getGameDescription(gameId) {
  if (gameId === "tag") {
    return "Fast movement and chase gameplay controlled from connected devices.";
  }

  if (gameId === "car") {
    return "Arcade-style driving controlled by mobile inputs on the main display.";
  }

  return "A modular local multiplayer game for the shared host screen.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
