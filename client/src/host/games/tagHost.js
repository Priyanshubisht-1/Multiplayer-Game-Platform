export function createHostRenderer(scene) {
  const players = {};

  const roomText = scene.add
    .text(16, 12, "Room:", {
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold",
    })
    .setDepth(100);

  const pauseBackdrop = scene.add
    .rectangle(400, 300, 520, 180, 0x000000, 0.7)
    .setVisible(false)
    .setDepth(200);

  const pauseTitle = scene.add
    .text(400, 255, "Game Paused", {
      fontSize: "30px",
      color: "#ffcc00",
      fontStyle: "bold",
    })
    .setOrigin(0.5)
    .setVisible(false)
    .setDepth(201);

  const pauseReason = scene.add
    .text(400, 300, "", {
      fontSize: "20px",
      color: "#ffffff",
      align: "center",
      wordWrap: { width: 420 },
    })
    .setOrigin(0.5)
    .setVisible(false)
    .setDepth(201);

  const countdownText = scene.add
    .text(400, 345, "", {
      fontSize: "18px",
      color: "#93c5fd",
    })
    .setOrigin(0.5)
    .setVisible(false)
    .setDepth(201);

  function syncState(state) {
    if (!state || !state.players) return;

    roomText.setText(`Room: ${state.roomId || ""}`);

    const serverPlayers = state.players;

    for (const id in serverPlayers) {
      const data = serverPlayers[id];

      if (!players[id]) {
        const colorHex = Phaser.Display.Color.HexStringToColor(
          data.color || "#ffffff",
        ).color;

        const rect = scene.add.rectangle(data.x, data.y, 40, 40, colorHex);

        players[id] = {
          rect,
          currentX: data.x,
          currentY: data.y,
          targetX: data.x,
          targetY: data.y,
        };
      }

      players[id].targetX = data.x;
      players[id].targetY = data.y;
      const colorHex = Phaser.Display.Color.HexStringToColor(
        data.color || "#ffffff",
      ).color;
      players[id].rect.fillColor = colorHex;
    }

    // remove disconnected / invisible players from host screen
    for (const id in players) {
      if (!serverPlayers[id]) {
        players[id].rect.destroy();
        delete players[id];
      }
    }

    if (state.meta?.paused) {
      pauseBackdrop.setVisible(true);
      pauseTitle.setVisible(true);
      pauseReason.setVisible(true);
      countdownText.setVisible(true);

      pauseReason.setText(state.meta.reason || "Paused");
      countdownText.setText(
        `Returning to lobby in ${Math.ceil((state.meta.countdown || 0) / 1000)}s`,
      );
    } else {
      pauseBackdrop.setVisible(false);
      pauseTitle.setVisible(false);
      pauseReason.setVisible(false);
      countdownText.setVisible(false);
    }
  }

  function update(delta) {
    const k = 15;
    const factor = 1 - Math.exp(-k * (delta / 1000));

    for (const id in players) {
      const p = players[id];

      p.currentX += (p.targetX - p.currentX) * factor;
      p.currentY += (p.targetY - p.currentY) * factor;

      p.rect.x = p.currentX;
      p.rect.y = p.currentY;
    }
  }

  function destroy() {
    for (const id in players) {
      players[id].rect.destroy();
      delete players[id];
    }

    roomText.destroy();
    pauseBackdrop.destroy();
    pauseTitle.destroy();
    pauseReason.destroy();
    countdownText.destroy();
  }

  return {
    syncState,
    update,
    destroy,
  };
}
