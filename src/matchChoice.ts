export function estimateSeriesWinProbability(strengthGap: number, bestOf: number) {
  const mapWinProbability = clamp(1 / (1 + Math.exp(-strengthGap / 5.5)), 0.08, 0.92);
  const maps = Math.max(1, Math.round(bestOf));
  const winsNeeded = Math.floor(maps / 2) + 1;
  let probability = 0;

  for (let wins = winsNeeded; wins <= maps; wins += 1) {
    probability +=
      combination(maps, wins) *
      mapWinProbability ** wins *
      (1 - mapWinProbability) ** (maps - wins);
  }

  return clamp(probability, 0.04, 0.96);
}

export function matchRevealScore(
  maps: Array<{ leftScore: number; rightScore: number; winnerId: string }>,
  leftTeamId: string,
  bestOf: number,
  visibleMaps: number,
) {
  const visible = maps.slice(0, visibleMaps);
  if (bestOf === 1) {
    return {
      left: visible[0]?.leftScore ?? 0,
      right: visible[0]?.rightScore ?? 0,
    };
  }
  return {
    left: visible.filter((map) => map.winnerId === leftTeamId).length,
    right: visible.filter((map) => map.winnerId !== leftTeamId).length,
  };
}

function combination(total: number, selected: number) {
  const picks = Math.min(selected, total - selected);
  let result = 1;
  for (let index = 1; index <= picks; index += 1) {
    result = (result * (total - picks + index)) / index;
  }
  return result;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
