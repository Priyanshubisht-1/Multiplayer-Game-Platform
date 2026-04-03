# WebSocket-Based Modular Multiplayer Game Platform

A browser-based real-time multiplayer system where **one device acts as the host (main screen)** and multiple devices act as **controllers (mobile input devices)**.

The system follows a **host + controller architecture**

---

## 🚀 How It Works

* The **host (PC/TV)** runs the game using Phaser.js and renders all players.
* **Controllers (mobile devices)** only send input (movement/actions).
* The **server (Node.js + Socket.IO)** is authoritative:

  * processes inputs
  * updates game state
  * sends updates to host

```
Controller (Phone) ──┐
Controller (Phone) ──┼──► Server (Node.js + Socket.IO) ──► Host (Phaser Display)
Controller (Phone) ──┘
```

---

## 🧠 Core Architecture

* Host is **NOT a player**
* Controllers are the **only players**
* Server controls:

  * game logic
  * collisions
  * scoring
* Host only renders state
* Controllers only send input

---

## 📁 Project Structure

```
Multiplayer-Game-Platform/                     # Real-time multiplayer platform (host display + mobile controllers)
    ├── client/                               # Frontend (Vite app: host UI + controller UI)
    │   ├── src/
    │   │   ├── controller/                   # Mobile/controller-side (ONLY input layer, no game logic)
    │   │   │   ├── games/
    │   │   │   │   ├── paint/
    │   │   │   │   │   ├── paintController.js   # Sends drawing actions (touch → input events)
    │   │   │   │   ├── racer/
    │   │   │   │   │   ├── racerController.js   # Sends movement inputs (accelerate, brake, steer)
    │   │   │   ├── ControllerLoader.js         # Dynamically loads controller UI based on selected game
    │   │   │   ├── index.js                    # Entry point for controller mode (socket + UI init)
    │   │   ├── core/
    │   │   │   ├── socket.js                  # Singleton Socket.IO client (shared connection)
    │   │   ├── host/                          # Host/common display (ONLY rendering, no game logic)
    │   │   │   ├── game/
    │   │   │   │   ├── scenes/
    │   │   │   │   │   ├── MainScene.js       # Phaser scene delegating rendering to game modules
    │   │   │   │   ├── GameManager.js         # Manages renderer lifecycle (load/update/destroy)
    │   │   │   │   ├── gameSelection.js       # Host UI logic for selecting game
    │   │   │   ├── games/                     # Visual renderers (consume server state only)
    │   │   │   │   ├── paint/
    │   │   │   │   │   ├── paintHost.js       # Renders paint board (no logic)
    │   │   │   │   ├── racer/
    │   │   │   │   │   ├── assets/            # Racer assets (sprites/backgrounds)
    │   │   │   │   │   │   ├── racer-xx-xx.png
    │   │   │   │   │   └── racerHost.js       # Renders race visuals (interpolation, positions)
    │   │   │   ├── HostLoader.js              # Loads host renderer dynamically per game
    │   │   │   ├── index.js                   # Entry point for host mode (Phaser init)
    │   │   ├── lobby/                        # Room/lobby system (pre-game flow)
    │   │   │   ├── CreateRoom.js             # Host creates room
    │   │   │   ├── JoinRoom.js               # Player joins room
    │   │   │   ├── PlayerList.js             # Displays connected players
    │   │   │   ├── renderLobby.js            # Lobby orchestration (players + game start)
    │   │   ├── shared/                      # ⚠️ Shared constants (risk if duplicated with server)
    │   │   │   ├── events.js                # Socket event names (must match backend)
    │   │   │   ├── games.js                 # Game registry (IDs + display names)
    │   │   ├── main.js                     # App bootstrap + mode routing
    │   ├── index.html                      # Root HTML file
    │   ├── package.json                    # Frontend dependencies
    ├── server/                            # Backend (authoritative game server)
    │   ├── src/
    │   │   ├── core/
    │   │   │   ├── GameLoader.js           # Loads game modules dynamically
    │   │   │   ├── RoomManager.js          # Manages rooms and player mapping
    │   │   ├── games/                     # Server-side game logic (SOURCE OF TRUTH)
    │   │   │   ├── base/
    │   │   │   │   ├── BaseGame.js         # Defines strict game contract (init/update/input/serialize)
    │   │   │   ├── paint/
    │   │   │   │   ├── PaintGame.js        # Paint logic (state + scoring)
    │   │   │   ├── racer/
    │   │   │   │   └── RacerGame.js        # Racer logic (movement + rules)
    │   │   ├── loop/
    │   │   │   ├── GameLoop.js             # Tick loop (updates rooms; should use delta time)
    │   │   ├── rooms/
    │   │   │   ├── Room.js                 # Room state container (host, players, game instance)
    │   │   ├── shared/
    │   │   │   ├── events.js               # ⚠️ Must match client exactly (duplication risk)
    │   │   │   ├── games.js                # Backend game registry
    │   │   ├── sockets/
    │   │   │   ├── connection.js           # Socket setup + authentication
    │   │   │   ├── controllerHandler.js    # Input → validate → forward to game
    │   │   │   ├── gameHandler.js          # Game select/start handling
    │   │   │   └── roomHandler.js          # Room lifecycle (create/join/leave)
    │   │   └── index.js                   # Server entry (HTTP + Socket.IO)
    │   └── package.json                   # Backend dependencies
```

---

## 🎮 Available Games

| ID    | Name       | Status      |
| ----- | ---------- | ----------- |
| racer | Racer Game | Implemented |
| paint | Paint Game | Implemented |

---

# 🧪 Local Setup (Recommended)

## Prerequisites

* Node.js 18+
* npm
* All devices on same Wi-Fi

---

## 1. Start Server

```bash
cd server
npm install
npm run dev
```

Server runs on:

```
http://localhost:3000
```

---

## 2. Configure Client Socket

Open:

```
client/src/core/socket.js
```

Replace server URL with your local IP:

```js
const socket = io("http://192.168.X.X:3000", {
```

⚠️ Important:

* DO NOT use `localhost` for mobile
* Use your IPv4 address (`ipconfig`)

---

## 3. Start Client (Vite)

```bash
cd client
npm install
npm run dev
```

You will see:

* Local: `http://localhost:5173`
* Network: `http://192.168.X.X:5173`

---

## 4. Run the Game

### Host (PC / TV)

```
http://<your-ip>:5173/?mode=host
```

### Controllers (Mobile)

```
http://<your-ip>:5173/?mode=controller
```

---

## ✅ Expected Behavior

* Host creates room
* Players join via mobile
* Controllers send input
* Server processes game logic
* Host renders gameplay

---

# 🌐 Live Deployment (Render)

## Deployment Setup

* **Backend:** Render Web Service
* **Frontend:** Render Static Site

---

## 🔧 Backend (Web Service)

* Root: `server`
* Build:

  ```
  npm install
  ```
* Start:

  ```
  npm start
  ```

Server:

* runs on `process.env.PORT`
* handles all real-time logic
* manages rooms, players, and game state

---

## 🎨 Frontend (Static Site)

* Root: `client`
* Build:

  ```
  npm install && npm run build
  ```
* Publish:

  ```
  dist
  ```

---

## ⚙️ Environment Variable (IMPORTANT)

Set in Render Static Site:

```
VITE_SERVER_URL=https://<your-backend>.onrender.com
```

---

## 🔌 Client Connection

```js
const SERVER_URL = import.meta.env.VITE_SERVER_URL;
```

---

## 🔄 Live System Flow

1. Host opens deployed frontend
2. Players join using mobile devices
3. Controllers send input
4. Server processes input
5. Host renders updated state

---

## ⚠️ Notes

* WebSockets run via Render Web Service
* Slight latency over internet is expected
* Optimized for local network gameplay

---

# 🧱 Adding a New Game (Modular System)

## 1. Server

Create:

```
server/src/games/<game>/<GameName>Game.js
```

Extend:

```js
class MyGame extends BaseGame {}
```

---

## 2. Host Renderer

Create:

```
client/src/host/games/<game>/<game>Host.js
```

---

## 3. Controller UI

Create:

```
client/src/controller/games/<game>/<game>Controller.js
```

---

## 4. Register Game

Update:

```
client/src/shared/games.js
server/src/shared/games.js
```

---

## 🧠 Architecture Notes

* Server is **authoritative**
* Controllers send only input
* Host renders state only
* Modular game system (plug-and-play)
* No traditional multiplayer sync

---

## 📌 Conclusion

This project demonstrates a scalable **host + controller multiplayer system** with:

* Real-time communication
* Modular game architecture
* Server-controlled logic
* Lightweight mobile controllers

---
