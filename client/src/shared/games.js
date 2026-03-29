const GAMES = [
  {
    id: "tag",
    name: "Tag Game",
    minPlayers: 2,
    maxPlayers: 6,
  },
];

export function getGameById(id) {
  return GAMES.find((g) => g.id === id);
}

export default GAMES;
