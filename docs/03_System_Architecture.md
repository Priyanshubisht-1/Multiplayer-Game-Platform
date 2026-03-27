## 🧩 System Architecture

![System Architecture](./assets/architecture.png)

### 📱 Mobile Players (Controllers)
- Act as input devices
- Join a room and send inputs only
- No rendering logic on client

---

### 🖥️ Host Client (Display)
- Single shared display (TV / Laptop)
- Renders game using Phaser
- Shows lobby and gameplay
- Does not control player actions

---

### ⚙️ Node.js + Socket.IO Server
- Handles room creation and joining
- Differentiates host and controller roles
- Processes player inputs
- Maintains authoritative game state
- Broadcasts updates to host client

---

### 🎮 Game Modules
- Modular game system
- Current:
  - Tag Game
  - Car Game
- Easily extendable for future games

---

### 🔄 Communication Flow
- Mobile → Server: Inputs (movement, actions)
- Server → Host: Game state updates
- Server handles all logic (authoritative model)