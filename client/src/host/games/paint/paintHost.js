/**
 * paintHost.js
 * Drop into: client/src/host/games/paintHost.js
 *
 * Phaser host renderer for the Paint Arena game.
 */
import socket from "../../../core/socket.js";
import EVENTS from "../../../shared/events.js";

export function createHostRenderer(scene) {
  const AW = 800;
  const AH = 600;
  const CELL = 20;

  const playerColors = {};

  scene.cameras.main.setBackgroundColor(0xfdf3dc);

  const gridOwner = new Int16Array((AW / CELL) * (AH / CELL)).fill(-1);
  const paintRT = scene.add
    .renderTexture(0, 0, AW, AH)
    .setOrigin(0, 0)
    .setDepth(0);
  const brushStamp = scene.make.graphics({ x: 0, y: 0, add: false });

  function stampCell(col, row, hexColor) {
    const px = col * CELL;
    const py = row * CELL;
    const colorInt = hexToInt(hexColor || "#ffffff");

    const radius = CELL * 0.9;
    brushStamp.clear();
    brushStamp.fillStyle(colorInt, 1);
    brushStamp.fillCircle(0, 0, radius);
    paintRT.draw(brushStamp, px + CELL / 2, py + CELL / 2);
  }

  const players = {};
  const pwObjs = {};
  const rings = {};

  function hexToInt(hex) {
    return parseInt(String(hex).replace("#", ""), 16);
  }

  function makeRoller(scene, colorHex) {
    const g = scene.add.graphics();
    const c = hexToInt(colorHex || "#ffffff");
    const dark = 0x000000;

    // Handle
    g.fillStyle(dark, 1);
    g.fillRect(-4, 6, 8, 30);

    // Roller body (outer black)
    g.fillStyle(dark, 1);
    g.fillRoundedRect(-22, -14, 44, 22, 6);

    // Roller body (coloured fill with stripe effect)
    g.fillStyle(c, 1);
    g.fillRoundedRect(-19, -11, 38, 16, 5);

    // Diagonal stripes
    g.fillStyle(0x000000, 0.25);
    for (let i = -18; i < 19; i += 7) {
      g.fillRect(i, -11, 4, 16);
    }

    // Cap left / right
    g.fillStyle(dark, 1);
    g.fillRect(-22, -14, 4, 22);
    g.fillRect(18, -14, 4, 22);
    return g;
  }

  function makeDropShadow(scene) {
    const s = scene.add.graphics();
    s.fillStyle(0x000000, 0.18);
    s.fillEllipse(0, 12, 34, 10);
    return s;
  }

  function makePowerupIcon(scene, type, x, y) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 0, 18);
    g.lineStyle(3, 0x222222, 1);
    g.strokeCircle(0, 0, 18);

    const emoji = type === "speed" ? "⚡" : type === "size" ? "🖌️" : "❄️";
    const label = scene.add
      .text(0, 0, emoji, { fontSize: "18px" })
      .setOrigin(0.5);

    const container = scene.add.container(x, y, [g, label]).setDepth(30);

    scene.tweens.add({
      targets: container,
      y: y - 8,
      duration: 900,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    return container;
  }

  function buildScoreRing(scene, x, y, color, side) {
    const g = scene.add.graphics();
    const c = hexToInt(color || "#ffffff");

    g.lineStyle(10, 0x222222, 1);
    g.strokeCircle(0, 0, 32);
    g.lineStyle(7, c, 1);
    g.strokeCircle(0, 0, 32);

    g.fillStyle(0x111111, 1);
    g.fillCircle(0, 0, 24);

    const pill = scene.add.graphics();
    pill.fillStyle(0x111111, 1);
    pill.fillRoundedRect(side === "left" ? 24 : -70, -14, 52, 28, 10);

    const scoreText = scene.add
      .text(side === "left" ? 50 : -44, 0, "0", {
        fontSize: "20px",
        fontStyle: "bold",
        color: `#${c.toString(16).padStart(6, "0")}`,
        fontFamily: "Arial",
      })
      .setOrigin(0.5);

    const nameText = scene.add
      .text(0, 0, "?", {
        fontSize: "11px",
        color: "#aaaaaa",
        fontFamily: "Arial",
      })
      .setOrigin(0.5);

    const container = scene.add
      .container(x, y, [g, pill, scoreText, nameText])
      .setDepth(50);

    return { container, scoreText, nameText };
  }

  const ringSlots = {
    positions: [
      { x: 110, y: 38, side: "right" },
      { x: AW - 110, y: 38, side: "left" },
      { x: 110, y: AH - 38, side: "right" },
      { x: AW - 110, y: AH - 38, side: "left" },
    ],
  };

  const timerText = scene.add
    .text(AW / 2, 18, "1:00", {
      fontSize: "26px",
      fontStyle: "bold",
      color: "#333333",
      fontFamily: "Arial",
      stroke: "#ffffff",
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(55);

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

  // Racer-style pause overlay
  const pauseBackdrop = scene.add
    .rectangle(AW / 2, AH / 2, 520, 180, 0x000000, 0.7)
    .setVisible(false)
    .setDepth(200);

  const pauseTitle = scene.add
    .text(AW / 2, AH / 2 - 45, "Game Paused", {
      fontSize: "30px",
      color: "#ffcc00",
      fontStyle: "bold",
      fontFamily: "Arial",
    })
    .setOrigin(0.5)
    .setVisible(false)
    .setDepth(201);

  const pauseReason = scene.add
    .text(AW / 2, AH / 2, "", {
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
    .text(AW / 2, AH / 2 + 45, "", {
      fontSize: "18px",
      color: "#93c5fd",
      fontFamily: "Arial",
    })
    .setOrigin(0.5)
    .setVisible(false)
    .setDepth(201);

  let playerOrder = [];
  let gameOver = false;

  function syncState(state) {
    if (!state) return;

    const {
      players: sp = {},
      paintDelta = [],
      powerups: pw = {},
      scores = {},
      timeLeft = 0,
      cols = AW / CELL,
      cellSize = CELL,
    } = state;

    // New round reset must happen AFTER timeLeft exists
    if (timeLeft > 59000) {
      gameOver = false;
      overlayBg.setVisible(false);
      overlayTitle.setVisible(false);
      overlayBody.setVisible(false);
      overlayBg.setSize(480, 200);
      gridOwner.fill(-1);
      paintRT.clear();
    }

    if (Array.isArray(paintDelta)) {
      for (const [idx, owner] of paintDelta) {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cs = cellSize;

        if (owner === null) {
          const bgG = scene.make.graphics({ add: false });
          bgG.fillStyle(0xfdf3dc, 1);
          bgG.fillRect(-cs / 2, -cs / 2, cs, cs);
          paintRT.draw(bgG, col * cs + cs / 2, row * cs + cs / 2);
          bgG.destroy();
        } else {
          const color = playerColors[owner];
          if (color) {
            stampCell(col, row, color);
          }
        }

        gridOwner[idx] = owner ?? -1;
      }
    }

    for (const [id, data] of Object.entries(sp)) {
      playerColors[id] = data.color || "#ffffff";

      if (!players[id]) {
        if (!playerOrder.includes(id)) playerOrder.push(id);

        const roller = makeRoller(scene, data.color || "#ffffff");
        roller.setDepth(20);

        const shadow = makeDropShadow(scene);
        shadow.setDepth(19);

        const label = scene.add
          .text(0, -32, data.name || id, {
            fontSize: "13px",
            color: "#ffffff",
            fontFamily: "Arial",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(21);

        const tagLabel = scene.add
          .text(0, -46, "🖌️", { fontSize: "14px" })
          .setOrigin(0.5)
          .setDepth(22)
          .setVisible(false);

        players[id] = {
          roller,
          shadow,
          label,
          tagLabel,
          currentX: data.x,
          currentY: data.y,
          targetX: data.x,
          targetY: data.y,
        };

        const slotIdx = playerOrder.indexOf(id);
        const slot = ringSlots.positions[slotIdx] || {
          x: 110,
          y: 38,
          side: "right",
        };

        rings[id] = buildScoreRing(
          scene,
          slot.x,
          slot.y,
          data.color || "#ffffff",
          slot.side,
        );
      }

      const obj = players[id];
      obj.targetX = data.x;
      obj.targetY = data.y;

      if (data.vx !== 0 || data.vy !== 0) {
        obj.roller.setAngle(
          Math.atan2(data.vy, data.vx) * (180 / Math.PI) + 90,
        );
      }

      obj.roller.setAlpha(data.frozen ? 0.45 : 1);
      obj.label.setText(data.name || id);
      obj.roller.setScale((data.radius || 14) / 14);
    }

    for (const id of Object.keys(players)) {
      if (!sp[id]) {
        players[id].roller.destroy();
        players[id].shadow.destroy();
        players[id].label.destroy();
        players[id].tagLabel.destroy();
        delete players[id];
        delete playerColors[id];

        if (rings[id]) {
          rings[id].container.destroy();
          delete rings[id];
        }
      }
    }

    for (const [id, s] of Object.entries(scores)) {
      if (rings[id]) {
        rings[id].scoreText.setText(`${s.pct}%`);
        rings[id].nameText.setText(s.name || id);
      }
    }

    if (typeof timeLeft === "number") {
      const secs = Math.ceil(timeLeft / 1000);
      const mm = Math.floor(secs / 60);
      const ss = String(secs % 60).padStart(2, "0");
      timerText.setText(`${mm}:${ss}`);
      timerText.setColor(secs <= 10 ? "#ef4444" : "#333333");
    }

    for (const [pwId, data] of Object.entries(pw)) {
      if (!pwObjs[pwId]) {
        pwObjs[pwId] = makePowerupIcon(scene, data.type, data.x, data.y);
      }
    }

    for (const pwId of Object.keys(pwObjs)) {
      if (!pw[pwId]) {
        pwObjs[pwId].destroy();
        delete pwObjs[pwId];
      }
    }

    if (!gameOver) {
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
        `Returning to lobby in ${state.meta.reconnectCountdown ?? 0}s`,
      );
    } else {
      pauseBackdrop.setVisible(false);
      pauseTitle.setVisible(false);
      pauseReason.setVisible(false);
      countdownText.setVisible(false);
    }
  }

  function onGameOver(data) {
    gameOver = true;
    const { winner, scores: finalScores, total } = data;

    let lines = "";
    const sorted = Object.entries(finalScores).sort((a, b) => b[1] - a[1]);

    for (const [id, count] of sorted) {
      const pct = Math.round((count / total) * 100);
      const name = players[id]?.label?.text || id;
      lines += `${name}: ${pct}%\n`;
    }

    const winName = winner ? players[winner]?.label?.text || winner : "Nobody";

    overlayBg.setSize(520, 260).setVisible(true);
    overlayTitle.setText(`🏆 ${winName} wins!`).setVisible(true);
    overlayBody.setText(lines.trim()).setVisible(true);
  }

  function handleGameOver(data) {
    onGameOver(data);
  }

  socket.on(EVENTS.PAINT.GAME_OVER, handleGameOver);

  function update(delta) {
    const k = 14;
    const factor = 1 - Math.exp(-k * (delta / 1000));

    for (const id of Object.keys(players)) {
      const obj = players[id];

      obj.currentX += (obj.targetX - obj.currentX) * factor;
      obj.currentY += (obj.targetY - obj.currentY) * factor;

      obj.shadow.setPosition(obj.currentX, obj.currentY);
      obj.roller.setPosition(obj.currentX, obj.currentY);
      obj.label.setPosition(obj.currentX, obj.currentY - 32);
      obj.tagLabel.setPosition(obj.currentX, obj.currentY - 48);
    }
  }

  function destroy() {
    socket.off(EVENTS.PAINT.GAME_OVER, handleGameOver);

    paintRT.destroy();
    brushStamp.destroy();

    for (const obj of Object.values(players)) {
      obj.roller.destroy();
      obj.shadow.destroy();
      obj.label.destroy();
      obj.tagLabel.destroy();
    }

    for (const c of Object.values(pwObjs)) c.destroy();
    for (const r of Object.values(rings)) r.container.destroy();

    overlayBg.destroy();
    overlayTitle.destroy();
    overlayBody.destroy();
    timerText.destroy();
    pauseBackdrop.destroy();
    pauseTitle.destroy();
    pauseReason.destroy();
    countdownText.destroy();
  }

  return { syncState, update, destroy };
}
