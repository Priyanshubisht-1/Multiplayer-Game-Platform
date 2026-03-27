const http = require("http")
const { Server } = require("socket.io")

const RoomManager = require("./core/RoomManager")
const GameLoop = require("./loop/GameLoop")
const registerConnections = require("./sockets/connection")

const PORT = process.env.PORT || 3000

const server = http.createServer((req, res) => {
    if (req.url === "/" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "text/plain" })
        res.end("Realtime multiplayer server is running")
        return
    }

    res.writeHead(404, { "Content-Type": "text/plain" })
    res.end("Not Found")
})

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

const roomManager = new RoomManager(io)
const gameLoop = new GameLoop(roomManager)

registerConnections(io, roomManager)
gameLoop.start()

server.listen(PORT,"0.0.0.0", () => {
    console.log(`[Server] Listening on http://localhost:${PORT}`)
})