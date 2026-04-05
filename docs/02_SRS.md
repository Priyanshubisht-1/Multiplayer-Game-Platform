# 📘📄 Project Scope

# 🧾 SRS – Software Requirements Specification

---

# 1️⃣ 🖥️ System Overview

The **WebSocket-Based Modular Multiplayer Game Platform** is a 🌐 browser-based multiplayer system that allows a host to create a room and mobile players to join that room as controllers using synchronized 🔄 WebSocket communication.

The platform follows a **server-authoritative host-controller architecture**:

- 🖥️ **Host Client** renders the lobby and gameplay on a shared display
- 📱 **Player Clients** act as controllers only and send input events
- ⚙️ **Server** validates input, runs the game loop, maintains authoritative game state, and broadcasts state updates

The system focuses on:

- ⚡ low-latency multiplayer interaction
- 🧩 modular extensibility for multiple games
- 🏗️ scalable backend architecture
- 🛡️ authoritative server-side state control

---

# 2️⃣ ✅ Functional Requirements (Must-Have)

These define the **core system features** that must be implemented.

---

## 2.1 👤🏠 User & Room Management

- ➕ Host can create a game room
- 🔑 Players can join an existing room using a Room ID
- 👥 Maximum player limit per room
- 🗑️ Automatic room deletion after all players leave
- 🔄 Reconnection handling for temporarily disconnected players

---

## 2.2 🔄 Real-Time Communication

- 🎮 Real-time input transmission from controllers to server
- 📡 Real-time event broadcasting between host, players, and server
- 🛡️ Server-side validation of all incoming actions
- 🧠 Server shall maintain the authoritative game state for every active room
- 🚫 Clients shall not directly modify gameplay state

---

## 2.3 🕹️ Game Logic

- 🚀 Player spawn management
- 🏆 Score tracking
- 🥇 Winner detection
- ⏱️ Game start, pause, resume, and end conditions
- 🔁 A server-side game loop shall update the gameplay state continuously
- ✅ All gameplay rules, movement, collisions, and scoring logic shall be executed on the server

---

## 2.4 🧩 Modular Game Architecture

- ➕ Platform should support adding new game modules
- 📐 Each game should follow a predefined interface structure
- 🔌 Game logic must be isolated from the core networking layer
- 🧱 New games should be loadable without changing the overall room and socket architecture

---

# 3️⃣ ⚙️ Non-Functional Requirements

These define the **system quality attributes**.

---

## 3.1 ⚡ Performance

- ⏱️ Latency should remain minimal under normal local network conditions
- 👥 Server should handle at least **50 concurrent players** as an initial target
- 🔁 The server game loop should update state consistently and efficiently

---

## 3.2 📈 Scalability

- 🏗️ Server architecture should allow horizontal scaling in future versions
- 🧩 Modular design should allow easy addition of new games
- 🛠️ Room and game management should remain separated for maintainability

---

## 3.3 🔐 Security

- ✅ Input validation on server side
- 🛡️ Prevent client-side cheating using a **server-authoritative model**
- 🚫 Controllers and host clients must not have authority to alter gameplay state directly

---

## 3.4 🔁 Reliability

- ⚠️ Proper error handling
- 🔄 Reconnection handling if a player disconnects temporarily
- 🧠 Server should preserve room and player state during short disconnections
- ⏸️ Game should pause or recover gracefully when required players disconnect

---

# 4️⃣ 🚀 Future Enhancements (Could-Be)

These features are not part of the initial release but may be implemented later:

- 🔐 Player authentication system
- 🏅 Leaderboard system
- 💬 Chat system inside rooms
- 👀 Spectator mode
- 🗄️ Database integration for persistent scores
- 🎯 Matchmaking algorithm
- 🧱 Microservices-based architecture

---

# 5️⃣ 🚫 Out of Scope (Current Version)

The following features are **not included** in the first version:

- 🧊 3D game development
- 📱 Native mobile app version
- 💳 Payment integration
- 🤖 AI-based matchmaking

---

## ✅ Scope Summary

This SRS defines a **real-time, scalable, modular multiplayer gaming platform** built around a **server-authoritative host-controller architecture**. The server owns and updates the gameplay state, the host renders that state on a shared screen, and mobile players participate as controller clients only.