/**
 * PaintGame.js
 * Drop into: server/src/games/paint/PaintGame.js
 *
 * Territory paint game — players roll brushes across a grid,
 * claiming cells. Powerups (speed, size, freeze) spawn randomly.
 * Server is fully authoritative: scores, grid, powerups all live here.
 *
 * Changes v2:
 *  - Pause feature: if a player disconnects and connected count < 2,
 *    the game pauses and starts a 30-second reconnect countdown.
 *    If the player does not rejoin in time, the room returns to lobby.
 *  - Reduced powerup spawn frequency (8 s) and max simultaneous (3).
 *  - Fixed freeze bug: frozen player inputs are cleared immediately so
 *    the player stops moving the instant they are frozen.
 *  - Fixed movement bug: velocity is zeroed when no keys are held,
 *    preventing phantom movement after input is released.
 */

const BaseGame = require("../base/BaseGame");
const EVENTS = require("../../shared/events");

// ─── Constants ────────────────────────────────────────────────────────────────

const ARENA_W = 800;
const ARENA_H = 600;
const CELL = 20;
const COLS = ARENA_W / CELL; // 40
const ROWS = ARENA_H / CELL; // 30
const TOTAL_CELLS = COLS * ROWS; // 1200

const GAME_DURATION_MS = 60_000;

const BASE_SPEED = 180;
const BASE_RADIUS = 14;

// Reduced: spawn every 8 s (was 5 s), max 3 active (was 5)
const POWERUP_INTERVAL_MS = 8_000;
const MAX_POWERUPS = 3;
const POWERUP_RADIUS = 18;

const POWERUPS = {
  speed:  { duration: 6_000, label: "⚡ Speed",  speedMult: 2.0, sizeMult: 1.0 },
  size:   { duration: 6_000, label: "🖌️ Big",    speedMult: 1.0, sizeMult: 2.5 },
  freeze: { duration: 4_000, label: "❄️ Freeze", speedMult: 1.0, sizeMult: 1.0 },
};

// Pause / reconnect window (ms)
const RECONNECT_TIMEOUT_MS = 30_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _pwId = 0;
function newPwId() {
  return `pw_${++_pwId}`;
}

function cellsInRadius(cx, cy, r) {
  const cells = [];
  const minCol = Math.max(0, Math.floor((cx - r) / CELL));
  const maxCol = Math.min(COLS - 1, Math.floor((cx + r) / CELL));
  const minRow = Math.max(0, Math.floor((cy - r) / CELL));
  const maxRow = Math.min(ROWS - 1, Math.floor((cy + r) / CELL));

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cx2 = col * CELL + CELL / 2;
      const cy2 = row * CELL + CELL / 2;
      if (Math.hypot(cx2 - cx, cy2 - cy) <= r + CELL / 2) {
        cells.push(row * COLS + col);
      }
    }
  }
  return cells;
}

// ─── PaintGame ────────────────────────────────────────────────────────────────

class PaintGame extends BaseGame {
  constructor(room) {
    super(room);

    this.grid = new Array(TOTAL_CELLS).fill(null);
    this.dirtyCells = new Map();
    this.scores = {};
    this.powerups = {};
    this.effects = {};

    this.startTime = null;
    this.endTime = null;
    this._nextPwSpawn = 0;
    this._frozen = new Set();

    // ── Pause state ──────────────────────────────────────────────────────────
    this._paused = false;
    this._pauseReason = "";
    this._pauseTimeLeft = 0;
    this._reconnectDeadline = null;
    this._reconnectTimer = null;
    this._disconnectedId = null;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init() {
    this.grid.fill(null);
    this.dirtyCells.clear();
    this.scores = {};
    this.powerups = {};
    this.effects = {};
    this._frozen = new Set();
    this._nextPwSpawn = 0;
    this.startTime = null;
    this.endTime = null;
    this._clearPauseState();
  }

  addPlayer(playerId) {
    if (!playerId) return;
    if (this.state.players[playerId]) return;

    const index = Object.keys(this.state.players).length;
    const spawns = [
      { x: 80,  y: 80  },
      { x: 720, y: 80  },
      { x: 80,  y: 520 },
      { x: 720, y: 520 },
    ];
    const spawn = spawns[index] || { x: 400, y: 300 };

    this.state.players[playerId] = {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      speed: BASE_SPEED,
      radius: BASE_RADIUS,
      lastInputTime: 0,
      // Analog input axes (-1..1); legacy boolean inputs converted on arrival
      inputDx: 0,
      inputDy: 0,
      input: { left: false, right: false, up: false, down: false },
    };

    this.scores[playerId] = 0;
    this.effects[playerId] = {};

    this._paint(playerId, spawn.x, spawn.y, BASE_RADIUS);
  }

  // ── Disconnect / reconnect hooks (called from Room) ──────────────────────────

  /**
   * Call this from Room.removeParticipant when the game is running.
   * If fewer than 2 players remain connected, pause and start the countdown.
   */
  onPlayerDisconnected(playerId) {
    if (!this.isRunning() && !this._paused) return;

    // Clear inputs so the disconnected player's sprite stops
    this._clearPlayerInputs(playerId);

    const connectedCount = this._connectedPlayerCount();
    if (connectedCount < 2) {
      this._pause(playerId);
    }
  }

  /**
   * Call this from Room.addPlayer when the game is running and paused.
   * If the reconnecting player is the one who triggered the pause, resume.
   */
  onPlayerReconnected(playerId) {
    if (!this._paused) return;
    if (playerId !== this._disconnectedId) return;
    this._resume();
  }

  // ── Input ───────────────────────────────────────────────────────────────────

  handleInput(playerId, input) {
    const p = this.state.players[playerId];
    if (!p) return;
    if (!this.isRunning()) return;
    if (this._paused) return;
    if (this._frozen.has(playerId)) return;
    if (!this.room.players[playerId]?.connected) return;

    // ── Analog path (new controllers) ──
    if (typeof input.dx === "number" && typeof input.dy === "number") {
      let dx = Math.max(-1, Math.min(1, input.dx));
      let dy = Math.max(-1, Math.min(1, input.dy));
      const mag = Math.hypot(dx, dy);
      if (mag > 1) { dx /= mag; dy /= mag; }
      p.inputDx = dx;
      p.inputDy = dy;
      p.lastInputTime = Date.now();
      return;
    }

    // ── Legacy 8-direction digital path ──
    const DIR_MAP = {
      up:           { dx:  0,      dy: -1      },
      down:         { dx:  0,      dy:  1      },
      left:         { dx: -1,      dy:  0      },
      right:        { dx:  1,      dy:  0      },
      "up-left":    { dx: -0.7071, dy: -0.7071 },
      "up-right":   { dx:  0.7071, dy: -0.7071 },
      "down-left":  { dx: -0.7071, dy:  0.7071 },
      "down-right": { dx:  0.7071, dy:  0.7071 },
    };
    const { direction, pressed } = input;
    if (typeof pressed !== "boolean") return;

    if (!pressed) {
      p.inputDx = 0;
      p.inputDy = 0;
    } else {
      const mapped = DIR_MAP[direction];
      if (mapped) { p.inputDx = mapped.dx; p.inputDy = mapped.dy; }
    }

    p.lastInputTime = Date.now();
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  update(delta) {
    if (!this.isRunning()) return;
    if (this._paused) return; // timer frozen; state still broadcast by Room

    const now = Date.now();
    const dt  = delta / 1000;

    if (now >= this.endTime) {
      this._endGame();
      return;
    }

    // ── Expire powerup effects ──
    for (const [pid, eff] of Object.entries(this.effects)) {
      const p = this.state.players[pid];
      if (!p) continue;

      if (eff.speed && now >= eff.speed.endsAt) {
        delete eff.speed;
        p.speed = BASE_SPEED;
      }
      if (eff.size && now >= eff.size.endsAt) {
        delete eff.size;
        p.radius = BASE_RADIUS;
      }
      if (eff.freeze && now >= eff.freeze.endsAt) {
        delete eff.freeze;
        this._frozen.delete(pid);
      }
    }

    // ── Spawn powerups ──
    if (
      now >= this._nextPwSpawn &&
      Object.keys(this.powerups).length < MAX_POWERUPS
    ) {
      this._spawnPowerup();
      this._nextPwSpawn = now + POWERUP_INTERVAL_MS;
    }

    // ── Move players & paint ──
    const activePlayers = this._getActivePlayers();

    for (const id of activePlayers) {
      const p = this.state.players[id];
      if (!p) continue;

      if (this._frozen.has(id)) {
        // FIX: zero velocity so renderer knows the player is still
        p.vx = 0;
        p.vy = 0;
        continue;
      }

      // Analog input: inputDx/inputDy are already normalised (-1..1)
      let vx = p.inputDx;
      let vy = p.inputDy;
      const mag = Math.hypot(vx, vy);
      if (mag > 1) { vx /= mag; vy /= mag; }

      p.vx = vx;
      p.vy = vy;
      p.x  = Math.max(p.radius, Math.min(ARENA_W - p.radius, p.x + vx * p.speed * dt));
      p.y  = Math.max(p.radius, Math.min(ARENA_H - p.radius, p.y + vy * p.speed * dt));

      this._paint(id, p.x, p.y, p.radius);
      this._checkPowerups(id, p);
    }
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  _paint(playerId, cx, cy, radius) {
    const cells = cellsInRadius(cx, cy, radius);
    for (const idx of cells) {
      const prev = this.grid[idx];
      if (prev !== playerId) {
        if (prev !== null)
          this.scores[prev] = Math.max(0, (this.scores[prev] || 0) - 1);
        this.scores[playerId] = (this.scores[playerId] || 0) + 1;
        this.grid[idx] = playerId;
        this.dirtyCells.set(idx, playerId);
      }
    }
  }

  _spawnPowerup() {
    const types = Object.keys(POWERUPS);
    const type = types[Math.floor(Math.random() * types.length)];
    const id = newPwId();
    const margin = 60;
    const x = margin + Math.random() * (ARENA_W - margin * 2);
    const y = margin + Math.random() * (ARENA_H - margin * 2);
    this.powerups[id] = { id, type, x, y };
  }

  _checkPowerups(playerId, player) {
    for (const [pwId, pw] of Object.entries(this.powerups)) {
      const dx = player.x - pw.x;
      const dy = player.y - pw.y;
      if (dx * dx + dy * dy < (player.radius + POWERUP_RADIUS) ** 2) {
        this._applyPowerup(playerId, player, pw.type);
        delete this.powerups[pwId];
        break;
      }
    }
  }

  _applyPowerup(playerId, player, type) {
    const cfg = POWERUPS[type];
    if (!cfg) return;

    const endsAt = Date.now() + cfg.duration;
    this.effects[playerId] = this.effects[playerId] || {};

    if (type === "speed") {
      player.speed = BASE_SPEED * cfg.speedMult;
      this.effects[playerId].speed = { endsAt };
    } else if (type === "size") {
      player.radius = BASE_RADIUS * cfg.sizeMult;
      this.effects[playerId].size = { endsAt };
    } else if (type === "freeze") {
      for (const [otherId] of Object.entries(this.state.players)) {
        if (otherId === playerId) continue;
        this._frozen.add(otherId);
        this.effects[otherId] = this.effects[otherId] || {};
        this.effects[otherId].freeze = { endsAt };
        // FIX: clear inputs so the frozen player stops moving immediately
        this._clearPlayerInputs(otherId);
      }
    }
  }

  _clearPlayerInputs(playerId) {
    const p = this.state.players[playerId];
    if (!p) return;
    p.inputDx = 0;
    p.inputDy = 0;
    p.input.left  = false;
    p.input.right = false;
    p.input.up    = false;
    p.input.down  = false;
    p.vx = 0;
    p.vy = 0;
  }

  _getActivePlayers() {
    return Object.keys(this.state.players).filter(
      (id) => this.room.players[id]?.connected,
    );
  }

  _connectedPlayerCount() {
    return Object.values(this.room.players).filter((p) => p.connected).length;
  }

  // ── Pause / resume ──────────────────────────────────────────────────────────

  _pause(disconnectedPlayerId) {
    if (this._paused) return;

    this._paused = true;
    this._disconnectedId = disconnectedPlayerId;
    // Snapshot remaining game time
    this._pauseTimeLeft = Math.max(0, this.endTime - Date.now());
    this._reconnectDeadline = Date.now() + RECONNECT_TIMEOUT_MS;

    const name =
      this.room.players[disconnectedPlayerId]?.name || disconnectedPlayerId;
    this._pauseReason = `${name} disconnected. Waiting for reconnect…`;

    // Return to lobby if nobody reconnects within the window
    this._reconnectTimer = setTimeout(() => {
      this._returnToLobby();
    }, RECONNECT_TIMEOUT_MS);
  }

  _resume() {
    if (!this._paused) return;

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    // Restore the remaining time
    this.endTime = Date.now() + this._pauseTimeLeft;
    this._clearPauseState();
  }

  _clearPauseState() {
    this._paused = false;
    this._pauseReason = "";
    this._pauseTimeLeft = 0;
    this._reconnectDeadline = null;
    this._disconnectedId = null;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  _returnToLobby() {
    this._clearPauseState();
    this.end();
    if (this.room && typeof this.room.resetToLobby === "function") {
      this.room.resetToLobby();
    }
  }

  _endGame() {
    this.end();
    let winner = null, best = -1;
    for (const [id, count] of Object.entries(this.scores)) {
      if (count > best) { best = count; winner = id; }
    }

    this.room.io.to(this.room.id).emit(EVENTS.PAINT.GAME_OVER, {
      winner,
      scores: { ...this.scores },
      total: TOTAL_CELLS,
    });

    setTimeout(() => {
      if (this.room && typeof this.room.resetToLobby === "function") {
        this.room.resetToLobby();
      }
    }, 5_000);
  }

  // ── State ───────────────────────────────────────────────────────────────────

  getState() {
    const now = Date.now();

    const paintDelta = [];
    for (const [idx, owner] of this.dirtyCells) {
      paintDelta.push([idx, owner]);
    }
    this.dirtyCells.clear();

    const players = {};
    for (const [id, p] of Object.entries(this.state.players)) {
      if (!this.room.players[id]?.connected) continue;
      players[id] = {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        radius: p.radius,
        color: this.room.players[id]?.color,
        name: this.room.players[id]?.name || id,
        frozen: this._frozen.has(id),
        effects: this._serializeEffects(id, now),
      };
    }

    const scores = {};
    for (const [id, count] of Object.entries(this.scores)) {
      scores[id] = {
        count,
        pct: Math.round((count / TOTAL_CELLS) * 100),
        name: this.room.players[id]?.name || id,
        color: this.room.players[id]?.color || "#ffffff",
      };
    }

    const meta = this._paused
      ? {
          paused: true,
          reason: this._pauseReason,
          reconnectCountdown: Math.max(
            0,
            Math.ceil((this._reconnectDeadline - now) / 1000),
          ),
        }
      : { paused: false };

    return {
      roomId: this.room.id,
      players,
      paintDelta,
      powerups: { ...this.powerups },
      scores,
      timeLeft: this._paused
        ? this._pauseTimeLeft
        : Math.max(0, (this.endTime || 0) - now),
      cols: COLS,
      rows: ROWS,
      cellSize: CELL,
      arenaW: ARENA_W,
      arenaH: ARENA_H,
      frozen: [...this._frozen],
      meta,
    };
  }

  _serializeEffects(playerId, now) {
    const eff = this.effects[playerId] || {};
    const out = {};
    for (const [k, v] of Object.entries(eff)) {
      out[k] = Math.max(0, v.endsAt - now);
    }
    return out;
  }

  // ── Required by BaseGame ────────────────────────────────────────────────────

  start() {
    super.start();
    this.startTime = Date.now();
    this.endTime = this.startTime + GAME_DURATION_MS;
    this._nextPwSpawn = this.startTime + POWERUP_INTERVAL_MS;
  }

  destroy() {
    this._clearPauseState();
    this.grid = null;
    this.dirtyCells = null;
    this.scores = null;
    this.powerups = null;
    this.effects = null;
    this._frozen = null;
    super.destroy();
  }
}

module.exports = PaintGame;
