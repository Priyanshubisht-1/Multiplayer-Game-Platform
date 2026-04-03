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
  {
    id: "paint",
    name: "Paint Arena",
    minPlayers: 2,
    maxPlayers: 4,
    emoji: "🎨",
    description: "Cover the most area with your paint roller to win!",
  },
];

export function getGameById(id) {
  return GAMES.find((g) => g.id === id);
}

export default GAMES;
