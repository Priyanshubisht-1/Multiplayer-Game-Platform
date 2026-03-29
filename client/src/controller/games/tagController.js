import socket from "../../core/socket.js";
import EVENTS from "../../shared/events.js";

let currentDirection = null;
let activePointerId = null;
let joystickBase = null;
let joystickThumb = null;
let releaseHandlersBound = false;

const DIRECTIONS = [
  "left",
  "right",
  "up",
  "down",
  "up-left",
  "up-right",
  "down-left",
  "down-right",
];

export function mountController() {
  const app = document.getElementById("app");
  if (!app) return;

  const playerColor = getPlayerColor();

  app.innerHTML = `
    <div class="tag-controller-shell" style="--player-color: ${escapeHtml(playerColor)};">
      <div class="tag-controller-card">
        <div class="tag-controller-header">
          <h2>Tag Controller</h2>
          <p>Drag the joystick to move</p>
        </div>

        <div class="joystick-wrap">
          <div id="joystick-base" class="joystick-base">
            <div id="joystick-thumb" class="joystick-thumb"></div>
          </div>
        </div>

        <div class="tag-controller-status">
          <span id="direction-label">Direction: Idle</span>
        </div>
      </div>
    </div>
  `;

  mountStyles();
  setupJoystick();
  bindGlobalReleaseHandlers();
}

function getPlayerColor() {
  return localStorage.getItem("playerColor") || "#3b82f6";
}

function setupJoystick() {
  joystickBase = document.getElementById("joystick-base");
  joystickThumb = document.getElementById("joystick-thumb");

  if (!joystickBase || !joystickThumb) return;

  resetThumb();

  joystickBase.addEventListener("pointerdown", onPointerDown);
  joystickBase.addEventListener("pointermove", onPointerMove);
  joystickBase.addEventListener("pointerup", onPointerUp);
  joystickBase.addEventListener("pointercancel", onPointerUp);
  joystickBase.addEventListener("lostpointercapture", onPointerUp);
}

function onPointerDown(e) {
  if (!joystickBase) return;
  if (activePointerId !== null) return;

  e.preventDefault();

  activePointerId = e.pointerId;
  joystickBase.setPointerCapture(e.pointerId);

  updateFromPointerEvent(e);
}

function onPointerMove(e) {
  if (activePointerId !== e.pointerId) return;

  e.preventDefault();
  updateFromPointerEvent(e);
}

function onPointerUp(e) {
  if (activePointerId !== e.pointerId) return;

  e.preventDefault();

  releaseCurrentDirection();
  resetThumb();

  if (joystickBase?.hasPointerCapture?.(e.pointerId)) {
    joystickBase.releasePointerCapture(e.pointerId);
  }

  activePointerId = null;
}

function updateFromPointerEvent(e) {
  if (!joystickBase || !joystickThumb) return;

  const rect = joystickBase.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const maxDistance = rect.width / 2 - 28;

  let dx = e.clientX - rect.left - centerX;
  let dy = e.clientY - rect.top - centerY;

  const distance = Math.hypot(dx, dy);

  if (distance > maxDistance) {
    const scale = maxDistance / distance;
    dx *= scale;
    dy *= scale;
  }

  joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;

  const nextDirection = getDigitalDirection(dx, dy, 18);
  setDirection(nextDirection);
}

function getDigitalDirection(dx, dy, deadZone = 18) {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX < deadZone && absY < deadZone) {
    return null;
  }

  if (dx < -deadZone && dy < -deadZone) return "up-left";
  if (dx > deadZone && dy < -deadZone) return "up-right";
  if (dx < -deadZone && dy > deadZone) return "down-left";
  if (dx > deadZone && dy > deadZone) return "down-right";

  if (absX > absY) {
    return dx < 0 ? "left" : "right";
  }

  return dy < 0 ? "up" : "down";
}

function setDirection(nextDirection) {
  if (currentDirection === nextDirection) return;

  if (currentDirection) {
    emitMove(currentDirection, false);
  }

  currentDirection = nextDirection;

  if (currentDirection) {
    emitMove(currentDirection, true);
  }

  updateDirectionLabel(currentDirection);
}

function releaseCurrentDirection() {
  if (!currentDirection) {
    updateDirectionLabel(null);
    return;
  }

  emitMove(currentDirection, false);
  currentDirection = null;
  updateDirectionLabel(null);
}

function emitMove(direction, pressed) {
  socket.emit(EVENTS.INPUT.MOVE, {
    direction,
    pressed,
  });
}

function stopAllMovement() {
  DIRECTIONS.forEach((dir) => {
    emitMove(dir, false);
  });

  currentDirection = null;
  activePointerId = null;
  resetThumb();
  updateDirectionLabel(null);
}

function resetThumb() {
  if (!joystickThumb) return;
  joystickThumb.style.transform = "translate(0px, 0px)";
}

function updateDirectionLabel(direction) {
  const label = document.getElementById("direction-label");
  if (!label) return;

  label.textContent = `Direction: ${direction ? capitalize(direction) : "Idle"}`;
}

function bindGlobalReleaseHandlers() {
  if (releaseHandlersBound) return;

  window.addEventListener("blur", stopAllMovement);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAllMovement();
    }
  });

  window.addEventListener("pagehide", stopAllMovement);

  releaseHandlersBound = true;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function mountStyles() {
  if (document.getElementById("tag-joystick-styles")) return;

  const style = document.createElement("style");
  style.id = "tag-joystick-styles";
  style.textContent = `
    .tag-controller-shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      touch-action: none;
      font-family: Arial, sans-serif;
      color: #f8fafc;
    }

    .tag-controller-card {
      width: 100%;
      max-width: 420px;
      background: rgba(15, 23, 42, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
      backdrop-filter: blur(10px);
      text-align: center;
    }

    .tag-controller-header h2 {
      margin: 0 0 8px;
      font-size: 1.8rem;
    }

    .tag-controller-header p {
      margin: 0;
      color: #cbd5e1;
      font-size: 0.98rem;
    }

    .joystick-wrap {
      margin-top: 28px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .joystick-base {
      width: 240px;
      height: 240px;
      border-radius: 50%;
      position: relative;
      background:
        radial-gradient(circle at center, color-mix(in srgb, var(--player-color) 22%, transparent), rgba(15, 23, 42, 0.85));
      border: 2px solid color-mix(in srgb, var(--player-color) 55%, white 10%);
      box-shadow:
        inset 0 0 24px rgba(255, 255, 255, 0.06),
        0 10px 24px rgba(0, 0, 0, 0.25);
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .joystick-base::before,
    .joystick-base::after {
      content: "";
      position: absolute;
      background: rgba(255, 255, 255, 0.08);
      pointer-events: none;
    }

    .joystick-base::before {
      width: 2px;
      height: 70%;
      left: 50%;
      top: 15%;
      transform: translateX(-50%);
    }

    .joystick-base::after {
      height: 2px;
      width: 70%;
      top: 50%;
      left: 15%;
      transform: translateY(-50%);
    }

    .joystick-thumb {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-0px, -0px);
      margin-left: -36px;
      margin-top: -36px;
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--player-color) 80%, white 20%),
        var(--player-color)
      );
      box-shadow:
        0 8px 20px rgba(0, 0, 0, 0.32),
        inset 0 2px 8px rgba(255, 255, 255, 0.18);
      border: 2px solid rgba(255, 255, 255, 0.18);
      pointer-events: none;
      transition: transform 0.04s linear;
    }

    .tag-controller-status {
      margin-top: 24px;
      font-size: 1rem;
      font-weight: 700;
      color: color-mix(in srgb, var(--player-color) 70%, white 30%);
    }

    @media (max-width: 480px) {
      .tag-controller-card {
        padding: 18px;
        border-radius: 20px;
      }

      .joystick-base {
        width: 210px;
        height: 210px;
      }

      .joystick-thumb {
        width: 64px;
        height: 64px;
        margin-left: -32px;
        margin-top: -32px;
      }
    }
  `;

  document.head.appendChild(style);
}
