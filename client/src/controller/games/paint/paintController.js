/**
 * paintController.js
 * client/src/controller/games/paint/paintController.js
 *
 * Full-analog joystick controller for the Paint Arena game.
 * Sends { dx, dy } floats (−1..1) so the server gets true analog direction.
 * Game-over overlay removed — results are shown on the host screen only.
 */

import socket from "../../../core/socket.js";
import EVENTS from "../../../shared/events.js";

let activePointerId      = null;
let joystickBase         = null;
let joystickThumb        = null;
let releaseHandlersBound = false;
let gameOverHandlerBound = false;

export function mountController() {
  const app = document.getElementById("app");
  if (!app) return;

  activePointerId = null;

  const playerColor = localStorage.getItem("playerColor") || "#ef4444";
  const playerName  = localStorage.getItem("playerName")  || "Player";

  app.innerHTML = `
    <div class="paint-ctrl-shell" style="--player-color:${escHtml(playerColor)};">
      <div class="paint-ctrl-card">

        <div class="paint-ctrl-header">
          <div class="paint-ctrl-avatar">${escHtml(playerName.charAt(0).toUpperCase())}</div>
          <div class="paint-ctrl-title-wrap">
            <h2 class="paint-ctrl-name">${escHtml(playerName)}</h2>
            <p class="paint-ctrl-hint">Drag to paint the arena</p>
          </div>
        </div>

        <div class="paint-ctrl-joystick-wrap">
          <div id="paint-joystick-base" class="paint-joystick-base">
            <div id="paint-joystick-thumb" class="paint-joystick-thumb"></div>
          </div>
        </div>

        <div class="paint-ctrl-status">
          <span id="paint-dir-label">🎨 Idle</span>
        </div>

      </div>
    </div>
  `;

  mountStyles();
  setupJoystick();
  bindReleaseHandlers();
  bindGameOverHandler();
}

// ── Joystick ──────────────────────────────────────────────────────────────────

function setupJoystick() {
  joystickBase  = document.getElementById("paint-joystick-base");
  joystickThumb = document.getElementById("paint-joystick-thumb");
  if (!joystickBase || !joystickThumb) return;

  resetThumb();

  joystickBase.addEventListener("pointerdown",        onPointerDown);
  joystickBase.addEventListener("pointermove",        onPointerMove);
  joystickBase.addEventListener("pointerup",          onPointerUp);
  joystickBase.addEventListener("pointercancel",      onPointerUp);
  joystickBase.addEventListener("lostpointercapture", onPointerUp);
}

function onPointerDown(e) {
  if (activePointerId !== null) return;
  e.preventDefault();
  activePointerId = e.pointerId;
  joystickBase.setPointerCapture(e.pointerId);
  updateFromEvent(e);
}

function onPointerMove(e) {
  if (activePointerId !== e.pointerId) return;
  e.preventDefault();
  updateFromEvent(e);
}

function onPointerUp(e) {
  if (activePointerId !== e.pointerId) return;
  e.preventDefault();
  stop();
  if (joystickBase?.hasPointerCapture?.(e.pointerId)) {
    joystickBase.releasePointerCapture(e.pointerId);
  }
  activePointerId = null;
}

function updateFromEvent(e) {
  const rect = joystickBase.getBoundingClientRect();
  const cx   = rect.width  / 2;
  const cy   = rect.height / 2;
  const maxD = rect.width  / 2 - 28;

  let dx = e.clientX - rect.left - cx;
  let dy = e.clientY - rect.top  - cy;

  const dist = Math.hypot(dx, dy);

  // Thumb visual — clamped
  const clampedDist = Math.min(dist, maxD);
  const norm = dist > 0 ? 1 / dist : 0;
  joystickThumb.style.transform =
    `translate(${dx * norm * clampedDist}px, ${dy * norm * clampedDist}px)`;

  // Dead zone + linear scale to axis value
  const DEAD = 12;
  if (dist < DEAD) {
    sendAnalog(0, 0);
    updateLabel(0, 0);
    return;
  }

  const effective = Math.min(dist, maxD);
  const scale     = (effective - DEAD) / (maxD - DEAD);
  sendAnalog((dx / dist) * scale, (dy / dist) * scale);
  updateLabel((dx / dist) * scale, (dy / dist) * scale);
}

function sendAnalog(dx, dy) {
  socket.emit(EVENTS.INPUT.MOVE, { dx, dy });
}

function stop() {
  resetThumb();
  sendAnalog(0, 0);
  updateLabel(0, 0);
}

function stopAll() {
  stop();
  activePointerId = null;
}

function resetThumb() {
  if (joystickThumb) joystickThumb.style.transform = "translate(0px,0px)";
}

function updateLabel(dx, dy) {
  const el = document.getElementById("paint-dir-label");
  if (!el) return;
  const mag = Math.hypot(dx, dy);
  if (mag < 0.05) { el.textContent = "🎨 Idle"; return; }

  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const dirs  = ["→","↘","↓","↙","←","↖","↑","↗"];
  const idx   = Math.round(((angle + 360) % 360) / 45) % 8;
  el.textContent = `${dirs[idx]} ${Math.round(mag * 100)}%`;
}

// ── Global release handlers ───────────────────────────────────────────────────

function bindReleaseHandlers() {
  if (releaseHandlersBound) return;
  window.addEventListener("blur", stopAll);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopAll(); });
  window.addEventListener("pagehide", stopAll);
  releaseHandlersBound = true;
}

// ── Game-over: just stop joystick, no overlay on controller ──────────────────

function bindGameOverHandler() {
  if (gameOverHandlerBound) return;
  socket.on(EVENTS.PAINT.GAME_OVER, () => { stopAll(); });
  gameOverHandlerBound = true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(v) {
  return String(v)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

// ── Styles ────────────────────────────────────────────────────────────────────

function mountStyles() {
  if (document.getElementById("paint-ctrl-styles")) return;

  const s = document.createElement("style");
  s.id = "paint-ctrl-styles";
  s.textContent = `
    .paint-ctrl-shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      touch-action: none;
      font-family: Arial, sans-serif;
      color: #f8fafc;
    }

    .paint-ctrl-card {
      position: relative;
      width: 100%;
      max-width: 420px;
      background: rgba(15, 23, 42, 0.82);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px;
      padding: 22px 22px 28px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.35);
      backdrop-filter: blur(12px);
      text-align: center;
      overflow: hidden;
    }

    .paint-ctrl-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 24px;
      text-align: left;
    }

    .paint-ctrl-avatar {
      width: 52px; height: 52px;
      border-radius: 50%;
      background: var(--player-color, #ef4444);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem; font-weight: 900; color: #fff;
      flex-shrink: 0;
      box-shadow: 0 0 0 4px rgba(255,255,255,0.1);
    }

    .paint-ctrl-name  { margin: 0 0 4px; font-size: 1.25rem; font-weight: 800; }
    .paint-ctrl-hint  { margin: 0; color: #94a3b8; font-size: 0.88rem; }

    .paint-ctrl-joystick-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 4px 0 22px;
    }

    .paint-joystick-base {
      width: 230px; height: 230px;
      border-radius: 50%;
      position: relative;
      background: radial-gradient(
        circle at center,
        color-mix(in srgb, var(--player-color) 24%, transparent),
        rgba(10,18,36,0.9)
      );
      border: 2px solid color-mix(in srgb, var(--player-color) 55%, white 10%);
      box-shadow:
        inset 0 0 28px rgba(255,255,255,0.05),
        0 10px 28px rgba(0,0,0,0.28);
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .paint-joystick-base::before {
      content: ""; position: absolute;
      width: 2px; height: 70%; left: 50%; top: 15%;
      transform: translateX(-50%);
      background: rgba(255,255,255,0.07);
      pointer-events: none;
    }
    .paint-joystick-base::after {
      content: ""; position: absolute;
      height: 2px; width: 70%; top: 50%; left: 15%;
      transform: translateY(-50%);
      background: rgba(255,255,255,0.07);
      pointer-events: none;
    }

    .paint-joystick-thumb {
      width: 70px; height: 70px;
      border-radius: 50%;
      position: absolute;
      left: 50%; top: 50%;
      margin-left: -35px; margin-top: -35px;
      background: linear-gradient(135deg,
        color-mix(in srgb, var(--player-color) 80%, white 20%),
        var(--player-color)
      );
      box-shadow: 0 8px 22px rgba(0,0,0,0.35), inset 0 2px 8px rgba(255,255,255,0.18);
      border: 2px solid rgba(255,255,255,0.18);
      pointer-events: none;
      transition: transform 0.04s linear;
      background-image: repeating-linear-gradient(
        45deg,
        rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 3px,
        transparent 3px, transparent 9px
      );
    }

    .paint-ctrl-status {
      margin-top: 6px;
      font-size: 1rem; font-weight: 700;
      color: color-mix(in srgb, var(--player-color) 70%, white 30%);
      min-height: 26px;
    }

    @media (max-width: 480px) {
      .paint-ctrl-card        { padding: 16px 16px 22px; border-radius: 20px; }
      .paint-joystick-base    { width: 200px; height: 200px; }
      .paint-joystick-thumb   { width: 60px; height: 60px; margin-left:-30px; margin-top:-30px; }
    }
  `;
  document.head.appendChild(s);
}
