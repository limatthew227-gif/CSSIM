// HLTV's April-June 2026 monthly prospect rankings. The reports are kept as ranked handles so career
// potential can use a real, repeatable signal instead of assigning hidden talent at random.

export const hltvProspectReports2026 = [
  {
    month: "April 2026",
    source: "https://www.hltv.org/news/44436/hltv-prospects-april-2026",
    rankedHandles: [
      "dziugss", "xkacpersky", "dem0n", "cobrazera", "kl1m", "xielo", "krabeni", "cmtry", "mail09", "nota",
      "poiii", "koala", "adamb", "sirah", "dawy", "xeedo", "xelex", "syph0", "jackasmo", "nut-nut",
      "flouzer", "flayy", "tenzy", "gr1ks", "qw1nk1", "kashl1d", "grizz", "ksloks", "jorko", "jocab",
      "cej0t", "beccie", "mokuj1n", "guty", "sdaim", "jboen", "tried", "alkaren", "lattykk", "zero",
      "aw", "b1st", "sliimey", "slaxejezzz", "st0m4k", "to0ro", "diozera", "tikuak", "yami", "wumbo",
    ],
  },
  {
    month: "May 2026",
    source: "https://www.hltv.org/news/44610/hltv-prospects-may-2026",
    rankedHandles: [
      "dziugss", "xkacpersky", "dem0n", "cobrazera", "kl1m", "krabeni", "mail09", "xielo", "cmtry", "poiii",
      "koala", "nota", "adamb", "sirah", "dawy", "xeedo", "xelex", "jackasmo", "syph0", "flouzer",
      "grizz", "nut-nut", "qw1nk1", "tenzy", "gr1ks", "kashl1d", "jocab", "jorko", "beccie", "ksloks",
      "flayy", "cej0t", "sdaim", "mokuj1n", "jboen", "guty", "lattykk", "tikuak", "ssen", "zero",
      "sl1m3", "nickyb", "b1st", "sliimey", "slaxejezzz", "aw", "st0m4k", "wumbo", "diozera", "yami",
    ],
  },
  {
    month: "June 2026",
    source: "https://www.hltv.org/news/44728/hltv-prospects-ranking-june-2026",
    rankedHandles: [
      "dziugss", "xkacpersky", "dem0n", "xelex", "kl1m", "krabeni", "cobrazera", "mail09", "xielo", "poiii",
      "dawy", "adamb", "cmtry", "xeedo", "tenzy", "nota", "sirah", "koala", "jackasmo", "syph0",
      "qw1nk1", "flouzer", "grizz", "nut-nut", "jorko", "gr1ks", "lattykk", "jocab", "ksloks", "flayy",
      "kashl1d", "s1zzi", "mokuj1n", "jboen", "tikuak", "nickyb", "aw", "sdaim", "guty", "cej0t",
      "sl1m3", "zero", "mo0n", "beccie", "b1st", "slaxejezzz", "sliimey", "wumbo", "pepe", "n0te",
    ],
  },
] as const;

export interface HltvProspectSignal {
  appearances: number;
  ranks: number[];
  bestRank?: number;
  score: number;
  potentialBonus: 0 | 1 | 2 | 3;
}

export function normalizeProspectHandle(handle: string): string {
  return handle.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function hltvProspectSignal(handle: string): HltvProspectSignal {
  const normalized = normalizeProspectHandle(handle);
  const ranks = hltvProspectReports2026.flatMap((report) => {
    const index = report.rankedHandles.findIndex((candidate) => normalizeProspectHandle(candidate) === normalized);
    return index === -1 ? [] : [index + 1];
  });

  if (ranks.length === 0) return { appearances: 0, ranks: [], score: 0, potentialBonus: 0 };

  const rankPoints = ranks.map((rank) => 51 - rank);
  const averageAcrossReports = rankPoints.reduce((sum, points) => sum + points, 0) / hltvProspectReports2026.length;
  const score = averageAcrossReports * 0.75 + Math.max(...rankPoints) * 0.25;
  const potentialBonus = score >= 40 ? 3 : score >= 22 ? 2 : score >= 8 ? 1 : 0;

  return {
    appearances: ranks.length,
    ranks,
    bestRank: Math.min(...ranks),
    score,
    potentialBonus,
  };
}

export function hltvProspectPotentialBonus(handle: string): 0 | 1 | 2 | 3 {
  return hltvProspectSignal(handle).potentialBonus;
}
