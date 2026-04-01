# WebSocket-Based Modular Multiplayer Game Platform

A browser-based multiplayer game platform where one device acts as the game host (displayed on a screen) and other devices act as controllers (phones, tablets). Games run in real time over WebSockets.

---

## How It Works

- The **host** opens the app in a browser, creates a room, selects a game, and starts it. The game renders in a Phaser canvas.
- **Controllers** open the app on their own device, join the room with the room code, and get a touch-friendly input UI.
- The **server** runs the authoritative game loop at 60 TPS and broadcasts state to all clients.

```
Phone (controller) ──┐
Phone (controller) ──┼──► Server (Node.js + Socket.IO) ──► Host (Phaser display)
Phone (controller) ──┘
```

---

## Project Structure

```
/
├── client/                        # Frontend (Vite)
│   ├── index.html
│   └── src/
│       ├── main.js                # Entry point — mode routing (host / controller)
│       ├── core/
│       │   └── socket.js          # Socket.IO client singleton
│       ├── shared/
│       │   ├── events.js          # Shared event name constants
│       │   └── games.js           # Game registry (id + display name)
│       ├── lobby/
│       │   ├── CreateRoom.js      # Host room creation flow
│       │   ├── JoinRoom.js        # Controller join flow
│       │   └── renderLobby.js     # Lobby UI (player list, game selection)
│       ├── host/
│       │   ├── index.js           # Mounts Phaser game instance
│       │   ├── HostLoader.js      # Dynamic import of per-game host renderers
│       │   ├── game/
│       │   │   ├── GameManager.js # Coordinates scene ↔ game renderer lifecycle
│       │   │   └── scenes/
│       │   │       └── MainScene.js  # Phaser scene — delegates to host renderer
│       │   └── games/
│       │       └── tagHost.js     # Tag game renderer (Phaser objects + interpolation)
│       └── controller/
│           ├── index.js
│           ├── ControllerLoader.js  # Dynamic import of per-game controller UIs
│           └── games/
│               ├── tagController.js  # D-pad buttons with pointer capture
│               └── carController.js  # Accelerate / brake / steer buttons
│
└── server/                        # Backend (Node.js)
    └── src/
        ├── index.js               # HTTP server + Socket.IO setup
        ├── shared/
        │   ├── events.js          # Shared event name constants (mirrors client)
        │   └── games.js           # Available game list
        ├── core/
        │   ├── RoomManager.js     # Creates / destroys rooms, tracks player→room map
        │   └── GameLoader.js      # Dynamically loads game class by name
        ├── rooms/
        │   └── Room.js            # Room state: host, players, active game
        ├── loop/
        │   └── GameLoop.js        # setInterval loop — ticks all active rooms at 60 TPS
        ├── games/
        │   ├── base/
        │   │   └── BaseGame.js    # Abstract base: state, lifecycle, utilities
        │   └── tag/
        │       ├── TagGame.js     # Tag game logic (movement, collision, tagger swap)
        │       └── events.js      # Tag-specific event constants
        └── sockets/
            ├── connection.js      # Authenticates socket, wires handlers
            ├── roomHandler.js     # room:create / room:join / room:leave
            ├── gameHandler.js     # game:select / game:start
            └── controllerHandler.js  # input:move / input:action → room.handleInput()
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### 1. Start the server

```bash
cd server
npm install
npm run dev
```

The server listens on port `3000` by default. Set a different port with the `PORT` environment variable:

```bash
PORT=4000 npm run dev
```

### 2. Configure the client

Open `client/src/core/socket.js` and set the server address to your machine's local IP:

```js
const socket = io("http://192.168.1.X:3000", { ... })
```

Use your actual LAN IP (not `localhost`) so phones on the same Wi-Fi can connect.

### 3. Start the client

```bash
cd client
npm install
npm run dev
```

Vite will print a local URL (e.g. `http://localhost:5173`) and a network URL for other devices.

---

## Usage

### Host

Open the app with `?mode=host`:

```
http://<your-ip>:5173/?mode=host
```

1. Click **Create Room** — a room code appears.
2. Share the code with players.
3. Select a game from the list.
4. Click **Start Game** once players have joined.

### Controller

Open the app with `?mode=controller` (on a phone or second browser tab):

```
http://<your-ip>:5173/?mode=controller
```

1. Enter the room code and tap **Join Room**.
2. Wait for the host to start the game.
3. Use the on-screen controls to play.

---

## Adding a New Game

### 1. Server — game logic

Create `server/src/games/<name>/<Name>Game.js` extending `BaseGame`:

```js
const BaseGame = require("../base/BaseGame");

class MyGame extends BaseGame {
  init() {
    // Set up this.state — called before start()
    this.state = { players: {} /* ... */ };
    Object.keys(this.room.players).forEach((id) => {
      this.state.players[id] = {
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        speed: 200,
        lastInputTime: 0,
      };
    });
  }

  update(delta) {
    if (!this.isRunning()) return;
    // Move players, check collisions, etc.
  }

  handleInput(playerId, input) {
    // Mutate this.state.players[playerId] based on input
  }
}

module.exports = MyGame;
```

The file name must follow the pattern `<Name>Game.js` where `<Name>` is the capitalised game id (e.g. `tag` → `TagGame.js`).

### 2. Client — host renderer

Create `client/src/host/games/<name>Host.js`:

```js
export function createHostRenderer(scene) {
  function syncState(state) {
    /* update Phaser objects from server state */
  }
  function update(delta) {
    /* interpolation, animations */
  }
  function destroy() {
    /* clean up Phaser objects */
  }
  return { syncState, update, destroy };
}
```

### 3. Client — controller UI

Create `client/src/controller/games/<name>Controller.js`:

```js
import socket from "../../core/socket.js";
import EVENTS from "../../shared/events.js";

export function mountController() {
  // Render buttons into #app and emit EVENTS.INPUT.MOVE / EVENTS.INPUT.ACTION
}
```

### 4. Register the game

Add an entry to both `client/src/shared/games.js` and `server/src/shared/games.js`:

```js
{ id: "mygame", name: "My Game" }
```

The `GameLoader` and `ControllerLoader` / `HostLoader` discover files by convention — no other registration is needed.

---

## Architecture Notes

**Authoritative server** — all game state lives on the server. The client never moves a player directly; it sends input, and the server's 60 TPS game loop updates positions and broadcasts the result.

**Player identity** — each browser generates a `playerId` (stored in `localStorage`) and sends it as Socket.IO auth on every connection. This allows the server to re-attach a reconnecting player to their room.

**Host vs controller split** — the host page runs Phaser and renders the game world. Controller pages are lightweight HTML/CSS with no game logic, suitable for low-end phones.

**Frame-rate independent interpolation** — the host renderer smooths positions between server snapshots using exponential decay (`1 - e^(-k * dt)`), so movement looks consistent regardless of display refresh rate.

**Dynamic loading** — host renderers and controller UIs are loaded via `import.meta.glob` (Vite). Adding a new `*Host.js` or `*Controller.js` file is enough — no import list to update.

---

## Available Games

| ID      | Name         | Status      |
| ------- | ------------ | ----------- |
| `racer` | Jungle Racer | Implemented |

---

## Environment Variables

| Variable | Default | Description           |
| -------- | ------- | --------------------- |
| `PORT`   | `3000`  | Server listening port |
