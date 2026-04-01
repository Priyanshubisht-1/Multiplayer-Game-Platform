const EVENTS = {
  ROOM: {
    CREATE: "room:create",
    CREATED: "room:created",
    JOIN: "room:join",
    JOINED: "room:joined",
    LEAVE: "room:leave",
    UPDATE: "room:update",
    ERROR: "room:error",
  },

  INPUT: {
    MOVE: "input:move",
    ACTION: "input:action",
  },

  GAME: {
    SELECT: "game:select",
    START: "game:start",
    STARTED: "game:started",
    END: "game:end",
    STATE: "game:state",
    ERROR: "game:error",
  },
  RACER: {
    GAME_OVER: "racer:gameOver",
  },
};

export default EVENTS;
