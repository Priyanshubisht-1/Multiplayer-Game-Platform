const BaseGame = require("../base/BaseGame");

class TagGame extends BaseGame {
  constructor(room) {
    super(room);
    this.pauseEndTime = null;
    this.pauseDurationMs = 15000;
  }

  init() {
    this.state = {
      players: {},
      tagger: null,
      meta: {
        paused: false,
        reason: "",
        countdown: 0,
      },
    };

    const playerIds = Object.keys(this.room.players);

    playerIds.forEach((id, index) => {
      this.state.players[id] = {
        x: 100 + index * 50,
        y: 100,
        vx: 0,
        vy: 0,
        speed: 200,
        lastInputTime: 0,
        input: {
          left: false,
          right: false,
          up: false,
          down: false,
        },
      };
    });

    this.state.tagger = playerIds.length > 0 ? playerIds[0] : null;
  }

  handleInput(playerId, input) {
    const player = this.state.players[playerId];
    if (!player) return;
    if (!this.isRunning()) return;
    if (this.state.meta?.paused) return;
    if (!this.room.players[playerId]?.connected) return;

    const { direction, pressed } = input;

    if (typeof pressed !== "boolean") return;

    switch (direction) {
      case "left":
      case "right":
      case "up":
      case "down":
        player.input[direction] = pressed;
        break;

      case "up-left":
        player.input.up = pressed;
        player.input.left = pressed;
        break;

      case "up-right":
        player.input.up = pressed;
        player.input.right = pressed;
        break;

      case "down-left":
        player.input.down = pressed;
        player.input.left = pressed;
        break;

      case "down-right":
        player.input.down = pressed;
        player.input.right = pressed;
        break;

      default:
        return;
    }

    player.lastInputTime = Date.now();
  }

  update(delta) {
    if (!this.isRunning()) return;

    const activePlayers = this.getActivePlayerIds();

    if (activePlayers.length < 2) {
      if (!this.state.meta.paused) {
        this.state.meta.paused = true;
        this.state.meta.reason = "Waiting for at least 2 connected controllers";
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

      return;
    }

    this.state.meta.paused = false;
    this.state.meta.reason = "";
    this.state.meta.countdown = 0;
    this.pauseEndTime = null;

    if (!activePlayers.includes(this.state.tagger)) {
      this.state.tagger = activePlayers.length > 0 ? activePlayers[0] : null;
    }

    const dt = delta / 1000;

    for (const id of activePlayers) {
      const p = this.state.players[id];
      if (!p) continue;

      let vx = 0;
      let vy = 0;

      if (p.input.left) vx -= 1;
      if (p.input.right) vx += 1;
      if (p.input.up) vy -= 1;
      if (p.input.down) vy += 1;

      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy);
        vx /= len;
        vy /= len;
      }

      p.vx = vx;
      p.vy = vy;

      p.x += p.vx * p.speed * dt;
      p.y += p.vy * p.speed * dt;

      this.clampPosition(p);
    }

    if (!this.state.tagger) return;

    const tagger = this.state.players[this.state.tagger];
    if (!tagger) return;

    for (const id of activePlayers) {
      if (id === this.state.tagger) continue;

      const p = this.state.players[id];
      if (!p) continue;

      const dist = Math.hypot(p.x - tagger.x, p.y - tagger.y);

      if (dist < 30) {
        this.state.tagger = id;
        break;
      }
    }
  }

  removePlayer(playerId) {
    if (!this.state) return;

    super.removePlayer(playerId);

    if (this.state.tagger === playerId) {
      const remaining = this.getActivePlayerIds();
      this.state.tagger = remaining.length > 0 ? remaining[0] : null;
    }
  }

  getActivePlayerIds() {
    return Object.keys(this.state.players).filter(
      (id) => this.room.players[id]?.connected,
    );
  }

  getState() {
    const visiblePlayers = {};

    for (const id of Object.keys(this.state.players)) {
      if (!this.room.players[id]?.connected) continue;

      visiblePlayers[id] = {
        ...this.state.players[id],
        name: this.room.players[id]?.name || id,
        color: this.room.players[id]?.color || "#3b82f6",
      };
    }

    return {
      roomId: this.room.id,
      players: visiblePlayers,
      tagger: this.state.tagger,
      meta: {
        paused: !!this.state.meta?.paused,
        reason: this.state.meta?.reason || "",
        countdown: this.state.meta?.countdown || 0,
      },
    };
  }
}

module.exports = TagGame;
