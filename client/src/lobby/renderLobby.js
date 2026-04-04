import socket from "../core/socket.js";
import EVENTS from "../shared/events.js";
import GAMES from "../shared/games.js";

let lobbyStylesMounted = false;

export function renderLobby(lobby, isHost) {
  const app = document.getElementById("app");
  if (!app) return;

  mountLobbyStyles();

  const controllers = Array.isArray(lobby.players) ? lobby.players : [];
  const connectedControllers = controllers.filter((c) => c.connected);
  const connectedCount = connectedControllers.length;
  const selectedGameMeta = GAMES.find((g) => g.id === lobby.selectedGame);
  const minPlayers = selectedGameMeta?.minPlayers || 1;
  const maxPlayers = selectedGameMeta?.maxPlayers || Infinity;

  const canStart =
    isHost &&
    !!lobby.selectedGame &&
    connectedCount >= minPlayers &&
    connectedCount <= maxPlayers &&
    lobby.status !== "running";

  // Controller list HTML
  const controllersHtml =
    controllers.length > 0
      ? controllers.map((c) => {
          const initial = escapeHtml(c.name?.charAt(0)?.toUpperCase() || "C");
          return `
            <li class="lc-card">
              <div class="lc-avatar" style="background:${c.color || "#4f8aff"}">
                ${initial}
              </div>
              <div class="lc-info">
                <span class="lc-name">${escapeHtml(c.name || "Controller")}</span>
                <span class="lc-status ${c.connected ? "is-on" : "is-off"}">
                  <span class="lc-dot"></span>
                  ${c.connected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </li>`;
        }).join("")
      : `<li class="lc-empty">
           <span>🎮</span>
           <span>No controllers have joined yet</span>
         </li>`;

  // Game cards HTML
  const gameCardsHtml = GAMES.map((game) => {
    const isSelected = lobby.selectedGame === game.id;
    const disabled = !isHost || lobby.status === "running";
    return `
      <button
        class="lg-card ${isSelected ? "is-selected" : ""}"
        data-game="${escapeHtml(game.id)}"
        type="button"
        ${disabled ? "disabled" : ""}
      >
        <div class="lg-card-top">
          <span class="lg-emoji">${escapeHtml(game.emoji || "🎮")}</span>
          <span class="lg-tag ${isSelected ? "is-sel" : ""}">${isSelected ? "● Selected" : "Available"}</span>
        </div>
        <h4 class="lg-name">${escapeHtml(game.name)}</h4>
        <p class="lg-desc">${escapeHtml(game.description || "A modular local multiplayer game.")}</p>
        <div class="lg-meta">
          <span>👥 ${game.minPlayers}–${game.maxPlayers} players</span>
        </div>
      </button>`;
  }).join("");

  // Helper message
  const helperMsg = !lobby.selectedGame
    ? "Select a game to continue."
    : connectedCount < (selectedGameMeta?.minPlayers || 1)
    ? `Need at least ${selectedGameMeta?.minPlayers} connected controllers.`
    : connectedCount > (selectedGameMeta?.maxPlayers || Infinity)
    ? `Max ${selectedGameMeta?.maxPlayers} controllers for this game.`
    : lobby.status === "running"
    ? "Game is already running."
    : `Ready to start · ${selectedGameMeta?.minPlayers}–${selectedGameMeta?.maxPlayers} players`;

  app.innerHTML = `
    <div class="lb-shell">

      <!-- Top bar -->
      <header class="lb-topbar">
        <div class="lb-brand">
          <div class="lb-brand-icon">🎮</div>
          <span class="lb-brand-text">ARCADELINK</span>
        </div>
        <div class="lb-topbar-right">
          <div class="lb-status-pill ${getStatusClass(lobby.status)}">
            <span class="lb-status-dot"></span>
            ${formatStatus(lobby.status)}
          </div>
          <button id="copy-room-btn" class="lb-copy-btn" type="button">
            <span>📋</span> Copy Room ID
          </button>
        </div>
      </header>

      <!-- Hero -->
      <section class="lb-hero">
        <div class="lb-hero-left">
          <div class="lb-kicker">Room Lobby</div>
          <h1 class="lb-room-title">Room <span class="lb-room-id">${escapeHtml(lobby.roomId || "")}</span></h1>
          <p class="lb-room-sub">
            ${isHost
              ? "This screen is the shared host display. Controllers join from their own devices."
              : "You're connected as a controller. Wait for the host to start the game."}
          </p>
        </div>
        <div class="lb-stats-row">
          <div class="lb-stat">
            <span class="lb-stat-num">${connectedCount}</span>
            <span class="lb-stat-label">Connected</span>
          </div>
          <div class="lb-stat-divider"></div>
          <div class="lb-stat">
            <span class="lb-stat-num">${controllers.length}</span>
            <span class="lb-stat-label">Total</span>
          </div>
          <div class="lb-stat-divider"></div>
          <div class="lb-stat">
            <span class="lb-stat-num">${escapeHtml(selectedGameMeta?.name || "—")}</span>
            <span class="lb-stat-label">Game</span>
          </div>
        </div>
      </section>

      <div id="lobby-message-box" class="lb-msgbox" style="display:none;"></div>

      <!-- Main grid -->
      <div class="lb-grid">

        <!-- Controllers panel -->
        <section class="lb-panel">
          <div class="lb-panel-head">
            <h2 class="lb-panel-title">Controllers</h2>
            <span class="lb-count">${controllers.length}</span>
          </div>
          <ul class="lc-list">${controllersHtml}</ul>
        </section>

        <!-- Game selection panel -->
        <section class="lb-panel">
          <div class="lb-panel-head">
            <h2 class="lb-panel-title">${isHost ? "Select Game" : "Game Selection"}</h2>
          </div>

          <div class="lg-grid">${gameCardsHtml}</div>

          ${isHost ? `
            <div class="lb-start-area">
              <button
                id="start-game-btn"
                class="lb-start-btn"
                type="button"
                ${canStart ? "" : "disabled"}
              >
                <span class="lb-start-icon">▶</span>
                Start Game
              </button>
              <p class="lb-helper">${helperMsg}</p>
            </div>
          ` : `
            <div class="lb-wait-box">
              <span>⏳</span>
              Waiting for the host to choose a game and start the session.
            </div>
          `}
        </section>

      </div>
    </div>
  `;

  attachSharedHandlers(lobby);
  if (isHost) attachHostHandlers(lobby, connectedCount, canStart);
}

function attachSharedHandlers(lobby) {
  document.getElementById("copy-room-btn")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(lobby.roomId || "");
      showLobbyMessage("Room ID copied to clipboard!", "success");
    } catch {
      showLobbyMessage("Could not copy room ID.", "error");
    }
  });
}

function attachHostHandlers(lobby, connectedCount, canStart) {
  document.querySelectorAll(".lg-card").forEach((card) => {
    card.onclick = () => {
      if (lobby.status === "running") return;
      const game = card.dataset.game;
      if (game) socket.emit(EVENTS.GAME.SELECT, { game });
    };
  });

  const startBtn = document.getElementById("start-game-btn");
  if (!startBtn) return;

  startBtn.onclick = () => {
    if (!lobby.selectedGame) { showLobbyMessage("Select a game first.", "error"); return; }
    const meta = GAMES.find((g) => g.id === lobby.selectedGame);
    const min = meta?.minPlayers || 1;
    const max = meta?.maxPlayers || Infinity;

    if (connectedCount < min) { showLobbyMessage(`Need at least ${min} connected controllers.`, "error"); return; }
    if (connectedCount > max) { showLobbyMessage(`Max ${max} controllers allowed.`, "error"); return; }
    if (!canStart) { showLobbyMessage("Game cannot be started right now.", "error"); return; }

    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="lb-start-icon">⏳</span> Starting...';
    socket.emit(EVENTS.GAME.START, { game: lobby.selectedGame });
  };
}

function showLobbyMessage(message, type = "error") {
  const box = document.getElementById("lobby-message-box");
  if (!box) return;
  box.textContent = message;
  box.className = `lb-msgbox ${type === "success" ? "is-ok" : "is-err"}`;
  box.style.display = "block";
}

function mountLobbyStyles() {
  if (lobbyStylesMounted) return;
  const style = document.createElement("style");
  style.id = "lobby-ui-styles";
  style.textContent = `
    .lb-shell {
      min-height: 100vh;
      padding: 0 0 40px;
      color: var(--text-primary, #eef2ff);
      font-family: var(--font-body, 'Outfit', sans-serif);
    }

    /* Top bar */
    .lb-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 28px;
      border-bottom: 1px solid var(--border-dim, rgba(80,120,255,0.12));
      background: rgba(4,5,15,0.6);
      backdrop-filter: blur(16px);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .lb-brand {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .lb-brand-icon {
      width: 34px; height: 34px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--accent-blue,#4f8aff), var(--accent-purple,#9d5cff));
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
    }
    .lb-brand-text {
      font-family: var(--font-display, 'Orbitron', monospace);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.18em;
      color: var(--text-primary, #eef2ff);
    }
    .lb-topbar-right { display: flex; align-items: center; gap: 12px; }

    .lb-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      border: 1px solid transparent;
    }
    .lb-status-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
    .status-waiting  { background:rgba(255,179,0,0.12); color:#ffcf40; border-color:rgba(255,179,0,0.25); }
    .status-running  { background:rgba(0,255,157,0.1);  color:#00ff9d; border-color:rgba(0,255,157,0.25); }
    .status-starting { background:rgba(79,138,255,0.12);color:#93b8ff; border-color:rgba(79,138,255,0.25); }
    .status-ended    { background:rgba(255,77,106,0.12); color:#ff9aaa; border-color:rgba(255,77,106,0.25); }

    .lb-copy-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--border-dim, rgba(80,120,255,0.12));
      background: rgba(255,255,255,0.05);
      color: var(--text-secondary, #8892c4);
      border-radius: 10px;
      padding: 8px 14px;
      font-size: 0.84rem;
      font-family: var(--font-body, 'Outfit', sans-serif);
      cursor: pointer;
      transition: all 0.18s;
    }
    .lb-copy-btn:hover {
      background: rgba(255,255,255,0.09);
      color: var(--text-primary, #eef2ff);
      border-color: var(--border-mid, rgba(80,120,255,0.28));
    }

    /* Hero section */
    .lb-hero {
      padding: 32px 28px 28px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      flex-wrap: wrap;
    }
    .lb-kicker {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--accent-cyan, #00e5ff);
      font-weight: 700;
      margin-bottom: 10px;
    }
    .lb-room-title {
      font-family: var(--font-display, 'Orbitron', monospace);
      font-size: clamp(1.8rem, 3vw, 2.8rem);
      font-weight: 900;
      line-height: 1.1;
      margin-bottom: 10px;
      letter-spacing: -0.01em;
    }
    .lb-room-id {
      color: var(--accent-cyan, #00e5ff);
      text-shadow: 0 0 20px rgba(0,229,255,0.4);
    }
    .lb-room-sub {
      color: var(--text-secondary, #8892c4);
      line-height: 1.65;
      max-width: 520px;
      font-size: 0.95rem;
    }

    .lb-stats-row {
      display: flex;
      align-items: center;
      gap: 0;
      background: rgba(8,10,28,0.7);
      border: 1px solid var(--border-dim, rgba(80,120,255,0.12));
      border-radius: 16px;
      padding: 16px 24px;
      backdrop-filter: blur(12px);
    }
    .lb-stat { text-align: center; padding: 0 20px; }
    .lb-stat-num {
      display: block;
      font-family: var(--font-display, 'Orbitron', monospace);
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--text-primary, #eef2ff);
      line-height: 1;
      margin-bottom: 4px;
    }
    .lb-stat-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-dim, #4a5280);
    }
    .lb-stat-divider {
      width: 1px;
      height: 36px;
      background: var(--border-dim, rgba(80,120,255,0.12));
    }

    /* Message box */
    .lb-msgbox {
      margin: 0 28px 16px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 0.9rem;
      border: 1px solid transparent;
      line-height: 1.5;
    }
    .lb-msgbox.is-err { background:rgba(255,77,106,0.1); border-color:rgba(255,77,106,0.25); color:#ff9aaa; }
    .lb-msgbox.is-ok  { background:rgba(0,255,157,0.08); border-color:rgba(0,255,157,0.22); color:#80ffcc; }

    /* Main grid */
    .lb-grid {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 20px;
      padding: 0 28px;
    }
    .lb-panel {
      background: rgba(8,10,28,0.75);
      border: 1px solid var(--border-dim, rgba(80,120,255,0.12));
      border-radius: 20px;
      padding: 24px;
      backdrop-filter: blur(14px);
    }
    .lb-panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 20px;
    }
    .lb-panel-title {
      font-family: var(--font-display, 'Orbitron', monospace);
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--text-primary, #eef2ff);
    }
    .lb-count {
      min-width: 30px; height: 30px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(79,138,255,0.14);
      color: #93b8ff;
      font-weight: 700;
      font-size: 0.85rem;
      border: 1px solid rgba(79,138,255,0.22);
    }

    /* Controller list */
    .lc-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .lc-card {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(14,18,42,0.6);
      border: 1px solid var(--border-dim, rgba(80,120,255,0.12));
      border-radius: 14px;
      padding: 12px 14px;
      transition: border-color 0.18s;
    }
    .lc-card:hover { border-color: var(--border-mid, rgba(80,120,255,0.28)); }
    .lc-avatar {
      width: 42px; height: 42px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.1rem;
      color: white;
      flex-shrink: 0;
      box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    }
    .lc-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .lc-name { font-weight: 600; font-size: 0.95rem; color: var(--text-primary, #eef2ff); }
    .lc-status {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .lc-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .lc-status.is-on  { color: var(--accent-green, #00ff9d); }
    .lc-status.is-off { color: var(--accent-red,   #ff4d6a); }
    .lc-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 28px 18px;
      border-radius: 14px;
      border: 1px dashed var(--border-dim, rgba(80,120,255,0.12));
      color: var(--text-dim, #4a5280);
      font-size: 0.9rem;
    }

    /* Game grid */
    .lg-grid { display: flex; flex-direction: column; gap: 12px; }
    .lg-card {
      width: 100%;
      text-align: left;
      border-radius: 16px;
      padding: 16px;
      border: 1px solid var(--border-dim, rgba(80,120,255,0.12));
      background: rgba(14,18,42,0.55);
      color: var(--text-primary, #eef2ff);
      cursor: pointer;
      transition: transform 0.18s, border-color 0.18s, background 0.18s, box-shadow 0.18s;
    }
    .lg-card:hover:not(:disabled) {
      transform: translateY(-2px);
      background: rgba(20,26,58,0.8);
      border-color: var(--border-mid, rgba(80,120,255,0.28));
      box-shadow: 0 8px 28px rgba(0,0,0,0.25);
    }
    .lg-card.is-selected {
      border-color: rgba(0,255,157,0.4);
      background: rgba(0,255,157,0.07);
      box-shadow: 0 0 20px rgba(0,255,157,0.1);
    }
    .lg-card:disabled { opacity:0.5; cursor:not-allowed; }
    .lg-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .lg-emoji { font-size: 1.5rem; }
    .lg-tag {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.07);
      color: var(--text-secondary, #8892c4);
      letter-spacing: 0.06em;
    }
    .lg-tag.is-sel { background:rgba(0,255,157,0.14); color:#80ffcc; }
    .lg-name { font-family: var(--font-display, 'Orbitron', monospace); font-size: 0.88rem; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.04em; }
    .lg-desc { color: var(--text-secondary, #8892c4); line-height: 1.55; font-size: 0.87rem; margin-bottom: 10px; }
    .lg-meta { font-size: 0.78rem; color: var(--text-dim, #4a5280); }

    /* Start area */
    .lb-start-area { margin-top: 20px; }
    .lb-start-btn {
      width: 100%;
      height: 52px;
      border: none;
      border-radius: 14px;
      background: linear-gradient(90deg, var(--accent-blue,#4f8aff), var(--accent-purple,#9d5cff));
      color: white;
      font-family: var(--font-display, 'Orbitron', monospace);
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      position: relative;
      overflow: hidden;
      transition: transform 0.15s, opacity 0.15s, box-shadow 0.15s;
    }
    .lb-start-btn::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 60%);
    }
    .lb-start-btn:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 0 24px rgba(79,138,255,0.4), 0 0 60px rgba(79,138,255,0.1);
    }
    .lb-start-btn:active:not(:disabled) { transform: scale(0.984); }
    .lb-start-btn:disabled { opacity:0.4; cursor:not-allowed; }
    .lb-start-icon { font-size: 0.9rem; }

    .lb-helper {
      margin: 10px 0 0;
      color: var(--text-secondary, #8892c4);
      font-size: 0.85rem;
      line-height: 1.55;
      text-align: center;
    }

    .lb-wait-box {
      margin-top: 18px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-radius: 14px;
      padding: 16px;
      background: rgba(79,138,255,0.08);
      border: 1px solid rgba(79,138,255,0.18);
      color: #a3bfff;
      line-height: 1.55;
      font-size: 0.9rem;
    }

    /* Responsive */
    @media (max-width: 900px) {
      .lb-grid { grid-template-columns: 1fr; }
      .lb-hero { flex-direction: column; }
      .lb-stats-row { width: 100%; justify-content: center; }
    }
    @media (max-width: 640px) {
      .lb-topbar { padding: 14px 16px; }
      .lb-hero { padding: 22px 16px 18px; }
      .lb-grid { padding: 0 16px; }
      .lb-room-title { font-size: 1.8rem; }
      .lb-topbar-right { gap: 8px; }
      .lb-brand-text { display: none; }
    }
  `;
  document.head.appendChild(style);
  lobbyStylesMounted = true;
}

function formatStatus(status) {
  if (!status) return "Unknown";
  const n = String(status).toLowerCase();
  if (n === "waiting")  return "Waiting";
  if (n === "starting") return "Starting";
  if (n === "running")  return "Running";
  if (n === "ended")    return "Ended";
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function getStatusClass(status) {
  const n = String(status || "").toLowerCase();
  if (n === "running")  return "status-running";
  if (n === "starting") return "status-starting";
  if (n === "ended")    return "status-ended";
  return "status-waiting";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
