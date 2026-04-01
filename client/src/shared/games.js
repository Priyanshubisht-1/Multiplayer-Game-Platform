const GAMES = [
  {
    id: "racer",
    name: "Jungle Racer",
    minPlayers: 2,
    maxPlayers: 4,
    emoji: "🏎️",
    description:
      "A 4-player top-down obstacle racer with checkpoint laps on the shared host screen.",
  },
];

export function getGameById(id) {
  return GAMES.find((g) => g.id === id);
}

export default GAMES;
