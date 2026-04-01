export function preload(scene) {
  scene.load.image(
    "racer-track",
    "src/host/games/racer/assets/racer-track.png",
  );

  scene.load.image(
    "racer-car-red",
    "src/host/games/racer/assets/racer-car-red.png",
  );

  scene.load.image(
    "racer-car-blue",
    "src/host/games/racer/assets/racer-car-blue.png",
  );

  scene.load.image(
    "racer-car-green",
    "src/host/games/racer/assets/racer-car-green.png",
  );

  scene.load.image(
    "racer-car-yellow",
    "src/host/games/racer/assets/racer-car-yellow.png",
  );
}

export function createHostRenderer(scene) {
  const AW = 800;
  const AH = 600;

  scene.cameras.main.setBackgroundColor(0x3b261d);

  let trackImage = null;
  const hud = scene.add.container(0, 0).setDepth(50);

  const overlayBg = scene.add
    .rectangle(AW / 2, AH / 2, 520, 220, 0x000000, 0.72)
    .setVisible(false)
    .setDepth(100);

  const overlayTitle = scene.add
    .text(AW / 2, AH / 2 - 20, "", {
      fontSize: "34px",
      fontStyle: "bold",
      color: "#ffffff",
      fontFamily: "Arial",
    })
    .setOrigin(0.5)
    .setVisible(false)
    .setDepth(101);

  const overlayBody = scene.add
    .text(AW / 2, AH / 2 + 28, "", {
      fontSize: "18px",
      color: "#ffffff",
      fontFamily: "Arial",
      align: "center",
    })
    .setOrigin(0.5)
    .setVisible(false)
    .setDepth(101);

  const pauseBackdrop = scene.add
    .rectangle(400, 300, 520, 180, 0x000000, 0.7)
    .setVisible(false)
    .setDepth(200);

  const pauseTitle = scene.add
    .text(400, 255, "Game Paused", {
      fontSize: "30px",
      color: "#ffcc00",
      fontStyle: "bold",
      fontFamily: "Arial",
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
      fontFamily: "Arial",
    })
    .setOrigin(0.5)
    .setVisible(false)
    .setDepth(201);

  const countdownText = scene.add
    .text(400, 345, "", {
      fontSize: "18px",
      color: "#93c5fd",
      fontFamily: "Arial",
    })
    .setOrigin(0.5)
    .setVisible(false)
    .setDepth(201);

  const cars = {};
  const lapTexts = {};
  const lastAngles = {};
  let currentWinner = null;
  let trackDrawn = false;

  function wrapAngle(angle) {
    while (angle <= -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
  }

  function drawStaticTrack() {
    if (!trackImage) {
      trackImage = scene.add.image(AW / 2, AH / 2, "racer-track").setDepth(0);
      trackImage.setDisplaySize(AW, AH);
    }

    trackDrawn = true;
  }

  function getCarKey(color) {
    const map = {
      "#ff0000": "racer-car-red",
      "#00ff00": "racer-car-green",
      "#0000ff": "racer-car-blue",
      "#ffff00": "racer-car-yellow",
    };

    return map[color?.toLowerCase()] || "racer-car-red";
  }

  function makeCar(scene, color) {
    const key = getCarKey(color);

    return scene.add.image(0, 0, key).setDepth(30).setScale(0.9);
  }

  function getHudPosition(index) {
    const positions = [
      { x: 130, y: 28, align: 0.5 },
      { x: AW - 130, y: 28, align: 0.5 },
      { x: 130, y: AH - 28, align: 0.5 },
      { x: AW - 130, y: AH - 28, align: 0.5 },
    ];

    return positions[index] || positions[0];
  }

  function syncState(state) {
    if (!state) return;

    if (state.track && !trackDrawn) {
      drawStaticTrack();
    }

    const playerEntries = Object.entries(state.players || {});

    playerEntries.forEach(([id, player], index) => {
      if (!cars[id]) {
        cars[id] = makeCar(scene, player.color);
        cars[id].setPosition(player.x, player.y);
      }

      if (!lapTexts[id]) {
        const hudPos = getHudPosition(index);
        lapTexts[id] = scene.add
          .text(hudPos.x, hudPos.y, "", {
            fontSize: "22px",
            fontStyle: "bold",
            color: player.color || "#ffffff",
            fontFamily: "Arial",
            stroke: "#111111",
            strokeThickness: 5,
          })
          .setOrigin(hudPos.align, 0.5)
          .setDepth(60);

        hud.add(lapTexts[id]);
      }

      const car = cars[id];
      car.targetX = player.x;
      car.targetY = player.y;

      if (player.vx !== 0 || player.vy !== 0) {
        lastAngles[id] = player.angle;
      }

      car.targetRotation = (lastAngles[id] ?? player.angle ?? 0) + Math.PI / 2;

      if (lapTexts[id]) {
        lapTexts[id].setText(`${player.name}: ${player.lap}/3`);
      }
    });

    for (const id of Object.keys(cars)) {
      if (!state.players?.[id]) {
        cars[id].destroy();
        delete cars[id];

        if (lapTexts[id]) {
          lapTexts[id].destroy();
          delete lapTexts[id];
        }

        delete lastAngles[id];
      }
    }

    if (state.winner && state.winner !== currentWinner) {
      currentWinner = state.winner;
      const winnerName = state.players?.[state.winner]?.name || "Winner";
      overlayBg.setVisible(true);
      overlayTitle.setText(`🏁 ${winnerName} wins!`).setVisible(true);
      overlayBody.setText("Returning to lobby...").setVisible(true);
    }

    if (!state.winner) {
      currentWinner = null;
      overlayBg.setVisible(false);
      overlayTitle.setVisible(false);
      overlayBody.setVisible(false);
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
    const factor = 1 - Math.exp(-12 * (delta / 1000));

    for (const car of Object.values(cars)) {
      car.x += ((car.targetX ?? car.x) - car.x) * factor;
      car.y += ((car.targetY ?? car.y) - car.y) * factor;

      const targetRotation = car.targetRotation ?? car.rotation;
      const deltaAngle = wrapAngle(targetRotation - car.rotation);
      car.rotation += deltaAngle * factor;
      car.rotation = wrapAngle(car.rotation);
    }
  }

  function destroy() {
    if (trackImage) {
      trackImage.destroy();
      trackImage = null;
    }

    for (const car of Object.values(cars)) {
      car.destroy();
    }

    for (const txt of Object.values(lapTexts)) {
      txt.destroy();
    }

    hud.destroy();
    overlayBg.destroy();
    overlayTitle.destroy();
    overlayBody.destroy();
    pauseBackdrop.destroy();
    pauseTitle.destroy();
    pauseReason.destroy();
    countdownText.destroy();
  }

  return { syncState, update, destroy };
}
