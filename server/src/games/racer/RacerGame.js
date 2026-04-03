/**
 * RacerGame.js
 * server/src/games/racer/RacerGame.js
 *
 * Improvements v2:
 *  - Full analog input: handleInput now reads { dx, dy } floats (−1..1)
 *    so the controller joystick maps directly — no 8-direction snapping.
 *  - Fixed _segmentTouchesRect: previous version always returned true,
 *    causing checkpoints / finish line to trigger on wrong passes.
 *  - Car-to-car collision: cars push each other apart on overlap.
 *  - Pause reason now shows the disconnected player's name.
 *  - Disconnected player inputs are cleared so ghost movement stops.
 *  - Backward-compat: still accepts legacy { direction, pressed } from
 *    old controller builds (graceful fallback).
 */

const BaseGame = require("../base/BaseGame");
const EVENTS   = require("../../shared/events");

const ARENA_W        = 800;
const ARENA_H        = 600;
const CAR_RADIUS     = 16;
const BASE_SPEED     = 190;
const OFFROAD_SPEED  = 120;
const LAPS_TO_WIN    = 3;

const SPAWNS = [
  { x: 100, y: 260 },
  { x: 180, y: 260 },
  { x: 100, y: 320 },
  { x: 180, y: 320 },
];

const OBSTACLES = [
  { x: 390, y: 225, r: 26 },
  { x: 430, y: 265, r: 26 },
  { x: 370, y: 305, r: 26 },
  { x: 425, y: 350, r: 26 },
  { x: 390, y: 400, r: 26 },
];

const CHECKPOINTS = [
  { id: 0, x: 260, y:  80, width: 300, height: 100, axis: "horizontal" },
  { id: 1, x: 560, y: 170, width: 110, height: 220, axis: "vertical"   },
  { id: 2, x: 250, y: 400, width: 300, height: 100, axis: "horizontal" },
];

const FINISH_GATE = {
  x: 70, y: 200, width: 180, height: 20, axis: "horizontal",
};

// ── Legacy direction → dx/dy map (backward compat) ────────────────────────────
const DIR_MAP = {
  up:         {  dx:  0, dy: -1 },
  down:       {  dx:  0, dy:  1 },
  left:       {  dx: -1, dy:  0 },
  right:      {  dx:  1, dy:  0 },
  "up-left":  {  dx: -0.7071, dy: -0.7071 },
  "up-right": {  dx:  0.7071, dy: -0.7071 },
  "down-left":{  dx: -0.7071, dy:  0.7071 },
  "down-right":{ dx:  0.7071, dy:  0.7071 },
};

class RacerGame extends BaseGame {
  constructor(room) {
    super(room);
    this.pauseEndTime    = null;
    this.pauseDurationMs = 30_000;
    this.winnerId        = null;
    this.track = {
      width: ARENA_W, height: ARENA_H,
      lapsToWin: LAPS_TO_WIN,
      checkpoints: CHECKPOINTS,
      finishGate: FINISH_GATE,
      obstacles: OBSTACLES,
      road: {
        outer: { x: 400, y: 300, rx: 340, ry: 250 },
        inner: { x: 400, y: 300, rx: 185, ry: 110 },
      },
    };
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init() {
    this.winnerId   = null;
    this.pauseEndTime = null;
    this.state.meta = { paused: false, reason: "", countdown: 0 };
  }

  addPlayer(playerId) {
    if (!playerId) return;
    if (this.state.players[playerId]) return;

    const index = Object.keys(this.state.players).length;
    const spawn = SPAWNS[index] || SPAWNS[0];

    this.state.players[playerId] = {
      x: spawn.x, y: spawn.y,
      prevX: spawn.x, prevY: spawn.y,
      vx: 0, vy: 0,
      angle: -Math.PI / 2,
      speed: BASE_SPEED,
      lap: 0,
      checkpointIndex: 0,
      finished: false,
      // Analog input axes (−1..1)
      inputDx: 0,
      inputDy: 0,
    };
  }

  // ── Input ───────────────────────────────────────────────────────────────────

  /**
   * Accepts analog:  { dx: number, dy: number }   (new controllers)
   * Accepts legacy:  { direction: string, pressed: boolean }  (old controllers)
   */
  handleInput(playerId, input) {
    if (this.state.meta?.paused) return;
    const p = this.state.players[playerId];
    if (!p) return;
    if (!this.isRunning()) return;
    if (!this.room.players[playerId]?.connected) return;

    // ── Analog path ──
    if (typeof input.dx === "number" && typeof input.dy === "number") {
      // Clamp & normalize to unit length if needed
      let dx = Math.max(-1, Math.min(1, input.dx));
      let dy = Math.max(-1, Math.min(1, input.dy));
      const mag = Math.hypot(dx, dy);
      if (mag > 1) { dx /= mag; dy /= mag; }
      p.inputDx = dx;
      p.inputDy = dy;
      return;
    }

    // ── Legacy digital path ──
    const { direction, pressed } = input;
    if (typeof pressed !== "boolean") return;

    if (!pressed) {
      // Release: clear axis only if this direction was driving it
      const mapped = DIR_MAP[direction];
      if (mapped) {
        if (Math.abs(mapped.dx) > 0.1 && Math.sign(p.inputDx) === Math.sign(mapped.dx)) p.inputDx = 0;
        if (Math.abs(mapped.dy) > 0.1 && Math.sign(p.inputDy) === Math.sign(mapped.dy)) p.inputDy = 0;
      }
    } else {
      const mapped = DIR_MAP[direction];
      if (mapped) { p.inputDx = mapped.dx; p.inputDy = mapped.dy; }
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  update(delta) {
    if (!this.isRunning()) return;
    if (this.winnerId) return;

    const activePlayers = this._getActivePlayers();

    // ── Pause logic ──
    if (activePlayers.length < 2) {
      if (!this.state.meta.paused) {
        this.state.meta.paused = true;

        // Find the disconnected player's name for a friendly message
        const disconnectedId = Object.keys(this.state.players).find(
          (id) => !this.room.players[id]?.connected,
        );
        const name = disconnectedId
          ? this.room.players[disconnectedId]?.name || disconnectedId
          : "A player";

        this.state.meta.reason = `${name} disconnected. Waiting for reconnect…`;
        this.pauseEndTime = Date.now() + this.pauseDurationMs;

        // Clear inputs of disconnected players so their car stops
        for (const id of Object.keys(this.state.players)) {
          if (!this.room.players[id]?.connected) {
            this._clearPlayerInputs(id);
          }
        }
      }

      this.state.meta.countdown = Math.max(0, this.pauseEndTime - Date.now());

      if (Date.now() >= this.pauseEndTime) {
        this.end();
        if (this.room && typeof this.room.resetToLobby === "function") {
          this.room.resetToLobby();
        }
        return;
      }

      return;
    }

    // ── Resume ──
    this.state.meta.paused   = false;
    this.state.meta.reason   = "";
    this.state.meta.countdown = 0;
    this.pauseEndTime         = null;

    const dt      = delta / 1000;
    const activeIds = this._getActivePlayers();

    for (const id of activeIds) {
      const p = this.state.players[id];
      if (!p || p.finished) continue;

      p.prevX = p.x;
      p.prevY = p.y;

      let dx = p.inputDx;
      let dy = p.inputDy;

      // Normalize (safety — analog should already be unit but legacy may not be)
      const mag = Math.hypot(dx, dy);
      if (mag > 0) { dx /= mag; dy /= mag; }

      const moveSpeed = this._isOnRoad(p.x, p.y) ? BASE_SPEED : OFFROAD_SPEED;

      p.vx = dx * moveSpeed;
      p.vy = dy * moveSpeed;

      const nextX = p.x + p.vx * dt;
      const nextY = p.y + p.vy * dt;

      const resolved = this._resolveMovement(nextX, nextY);
      p.x = resolved.x;
      p.y = resolved.y;
      p.speed = moveSpeed;

      if (p.vx !== 0 || p.vy !== 0) {
        p.angle = Math.atan2(p.vy, p.vx);
      }

      this._updateProgress(id, p);
    }

    // ── Car-to-car collision ──
    this._resolveCarCollisions(activeIds);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _clearPlayerInputs(playerId) {
    const p = this.state.players[playerId];
    if (!p) return;
    p.inputDx = 0;
    p.inputDy = 0;
    p.vx = 0;
    p.vy = 0;
  }

  _getActivePlayers() {
    return Object.keys(this.state.players).filter(
      (id) => this.room.players[id]?.connected,
    );
  }

  _isOnRoad(x, y) {
    const outer = this._ellipseNorm(x, y,
      this.track.road.outer.x, this.track.road.outer.y,
      this.track.road.outer.rx, this.track.road.outer.ry);
    const inner = this._ellipseNorm(x, y,
      this.track.road.inner.x, this.track.road.inner.y,
      this.track.road.inner.rx, this.track.road.inner.ry);
    return outer <= 1 && inner >= 1;
  }

  _ellipseNorm(x, y, cx, cy, rx, ry) {
    const dx = x - cx, dy = y - cy;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  }

  _resolveMovement(x, y) {
    let nx = Math.max(CAR_RADIUS, Math.min(ARENA_W - CAR_RADIUS, x));
    let ny = Math.max(CAR_RADIUS, Math.min(ARENA_H - CAR_RADIUS, y));

    for (const obs of OBSTACLES) {
      const dx = nx - obs.x, dy = ny - obs.y;
      const dist = Math.hypot(dx, dy);
      const min  = CAR_RADIUS + obs.r;
      if (dist > 0 && dist < min) {
        const push = min - dist;
        nx += (dx / dist) * push;
        ny += (dy / dist) * push;
      }
    }

    nx = Math.max(CAR_RADIUS, Math.min(ARENA_W - CAR_RADIUS, nx));
    ny = Math.max(CAR_RADIUS, Math.min(ARENA_H - CAR_RADIUS, ny));
    return { x: nx, y: ny };
  }

  /** Push overlapping cars apart */
  _resolveCarCollisions(ids) {
    const minDist = CAR_RADIUS * 2;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = this.state.players[ids[i]];
        const b = this.state.players[ids[j]];
        if (!a || !b) continue;

        const dx   = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < minDist && dist > 0) {
          const overlap = (minDist - dist) / 2;
          const nx = (dx / dist) * overlap;
          const ny = (dy / dist) * overlap;
          a.x -= nx; a.y -= ny;
          b.x += nx; b.y += ny;

          // Clamp after push
          a.x = Math.max(CAR_RADIUS, Math.min(ARENA_W - CAR_RADIUS, a.x));
          a.y = Math.max(CAR_RADIUS, Math.min(ARENA_H - CAR_RADIUS, a.y));
          b.x = Math.max(CAR_RADIUS, Math.min(ARENA_W - CAR_RADIUS, b.x));
          b.y = Math.max(CAR_RADIUS, Math.min(ARENA_H - CAR_RADIUS, b.y));
        }
      }
    }
  }

  _updateProgress(playerId, player) {
    const nextGate = CHECKPOINTS[player.checkpointIndex];
    if (nextGate && this._crossedGate(player, nextGate)) {
      player.checkpointIndex += 1;
    }

    if (
      player.checkpointIndex >= CHECKPOINTS.length &&
      this._crossedGate(player, FINISH_GATE)
    ) {
      player.lap += 1;
      player.checkpointIndex = 0;

      if (player.lap >= LAPS_TO_WIN) {
        player.finished = true;
        this.winnerId = playerId;
        this._endRace();
      }
    }
  }

  _crossedGate(player, gate) {
    if (!gate) return false;

    const wasInside = this._pointInRect(player.prevX, player.prevY, gate);
    const isInside  = this._pointInRect(player.x, player.y, gate);

    // Entered gate this frame
    if (!wasInside && isInside) return true;

    // Both inside — no new crossing
    if (wasInside && isInside) return false;

    // Check segment crossing for gates the car passed through at speed
    if (gate.axis === "vertical") {
      const midX = gate.x + gate.width / 2;
      const prevSide = player.prevX < midX ? -1 : 1;
      const currSide = player.x       < midX ? -1 : 1;
      if (prevSide !== currSide && this._segmentCrossesRect(
        player.prevX, player.prevY, player.x, player.y, gate)) return true;
    }

    if (gate.axis === "horizontal") {
      const midY = gate.y + gate.height / 2;
      const prevSide = player.prevY < midY ? -1 : 1;
      const currSide = player.y     < midY ? -1 : 1;
      if (prevSide !== currSide && this._segmentCrossesRect(
        player.prevX, player.prevY, player.x, player.y, gate)) return true;
    }

    return false;
  }

  _pointInRect(x, y, rect) {
    return (
      x >= rect.x && x <= rect.x + rect.width &&
      y >= rect.y && y <= rect.y + rect.height
    );
  }

  /**
   * Fixed: proper AABB segment intersection test.
   * Uses the separating-axis theorem for a segment vs rectangle.
   */
  _segmentCrossesRect(x1, y1, x2, y2, rect) {
    const rx = rect.x, ry = rect.y, rw = rect.width, rh = rect.height;

    // Quick bbox reject
    if (Math.max(x1, x2) < rx || Math.min(x1, x2) > rx + rw) return false;
    if (Math.max(y1, y2) < ry || Math.min(y1, y2) > ry + rh) return false;

    // If either endpoint is inside, it crosses
    if (this._pointInRect(x1, y1, rect)) return true;
    if (this._pointInRect(x2, y2, rect)) return true;

    // Check each of the 4 rect edges against the segment
    return (
      this._segmentsIntersect(x1, y1, x2, y2, rx,      ry,      rx + rw, ry      ) ||
      this._segmentsIntersect(x1, y1, x2, y2, rx + rw, ry,      rx + rw, ry + rh ) ||
      this._segmentsIntersect(x1, y1, x2, y2, rx + rw, ry + rh, rx,      ry + rh ) ||
      this._segmentsIntersect(x1, y1, x2, y2, rx,      ry + rh, rx,      ry      )
    );
  }

  /** Standard 2D segment-segment intersection test */
  _segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1x = bx - ax, d1y = by - ay;
    const d2x = dx - cx, d2y = dy - cy;
    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) return false; // parallel

    const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross;
    const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  // ── End game ────────────────────────────────────────────────────────────────

  _endRace() {
    this.end();
    this.room.io.to(this.room.id).emit(EVENTS.RACER.GAME_OVER, {
      winner: this.winnerId,
    });
    setTimeout(() => {
      if (this.room && typeof this.room.resetToLobby === "function") {
        this.room.resetToLobby();
      }
    }, 5_000);
  }

  // ── State ───────────────────────────────────────────────────────────────────

  getState() {
    const players = {};
    for (const [id, p] of Object.entries(this.state.players)) {
      if (!this.room.players[id]?.connected) continue;
      players[id] = {
        x: p.x, y: p.y,
        prevX: p.prevX, prevY: p.prevY,
        vx: p.vx, vy: p.vy,
        angle: p.angle,
        speed: p.speed,
        lap: p.lap,
        checkpointIndex: p.checkpointIndex,
        finished: p.finished,
        color: this.room.players[id]?.color,
        name:  this.room.players[id]?.name || id,
      };
    }

    return {
      roomId: this.room.id,
      players,
      winner: this.winnerId,
      track: this.track,
      meta: {
        paused:    !!this.state.meta?.paused,
        reason:    this.state.meta?.reason   || "",
        countdown: this.state.meta?.countdown || 0,
      },
    };
  }
}

module.exports = RacerGame;
