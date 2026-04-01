const BaseGame = require("../base/BaseGame");
const EVENTS = require("../../shared/events");

const ARENA_W = 800;
const ARENA_H = 600;

const CAR_RADIUS = 16;
const BASE_SPEED = 190;
const OFFROAD_SPEED = 120;
const LAPS_TO_WIN = 3;

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
  { id: 0, x: 260, y: 80, width: 300, height: 100, axis: "horizontal" },
  { id: 1, x: 560, y: 170, width: 110, height: 220, axis: "vertical" },
  { id: 2, x: 250, y: 400, width: 300, height: 100, axis: "horizontal" },
];
const FINISH_GATE = {
  x: 70,
  y: 200,
  width: 180,
  height: 20,
  axis: "horizontal",
};
class RacerGame extends BaseGame {
  constructor(room) {
    super(room);
    this.pauseEndTime = null;
    this.pauseDurationMs = 15000; // same as TagGame
    this.winnerId = null;
    this.track = {
      width: ARENA_W,
      height: ARENA_H,
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

  init() {
    this.winnerId = null;
    this.state.meta = {
      paused: false,
      reason: "",
      countdown: 0,
    };
  }

  addPlayer(playerId) {
    if (!playerId) return;
    if (this.state.players[playerId]) return;

    const index = Object.keys(this.state.players).length;
    const spawn = SPAWNS[index] || SPAWNS[0];

    this.state.players[playerId] = {
      x: spawn.x,
      y: spawn.y,
      prevX: spawn.x,
      prevY: spawn.y,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      speed: BASE_SPEED,
      lap: 0,
      checkpointIndex: 0, // next required checkpoint index
      finished: false,
      input: {
        left: false,
        right: false,
        up: false,
        down: false,
      },
    };
  }

  handleInput(playerId, input) {
    if (this.state.meta?.paused) return;
    const p = this.state.players[playerId];
    if (!p) return;
    if (!this.isRunning()) return;
    if (!this.room.players[playerId]?.connected) return;

    const { direction, pressed } = input || {};
    if (typeof pressed !== "boolean") return;

    switch (direction) {
      case "left":
      case "right":
      case "up":
      case "down":
        p.input[direction] = pressed;
        break;
      case "up-left":
        p.input.up = pressed;
        p.input.left = pressed;
        break;
      case "up-right":
        p.input.up = pressed;
        p.input.right = pressed;
        break;
      case "down-left":
        p.input.down = pressed;
        p.input.left = pressed;
        break;
      case "down-right":
        p.input.down = pressed;
        p.input.right = pressed;
        break;
      default:
        return;
    }
  }

  update(delta) {
    if (!this.isRunning()) return;
    if (this.winnerId) return;
    const activePlayers = this._getActivePlayers();

    if (activePlayers.length < 2) {
      if (!this.state.meta.paused) {
        this.state.meta.paused = true;
        this.state.meta.reason = "Waiting for at least 2 players";
        this.pauseEndTime = Date.now() + this.pauseDurationMs;
      }

      this.state.meta.countdown = Math.max(0, this.pauseEndTime - Date.now());

      if (Date.now() >= this.pauseEndTime) {
        this.end();

        if (this.room && typeof this.room.resetToLobby === "function") {
          this.room.resetToLobby();
        }

        return;
      }

      return; // 🚨 STOP GAME LOGIC
    }
    this.state.meta.paused = false;
    this.state.meta.reason = "";
    this.state.meta.countdown = 0;
    this.pauseEndTime = null;
    const dt = delta / 1000;
    const activeIds = this._getActivePlayers();

    for (const id of activeIds) {
      const p = this.state.players[id];
      if (!p || p.finished) continue;

      p.prevX = p.x;
      p.prevY = p.y;

      let dx = 0;
      let dy = 0;

      if (p.input.left) dx -= 1;
      if (p.input.right) dx += 1;
      if (p.input.up) dy -= 1;
      if (p.input.down) dy += 1;

      if (dx !== 0 || dy !== 0) {
        const inv = 1 / Math.hypot(dx, dy);
        dx *= inv;
        dy *= inv;
      }

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
  }

  _getActivePlayers() {
    return Object.keys(this.state.players).filter(
      (id) => this.room.players[id]?.connected,
    );
  }

  _isOnRoad(x, y) {
    const outer = this._ellipseNorm(
      x,
      y,
      this.track.road.outer.x,
      this.track.road.outer.y,
      this.track.road.outer.rx,
      this.track.road.outer.ry,
    );

    const inner = this._ellipseNorm(
      x,
      y,
      this.track.road.inner.x,
      this.track.road.inner.y,
      this.track.road.inner.rx,
      this.track.road.inner.ry,
    );

    return outer <= 1 && inner >= 1;
  }

  _ellipseNorm(x, y, cx, cy, rx, ry) {
    const dx = x - cx;
    const dy = y - cy;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  }

  _resolveMovement(x, y) {
    let nx = Math.max(CAR_RADIUS, Math.min(ARENA_W - CAR_RADIUS, x));
    let ny = Math.max(CAR_RADIUS, Math.min(ARENA_H - CAR_RADIUS, y));

    for (const obstacle of OBSTACLES) {
      const dx = nx - obstacle.x;
      const dy = ny - obstacle.y;
      const dist = Math.hypot(dx, dy);
      const minDist = CAR_RADIUS + obstacle.r;

      if (dist > 0 && dist < minDist) {
        const push = minDist - dist;
        nx += (dx / dist) * push;
        ny += (dy / dist) * push;
      }
    }

    nx = Math.max(CAR_RADIUS, Math.min(ARENA_W - CAR_RADIUS, nx));
    ny = Math.max(CAR_RADIUS, Math.min(ARENA_H - CAR_RADIUS, ny));

    return { x: nx, y: ny };
  }

  _updateProgress(playerId, player) {
    // First, see if player crossed the next required checkpoint gate.
    const nextGate = CHECKPOINTS[player.checkpointIndex];
    if (nextGate && this._crossedGate(player, nextGate)) {
      player.checkpointIndex += 1;
    }

    // After all checkpoints are cleared, crossing finish completes the lap.
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
    const isInside = this._pointInRect(player.x, player.y, gate);

    // Ignore just sitting inside a gate.
    if (wasInside && isInside) return false;

    // Simple reliable rule for this game:
    // count when player enters the gate, or crosses from one side to the other.
    if (!wasInside && isInside) return true;

    if (gate.axis === "vertical") {
      const gateMidX = gate.x + gate.width / 2;
      const prevSide = player.prevX < gateMidX ? -1 : 1;
      const currSide = player.x < gateMidX ? -1 : 1;

      if (
        prevSide !== currSide &&
        this._segmentTouchesRect(
          player.prevX,
          player.prevY,
          player.x,
          player.y,
          gate,
        )
      ) {
        return true;
      }
    }

    if (gate.axis === "horizontal") {
      const gateMidY = gate.y + gate.height / 2;
      const prevSide = player.prevY < gateMidY ? -1 : 1;
      const currSide = player.y < gateMidY ? -1 : 1;

      if (
        prevSide !== currSide &&
        this._segmentTouchesRect(
          player.prevX,
          player.prevY,
          player.x,
          player.y,
          gate,
        )
      ) {
        return true;
      }
    }

    return false;
  }

  _pointInRect(x, y, rect) {
    return (
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
    );
  }

  _segmentTouchesRect(x1, y1, x2, y2, rect) {
    // Cheap broad check first.
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    if (
      maxX < rect.x ||
      minX > rect.x + rect.width ||
      maxY < rect.y ||
      minY > rect.y + rect.height
    ) {
      return false;
    }

    // Good enough for this arcade racer: if either point is inside or the segment bbox overlaps,
    // treat it as touched. We do not need perfect geometry here.
    return (
      this._pointInRect(x1, y1, rect) || this._pointInRect(x2, y2, rect) || true
    );
  }

  _endRace() {
    this.end();

    this.room.io.to(this.room.id).emit(EVENTS.RACER.GAME_OVER, {
      winner: this.winnerId,
    });

    setTimeout(() => {
      if (this.room && typeof this.room.resetToLobby === "function") {
        this.room.resetToLobby();
      }
    }, 5000);
  }

  getState() {
    const players = {};

    for (const [id, p] of Object.entries(this.state.players)) {
      if (!this.room.players[id]?.connected) continue;

      players[id] = {
        x: p.x,
        y: p.y,
        prevX: p.prevX,
        prevY: p.prevY,
        vx: p.vx,
        vy: p.vy,
        angle: p.angle,
        speed: p.speed,
        lap: p.lap,
        checkpointIndex: p.checkpointIndex,
        finished: p.finished,
        color: this.room.players[id]?.color,
        name: this.room.players[id]?.name || id,
      };
    }

    return {
      roomId: this.room.id,
      players,
      winner: this.winnerId,
      track: this.track,
      meta: {
        paused: !!this.state.meta?.paused,
        reason: this.state.meta?.reason || "",
        countdown: this.state.meta?.countdown || 0,
      },
    };
  }
}

module.exports = RacerGame;
