export function createHostRenderer(scene) {
    const players = {}

    function syncState(state) {
        if (!state || !state.players) return

        const serverPlayers = state.players

        // Create or update tracked players
        for (const id in serverPlayers) {
            const data = serverPlayers[id]

            if (!players[id]) {
                const rect = scene.add.rectangle(
                    data.x,
                    data.y,
                    40,
                    40,
                    id === state.tagger ? 0xff0000 : 0x00ff00
                )

                players[id] = {
                    rect,
                    currentX: data.x,
                    currentY: data.y,
                    targetX: data.x,
                    targetY: data.y
                }
            }

            players[id].targetX = data.x
            players[id].targetY = data.y
            players[id].rect.fillColor = id === state.tagger ? 0xff0000 : 0x00ff00
        }

        // Remove players no longer in state
        for (const id in players) {
            if (!serverPlayers[id]) {
                players[id].rect.destroy()
                delete players[id]
            }
        }
    }

    function update(delta) {
        // Frame-rate independent smoothing: ~10 updates/sec convergence regardless of FPS
        // factor = 1 - e^(-k * dt), where k controls how fast we catch up
        const k = 15
        const factor = 1 - Math.exp(-k * (delta / 1000))

        for (const id in players) {
            const p = players[id]

            p.currentX += (p.targetX - p.currentX) * factor
            p.currentY += (p.targetY - p.currentY) * factor

            p.rect.x = p.currentX
            p.rect.y = p.currentY
        }
    }

    function destroy() {
        for (const id in players) {
            players[id].rect.destroy()
            delete players[id]
        }
    }

    return {
        syncState,
        update,
        destroy
    }
}