# Step 9 – Final Deployment

## Deployment Platform

The application is deployed using:

- **Backend:** Render Web Service
- **Frontend:** Render Static Site

This setup aligns with the architecture where:

- The server handles all real-time logic and state
- The client is a static interface for host and controllers

---

## Deployment Architecture

The system follows a **host + controller model**:

- **Host (PC/TV):**
  - Runs the Phaser.js game
  - Renders all players and game state

- **Controllers (Mobile Devices):**
  - Act only as input devices
  - Send movement/actions to server

- **Server (Node.js + Socket.IO):**
  - Manages rooms and players
  - Processes inputs
  - Updates and broadcasts game state

---

## Backend Deployment (Web Service)

The backend is deployed as a Render Web Service.

### Configuration

- **Root Directory:** `server`
- **Build Command:**

  ```
  npm install
  ```

- **Start Command:**

  ```
  npm start
  ```

### Key Implementation Details

- Uses dynamic port:

  ```js
  const PORT = process.env.PORT || 3000;
  ```

- Binds to:

  ```js
  server.listen(PORT, "0.0.0.0");
  ```

- Enables CORS for client connection:

  ```js
  cors: {
    origin: "*";
  }
  ```

### Responsibilities

The backend handles:

- Room creation and joining
- Player connection and reconnection
- Input processing from controllers
- Game lifecycle (start, pause, end)
- State broadcasting to host

---

## Frontend Deployment (Static Site)

The frontend is deployed as a Render Static Site using Vite.

### Configuration

- **Root Directory:** `client`
- **Build Command:**

  ```
  npm install && npm run build
  ```

- **Publish Directory:**

  ```
  dist
  ```

### Environment Variable

The frontend connects to the deployed backend using:

```
VITE_SERVER_URL=https://<your-server>.onrender.com
```

### Socket Configuration

Client uses:

```js
const SERVER_URL = import.meta.env.VITE_SERVER_URL;
```

This allows switching between local and production environments without modifying code.

---

## Communication Flow

1. Host opens the deployed frontend in a browser.
2. Host creates a room and selects a game.
3. Players open the same frontend on mobile devices.
4. Players join the room using Room ID.
5. Controllers send input events via Socket.IO.
6. Server processes inputs and updates game state.
7. Host receives updated state and renders gameplay.

---

## Deployment Result

The system is successfully deployed and supports:

- Real-time multiplayer interaction
- Host-controlled game rendering
- Mobile controller input system
- Modular game architecture
- Server-authoritative game logic

---

## Limitations

- Slight input latency may occur due to server-authoritative model over internet
- Optimized primarily for local network usage

---

## Conclusion

The deployment demonstrates a fully functional browser-based real-time multiplayer system using a host + controller architecture. The use of Render enables scalable hosting while maintaining a clean separation between frontend and backend components.
