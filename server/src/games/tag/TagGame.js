const BaseGame = require("../base/BaseGame")

class TagGame extends BaseGame {
    init() {
        // Reset state (do NOT call start() here — Room.loadGame() calls start() after init())
        this.state = {
            players: {},
            tagger: null
        }

        const playerIds = Object.keys(this.room.players)

        playerIds.forEach((id, index) => {
            this.state.players[id] = {
                x: 100 + index * 50,
                y: 100,
                vx: 0,
                vy: 0,
                speed: 200,
                lastInputTime: 0
            }
        })

        this.state.tagger = playerIds.length > 0 ? playerIds[0] : null
    }

    handleInput(playerId, input) {
        const player = this.state.players[playerId]
        if (!player) return
        if (!this.isRunning()) return

        const { direction, pressed } = input

        if (typeof pressed !== "boolean") return

        if (pressed) {
            switch (direction) {
                case "left":
                    player.vx = -1
                    player.vy = 0
                    break
                case "right":
                    player.vx = 1
                    player.vy = 0
                    break
                case "up":
                    player.vx = 0
                    player.vy = -1
                    break
                case "down":
                    player.vx = 0
                    player.vy = 1
                    break
                default:
                    return
            }
        } else {
            switch (direction) {
                case "left":
                    if (player.vx < 0) player.vx = 0
                    break
                case "right":
                    if (player.vx > 0) player.vx = 0
                    break
                case "up":
                    if (player.vy < 0) player.vy = 0
                    break
                case "down":
                    if (player.vy > 0) player.vy = 0
                    break
                default:
                    return
            }
        }
    }

    update(delta) {
        if (!this.isRunning()) return

        const dt = delta / 1000

        for (const id in this.state.players) {
            const p = this.state.players[id]
            if (!p) continue

            p.x += p.vx * p.speed * dt
            p.y += p.vy * p.speed * dt

            this.clampPosition(p)
        }

        if (!this.state.tagger) return

        const tagger = this.state.players[this.state.tagger]
        if (!tagger) return

        for (const id in this.state.players) {
            if (id === this.state.tagger) continue

            const p = this.state.players[id]
            if (!p) continue

            const dist = Math.hypot(p.x - tagger.x, p.y - tagger.y)

            if (dist < 30) {
                this.state.tagger = id
                break
            }
        }
    }

    removePlayer(playerId) {
        if (!this.state) return

        super.removePlayer(playerId)

        if (this.state.tagger === playerId) {
            const remaining = Object.keys(this.state.players)
            this.state.tagger = remaining.length > 0 ? remaining[0] : null
        }
    }
}

module.exports = TagGame