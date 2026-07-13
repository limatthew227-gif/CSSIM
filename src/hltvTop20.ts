import {
  Coach,
  MapId,
  PlayerStats,
  Role,
  Roster,
  SourceTeam,
  Style,
  mapPool,
  rateStatsForRole,
} from "./gameData";
import { hltvPlayerSplits2026 } from "./hltvPlayerSplits2026";
import { hltvPlayerAge2026 } from "./hltvPlayerAges2026";
import { teamLogoUrls } from "./teamLogos";

type CoachStyle = Coach["style"];
type RatingFilter = "top5" | "top10" | "top20" | "top50" | "overall";

interface RatingSample {
  rating: number;
  maps: number;
}

export interface HltvPlayerSeed {
  handle: string;
  realName: string;
  country: string;
  role: Role;
  secondaryRole?: Role; // a second job (e.g. AWP who also IGLs) — counts for composition, not fragging
  fragSupport?: boolean; // a Support who frags like a rifler (no support debuff on stats/OVR/fragging)
  style: Style;
  hltvRating: number;
  statOverrides?: Partial<PlayerStats>;
  samples?: Partial<Record<RatingFilter, RatingSample>>;
  recentRating?: number;
}

export interface HltvTeamSeed {
  id: string;
  rosterId?: string;
  logoKey?: string;
  logoUrl?: string;
  era?: SourceTeam["era"];
  year?: string;
  rankingLabel?: string;
  rank: number;
  points: number;
  tag: string;
  name: string;
  country: string;
  accent: string;
  coachHandle: string;
  coachRealName: string;
  coachCountry: string;
  coachStyle: CoachStyle;
  coachMaps: number;
  coachTrophies: number;
  coachWinrate: number;
  mapBias: Partial<Record<MapId, number>>;
  players: HltvPlayerSeed[];
  note?: string;
  trophies?: string[]; // notable titles this roster has won (real events)
}

const ids = mapPool.map((map) => map.id) as MapId[];
const ratingFilters: RatingFilter[] = ["top5", "top10", "top20", "top50", "overall"];
const requiredMaps: Record<RatingFilter, number> = {
  top5: 30,
  top10: 40,
  top20: 50,
  top50: 60,
  overall: 60,
};
const filterWeights: Record<RatingFilter, number> = {
  top5: 0.14,
  top10: 0.31,
  top20: 0.35,
  top50: 0.12,
  overall: 0.08,
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "team";
}

function clampWhole(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampRating(value: number) {
  return clampNumber(Number.isFinite(value) ? value : 1, 0.72, 1.42);
}

function estimateMaps(team: HltvTeamSeed, filter: RatingFilter) {
  const base = clampNumber(team.coachMaps * 0.45, 42, 140);
  if (filter === "overall") return Math.round(base);

  // The original card model was calibrated for the top 20. Keep that curve intact, then cap the
  // opposition pressure so lower-ranked teams still receive meaningful samples instead of one-map
  // placeholders once the database extends beyond #20.
  const rankPressure = clampNumber((team.rank - 1) / 19, 0, 1.25);
  const factor =
    filter === "top50"
      ? 0.68 - rankPressure * 0.23
      : filter === "top20"
        ? 0.46 - rankPressure * 0.22
        : filter === "top10"
          ? 0.29 - rankPressure * 0.17
          : 0.18 - rankPressure * 0.12;
  const rankLift = Math.max(0, 21 - team.rank) * (filter === "top50" ? 0.9 : filter === "top20" ? 0.45 : filter === "top10" ? 0.18 : 0.08);
  return Math.round(clampNumber(base * factor + rankLift, 1, filter === "top50" ? 88 : filter === "top20" ? 56 : filter === "top10" ? 36 : 24));
}

function inferRating(player: HltvPlayerSeed, team: HltvTeamSeed, filter: RatingFilter) {
  const baseRating = effectiveHltvRating(player, team);
  if (filter === "overall") return clampRating(baseRating);

  const rankPressure = clampNumber((team.rank - 1) / 19, 0, 1.25);
  const baseDrop =
    filter === "top5"
      ? 0.03 + rankPressure * 0.11
      : filter === "top10"
        ? 0.015 + rankPressure * 0.09
        : filter === "top20"
          ? 0.006 + rankPressure * 0.065
          : 0.002 + rankPressure * 0.028;
  const starResilience = Math.max(0, baseRating - 1.12) * (filter === "top5" ? 0.09 : filter === "top10" ? 0.08 : filter === "top20" ? 0.06 : 0.035);
  const roleResilience =
    player.role === "AWP"
      ? filter === "top5" || filter === "top10"
        ? 0.006
        : 0.004
      : player.role === "IGL"
        ? -0.006
        : player.role === "Entry"
          ? -0.002
          : player.role === "Lurker"
            ? 0.002
            : 0;
  return clampRating(baseRating - baseDrop + starResilience + roleResilience);
}

function ratingSample(player: HltvPlayerSeed, team: HltvTeamSeed, filter: RatingFilter): RatingSample {
  const explicit = scrapedRatingSample(player, team, filter) ?? player.samples?.[filter];
  if (explicit) {
    return {
      rating: clampRating(explicit.rating),
      maps: Math.max(0, Math.round(explicit.maps)),
    };
  }

  return {
    rating: inferRating(player, team, filter),
    maps: estimateMaps(team, filter),
  };
}

function sampleKey(team: HltvTeamSeed, player: HltvPlayerSeed) {
  return `${normalizeSampleName(team.name)}|${normalizeSampleHandle(player.handle)}`;
}

function normalizeSampleName(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

function normalizeSampleHandle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "");
}

function scrapedRatingSample(player: HltvPlayerSeed, team: HltvTeamSeed, filter: RatingFilter): RatingSample | undefined {
  return hltvPlayerSplits2026[sampleKey(team, player)]?.[filter];
}

function effectiveHltvRating(player: HltvPlayerSeed, team: HltvTeamSeed) {
  return scrapedRatingSample(player, team, "overall")?.rating ?? player.hltvRating;
}

function sampleConfidence(sample: RatingSample, filter: RatingFilter) {
  return clampNumber(sample.maps / requiredMaps[filter], 0, 1);
}

function adjustedFilterRating(player: HltvPlayerSeed, team: HltvTeamSeed, filter: RatingFilter) {
  const sample = ratingSample(player, team, filter);
  return 1 + (sample.rating - 1) * sampleConfidence(sample, filter);
}

function oppositionAdjustedRating(player: HltvPlayerSeed, team: HltvTeamSeed) {
  return ratingFilters.reduce((sum, filter) => sum + adjustedFilterRating(player, team, filter) * filterWeights[filter], 0);
}

function weightedSampleConfidence(player: HltvPlayerSeed, team: HltvTeamSeed) {
  return ratingFilters.reduce((sum, filter) => {
    const sample = ratingSample(player, team, filter);
    return sum + sampleConfidence(sample, filter) * filterWeights[filter];
  }, 0);
}

function teamContextRating(team: HltvTeamSeed) {
  const rankValue = team.rank <= 20 ? (21 - team.rank) / 20 : -Math.min(0.4, (team.rank - 20) / 75);
  const pointValue = clampNumber(Math.log10(team.points) / 3, 0.55, 1);
  const winValue = clampNumber((team.coachWinrate - 50) / 100, -0.08, 0.25);
  return 0.955 + rankValue * 0.105 + pointValue * 0.04 + winValue * 0.055;
}

function farmingPenalty(player: HltvPlayerSeed, team: HltvTeamSeed) {
  const overall = ratingSample(player, team, "overall").rating;
  const top20 = ratingSample(player, team, "top20").rating;
  const gap = overall - top20;
  if (gap <= 0.05) return 0;
  if (gap <= 0.1) return 1;
  if (gap <= 0.15) return 2;
  if (gap <= 0.2) return 3;
  return clampWhole(3 + (gap - 0.2) * 14, 4, 7);
}

function lowConfidencePenalty(confidence: number) {
  if (confidence < 0.3) return 4;
  if (confidence < 0.5) return 2;
  if (confidence < 0.7) return 1;
  return 0;
}

function roleAdjustedRating(player: HltvPlayerSeed, team: HltvTeamSeed) {
  const opposition = oppositionAdjustedRating(player, team);
  const adjustedTop20 = adjustedFilterRating(player, team, "top20");
  const adjustedOverall = adjustedFilterRating(player, team, "overall");
  const teamContext = teamContextRating(team);
  const farmingGap = Math.max(0, ratingSample(player, team, "overall").rating - ratingSample(player, team, "top20").rating);

  if (player.role === "AWP") {
    return opposition * 0.88 + adjustedTop20 * 0.08 + adjustedOverall * 0.04 - Math.max(0, farmingGap - 0.08) * 0.22;
  }
  if (player.role === "Entry") {
    return opposition + 0.012 + Math.max(0, adjustedTop20 - 1) * 0.03;
  }
  if (player.role === "Lurker") {
    return opposition * 0.82 + adjustedTop20 * 0.12 + adjustedOverall * 0.06 + 0.004;
  }
  if (player.role === "IGL") {
    return opposition * 0.52 + teamContext * 0.38 + adjustedTop20 * 0.1 + 0.008;
  }
  if (player.role === "Support") {
    return opposition * 0.86 + teamContext * 0.08 + adjustedOverall * 0.06;
  }
  return opposition * 0.92 + adjustedTop20 * 0.08;
}

function ratingToOverall(rating: number) {
  const value = rating < 1 ? 72 + (rating - 1) * 120 : rating <= 1.15 ? 72 + (rating - 1) * 100 : 87 + (rating - 1.15) * 60;
  return clampNumber(value, 58, 96);
}

function playerOverall(player: HltvPlayerSeed, team: HltvTeamSeed) {
  const confidence = weightedSampleConfidence(player, team);
  const roleOvr = ratingToOverall(roleAdjustedRating(player, team));
  const recentRating = player.recentRating ?? oppositionAdjustedRating(player, team) * 0.65 + effectiveHltvRating(player, team) * 0.35;
  const recentOvr = ratingToOverall(1 + (clampRating(recentRating) - 1) * Math.max(0.55, confidence));
  const confidenceOvr = 66 + confidence * 18;
  const contextOvr = ratingToOverall(teamContextRating(team));

  return clampWhole(
    roleOvr * 0.7 +
      recentOvr * 0.15 +
      confidenceOvr * 0.1 +
      contextOvr * 0.05 -
      farmingPenalty(player, team) -
      lowConfidencePenalty(confidence),
    58,
    96,
  );
}

function statsFromHltv(player: HltvPlayerSeed, team: HltvTeamSeed): PlayerStats {
  const card = playerOverall(player, team);
  const ratingLift = (oppositionAdjustedRating(player, team) - 1) * 14;
  const styleAim = player.style === "Aggressive" ? 2 : player.style === "Passive" ? -1 : 0;
  const stylePatience = player.style === "Passive" ? 2 : 0;
  // a frag-support is a rifler for stat purposes (keeps Support only for composition/utility/display)
  const role: Role = player.role === "Support" && player.fragSupport ? "Rifler" : player.role;

  return {
    aim: clampWhole(card + ratingLift + styleAim + (role === "Entry" ? 4 : role === "IGL" ? -4 : role === "Support" ? -2 : role === "Rifler" ? 2 : 1), 50, 99),
    clutch: clampWhole(card + ratingLift + stylePatience + (role === "Lurker" ? 5 : role === "AWP" ? 2 : role === "Rifler" ? 1 : role === "Entry" ? -1 : 0), 50, 99),
    consistency: clampWhole(card + (teamContextRating(team) - 1) * 18 + (role === "Support" ? 4 : role === "Lurker" ? 3 : role === "IGL" ? 3 : role === "Entry" ? -2 : 0), 50, 99),
    awp: clampWhole(
      role === "AWP" ? card + 8 : role === "Rifler" ? card - 11 : role === "Entry" ? card - 15 : role === "Lurker" ? card - 13 : card - 18,
      45,
      99,
    ),
    igl: clampWhole(
      role === "IGL" ? card + 10 : role === "Support" ? card + 1 : role === "Lurker" ? card - 5 : role === "Rifler" ? card - 9 : card - 14,
      45,
      99,
    ),
  };
}

function traitsFor(player: HltvPlayerSeed, stats: PlayerStats, team: HltvTeamSeed) {
  const traits = new Set<string>();
  const hltvRating = effectiveHltvRating(player, team);
  traits.add(player.role === "AWP" ? "Sniper" : player.role === "IGL" ? "Brain" : player.role === "Lurker" ? "Late round" : player.role);
  if (hltvRating >= 1.16) traits.add("Star");
  if (stats.clutch >= 88) traits.add("Clutch");
  if (player.style === "Aggressive") traits.add("Entry");
  if (player.style === "Passive") traits.add("Anchor");
  traits.add(`HLTV ${hltvRating.toFixed(2)}`);
  return Array.from(traits).slice(0, 4);
}

function teamMapPool(team: HltvTeamSeed) {
  const base = 72 + Math.max(0, 21 - team.rank) * 0.72 + Math.log10(team.points) * 2.7;
  return ids.reduce(
    (acc, mapId, index) => {
      const cadence = ((team.rank * 5 + index * 9) % 7) - 3;
      acc[mapId] = clampWhole(base + cadence + (team.mapBias[mapId] ?? 0), 62, 97);
      return acc;
    },
    {} as Record<MapId, number>,
  );
}

function playerMapPool(index: number, player: HltvPlayerSeed, team: HltvTeamSeed, teamMaps: Record<MapId, number>) {
  return ids.reduce(
    (acc, mapId, mapIndex) => {
      const roleBoost =
        (mapId === "dust2" && player.role === "AWP") ||
        (mapId === "nuke" && player.role === "IGL") ||
        (mapId === "inferno" && player.role === "Support") ||
        (mapId === "mirage" && player.role === "Entry") ||
        ((mapId === "ancient" || mapId === "anubis") && player.role === "Lurker")
          ? 3
          : 0;
      const ratingBoost = Math.max(-4, Math.min(5, Math.round((oppositionAdjustedRating(player, team) - 1) * 18)));
      acc[mapId] = clampWhole(teamMaps[mapId] + ((index * 5 + mapIndex * 3) % 7) - 3 + roleBoost + ratingBoost, 55, 99);
      return acc;
    },
    {} as Record<MapId, number>,
  );
}

export function makeHltvRoster(team: HltvTeamSeed): Roster {
  const source: SourceTeam = {
    tag: team.tag,
    name: team.name,
    country: team.country,
    era: team.era ?? "CS2",
    year: team.year ?? "2026",
    accent: team.accent,
    logo: team.logoUrl ?? teamLogoUrls[team.logoKey ?? team.id],
  };
  const maps = teamMapPool(team);
  const rankingLabel = team.rankingLabel ?? `HLTV #${team.rank} on June 8, 2026`;
  const pointsCopy = team.year === "2026" || !team.year ? ` with ${team.points} points` : ` (${team.points} model points)`;

  return {
    id: team.rosterId ?? `hltv-${team.id}-${source.year === "2026" ? "2026-06-08" : source.year}`,
    ...source,
    tagline: `${rankingLabel}${pointsCopy}. OVR is opposition, role, sample-size, recent-form, and team-context adjusted.${team.note ? ` ${team.note}` : ""}`,
    mapPool: maps,
    rank: team.rank,
    trophies: team.trophies,
    players: team.players.map((player, index) => {
      const stats = { ...statsFromHltv(player, team), ...player.statOverrides };
      return {
        id: `hltv-${team.id}-${slugify(player.handle)}`,
        handle: player.handle,
        realName: player.realName,
        country: player.country,
        role: player.role,
        secondaryRole: player.secondaryRole,
        fragSupport: player.fragSupport,
        style: player.style,
        traits: traitsFor(player, stats, team),
        stats,
        ovr: rateStatsForRole(stats, player.role === "Support" && player.fragSupport ? "Rifler" : player.role),
        hltvRating: effectiveHltvRating(player, team),
        hltvMaps: ratingSample(player, team, "overall").maps,
        age: source.year === "2026" ? hltvPlayerAge2026(player.handle) : undefined,
        source,
        maps: playerMapPool(index, player, team, maps),
      };
    }),
  };
}

function coachRating(team: HltvTeamSeed) {
  const averagePlayerRating = team.players.reduce((sum, player) => sum + effectiveHltvRating(player, team), 0) / team.players.length;
  return clampWhole(
    69 +
      Math.max(0, 21 - team.rank) * 0.58 +
      (averagePlayerRating - 1) * 21 +
      (team.coachWinrate - 55) * 0.22 +
      Math.min(5, team.coachMaps / 230) +
      team.coachTrophies * 0.28,
    68,
    94,
  );
}

export function makeHltvCoach(team: HltvTeamSeed): Coach {
  const trophyText = `${team.coachTrophies} ${team.coachTrophies === 1 ? "trophy" : "trophies"}`;
  return {
    id: `hltv-coach-${team.id}`,
    handle: team.coachHandle,
    realName: team.coachRealName,
    country: team.coachCountry,
    style: team.coachStyle,
    rating: coachRating(team),
    text: `HLTV #${team.rank} staff model: rank, roster rating average, ${team.coachMaps} maps coached, ${trophyText}, ${team.coachWinrate}% profile winrate.`,
  };
}

const hltvTeams: HltvTeamSeed[] = [
  {
    id: "vitality",
    rank: 1,
    points: 991,
    tag: "VIT",
    name: "Vitality",
    trophies: ["BLAST.tv Major Austin 2025", "IEM Katowice 2025", "BLAST Premier World Final 2024", "IEM Dallas 2025"],
    country: "EU",
    accent: "#f5cf3b",
    coachHandle: "XTQZZZ",
    coachRealName: "Remy Quoniam",
    coachCountry: "FR",
    coachStyle: "Discipline",
    coachMaps: 452,
    coachTrophies: 17,
    coachWinrate: 73,
    mapBias: { mirage: 2, inferno: 3, nuke: 2, dust2: 2 },
    players: [
      { handle: "apEX", realName: "Dan Madesclaire", country: "FR", role: "IGL", style: "Aggressive", hltvRating: 1.0 },
      { handle: "ropz", realName: "Robin Kool", country: "EE", role: "Rifler", style: "Passive", hltvRating: 1.16 },
      { handle: "ZywOo", realName: "Mathieu Herbaut", country: "FR", role: "AWP", style: "Balanced", hltvRating: 1.32 },
      { handle: "flameZ", realName: "Shahar Shushan", country: "IL", role: "Entry", style: "Aggressive", hltvRating: 1.14 },
      { handle: "mezii", realName: "William Merriman", country: "UK", role: "Support", style: "Balanced", hltvRating: 1.06 },
    ],
  },
  {
    id: "natus-vincere",
    logoKey: "natus-vincere-2026",
    rank: 2,
    points: 712,
    tag: "NAVI",
    name: "Natus Vincere",
    trophies: ["IEM Atlanta 2026", "ESL Pro League Season 21"],
    country: "UA",
    accent: "#f6d32d",
    coachHandle: "B1ad3",
    coachRealName: "Andrey Gorodenskiy",
    coachCountry: "UA",
    coachStyle: "Tactical",
    coachMaps: 520,
    coachTrophies: 5,
    coachWinrate: 62,
    mapBias: { mirage: 3, nuke: 2, anubis: 3, train: -1 },
    players: [
      { handle: "Aleksib", realName: "Aleksi Virolainen", country: "FI", role: "IGL", style: "Balanced", hltvRating: 0.93 },
      { handle: "iM", realName: "Mihai Ivan", country: "RO", role: "Entry", style: "Aggressive", hltvRating: 1.06 },
      {
        handle: "b1t",
        realName: "Valeriy Vakhovskiy",
        country: "UA",
        role: "Rifler",
        style: "Balanced",
        hltvRating: 1.13,
        samples: {
          overall: { rating: 1.13, maps: 107 },
          top50: { rating: 1.13, maps: 107 },
          top20: { rating: 1.13, maps: 91 },
          top10: { rating: 1.11, maps: 59 },
        },
      },
      {
        handle: "w0nderful",
        realName: "Ihor Zhdanov",
        country: "UA",
        role: "AWP",
        style: "Passive",
        hltvRating: 1.18,
        samples: {
          overall: { rating: 1.18, maps: 68 },
          top50: { rating: 1.18, maps: 68 },
          top20: { rating: 1.16, maps: 60 },
          top10: { rating: 1.15, maps: 38 },
        },
      },
      { handle: "makazze", realName: "Drin Shaqiri", country: "XK", role: "Entry", style: "Aggressive", hltvRating: 1.16 },
    ],
  },
  {
    id: "natus-vincere-2018",
    rosterId: "hltv-natus-vincere-2018",
    logoKey: "natus-vincere-2018",
    era: "CS:GO",
    year: "2018",
    rankingLabel: "2018 NAVI historical CS:GO roster",
    rank: 2,
    points: 850,
    tag: "NAVI",
    name: "Natus Vincere 2018",
    trophies: ["CS:GO Asia Championships 2018", "ESL One Cologne 2018 (Finalist)"],
    country: "UA",
    accent: "#f6d32d",
    coachHandle: "kane",
    coachRealName: "Mykhailo Blagin",
    coachCountry: "UA",
    coachStyle: "Tactical",
    coachMaps: 260,
    coachTrophies: 4,
    coachWinrate: 63,
    mapBias: { mirage: 3, inferno: 2, train: 2, dust2: 1, nuke: 1 },
    note: "Historical lineup: Edward, Zeus, flamie, s1mple, and electronic.",
    players: [
      {
        handle: "s1mple",
        realName: "Oleksandr Kostyliev",
        country: "UA",
        role: "AWP",
        style: "Balanced",
        hltvRating: 1.35,
        samples: {
          overall: { rating: 1.35, maps: 247 },
          top50: { rating: 1.35, maps: 247 },
          top20: { rating: 1.34, maps: 178 },
          top10: { rating: 1.3, maps: 113 },
        },
      },
      {
        handle: "electronic",
        realName: "Denis Sharipov",
        country: "RU",
        role: "Lurker",
        style: "Aggressive",
        hltvRating: 1.2,
        samples: {
          overall: { rating: 1.2, maps: 253 },
          top50: { rating: 1.2, maps: 253 },
          top20: { rating: 1.16, maps: 179 },
          top10: { rating: 1.12, maps: 112 },
        },
      },
      {
        handle: "flamie",
        realName: "Egor Vasilyev",
        country: "RU",
        role: "Entry",
        style: "Aggressive",
        hltvRating: 1.07,
        samples: {
          overall: { rating: 1.07, maps: 247 },
          top50: { rating: 1.07, maps: 247 },
          top20: { rating: 1.04, maps: 175 },
          top10: { rating: 1.02, maps: 113 },
        },
      },
      {
        handle: "Edward",
        realName: "Ioann Sukhariev",
        country: "UA",
        role: "Support",
        style: "Balanced",
        hltvRating: 0.99,
        samples: {
          overall: { rating: 0.99, maps: 244 },
          top50: { rating: 0.99, maps: 244 },
          top20: { rating: 0.98, maps: 175 },
          top10: { rating: 0.95, maps: 113 },
        },
      },
      {
        handle: "Zeus",
        realName: "Danylo Teslenko",
        country: "UA",
        role: "IGL",
        style: "Balanced",
        hltvRating: 0.92,
        samples: {
          overall: { rating: 0.92, maps: 244 },
          top50: { rating: 0.92, maps: 244 },
          top20: { rating: 0.91, maps: 175 },
          top10: { rating: 0.89, maps: 113 },
        },
      },
    ],
  },
  {
    id: "astralis-2018",
    rosterId: "hltv-astralis-2018",
    logoKey: "astralis",
    era: "CS:GO",
    year: "2018",
    rankingLabel: "2018–19 Astralis dynasty (historical CS:GO roster)",
    rank: 2,
    points: 930,
    tag: "AST",
    name: "Astralis 2018",
    trophies: ["FACEIT Major: London 2018", "IEM Katowice Major 2019", "StarLadder Major: Berlin 2019", "Intel Grand Slam Season 1"],
    country: "DK",
    accent: "#d1131a",
    coachHandle: "zonic",
    coachRealName: "Danny Sørensen",
    coachCountry: "DK",
    coachStyle: "Tactical",
    coachMaps: 360,
    coachTrophies: 16,
    coachWinrate: 72,
    mapBias: { nuke: 4, train: 3, inferno: 3, dust2: 2, mirage: 1 },
    note: "Historical dynasty: gla1ve, Xyp9x, dupreeh, device, Magisk — 3 straight Majors (London '18, Katowice '19, Berlin '19).",
    players: [
      {
        handle: "device",
        realName: "Nicolai Reedtz",
        country: "DK",
        role: "AWP",
        style: "Balanced",
        hltvRating: 1.21,
        samples: {
          overall: { rating: 1.2, maps: 210 },
          top50: { rating: 1.2, maps: 210 },
          top20: { rating: 1.19, maps: 156 },
          top10: { rating: 1.18, maps: 104 },
          top5: { rating: 1.16, maps: 58 },
        },
      },
      {
        handle: "Magisk",
        realName: "Emil Reif",
        country: "DK",
        role: "Rifler",
        style: "Balanced",
        hltvRating: 1.17,
        samples: {
          overall: { rating: 1.16, maps: 205 },
          top50: { rating: 1.16, maps: 205 },
          top20: { rating: 1.15, maps: 152 },
          top10: { rating: 1.13, maps: 101 },
        },
      },
      {
        handle: "dupreeh",
        realName: "Peter Rasmussen",
        country: "DK",
        role: "Entry",
        style: "Aggressive",
        hltvRating: 1.13,
        samples: {
          overall: { rating: 1.13, maps: 210 },
          top50: { rating: 1.13, maps: 210 },
          top20: { rating: 1.11, maps: 156 },
          top10: { rating: 1.09, maps: 104 },
        },
      },
      {
        handle: "gla1ve",
        realName: "Lukas Rossander",
        country: "DK",
        role: "IGL",
        style: "Balanced",
        hltvRating: 1.03,
        samples: {
          overall: { rating: 1.03, maps: 210 },
          top50: { rating: 1.03, maps: 210 },
          top20: { rating: 1.02, maps: 156 },
          top10: { rating: 1.0, maps: 104 },
        },
      },
      {
        handle: "Xyp9x",
        realName: "Andreas Højsleth",
        country: "DK",
        role: "Support",
        style: "Passive",
        hltvRating: 1.0,
        statOverrides: { clutch: 90 },
        samples: {
          overall: { rating: 1.0, maps: 210 },
          top50: { rating: 1.0, maps: 210 },
          top20: { rating: 0.99, maps: 156 },
          top10: { rating: 0.98, maps: 104 },
        },
      },
    ],
  },
  {
    id: "luminosity-2016",
    rosterId: "hltv-luminosity-2016",
    logoKey: "mibr",
    era: "CS:GO",
    year: "2016",
    rankingLabel: "2016 Luminosity / SK Brazilian core (historical CS:GO roster)",
    rank: 4,
    points: 805,
    tag: "LG",
    name: "Luminosity 2016",
    trophies: ["MLG Major: Columbus 2016", "ESL One: Cologne 2016"],
    country: "BR",
    accent: "#1f8f4e",
    coachHandle: "zews",
    coachRealName: "Wilton Prado",
    coachCountry: "BR",
    coachStyle: "Tactical",
    coachMaps: 210,
    coachTrophies: 4,
    coachWinrate: 63,
    mapBias: { mirage: 3, train: 2, inferno: 2, dust2: 2, nuke: 1 },
    note: "Historical lineup: FalleN, coldzera, fer, fnx, TACO — back-to-back 2016 Majors (Columbus + Cologne), coldzera MVP both.",
    players: [
      {
        handle: "coldzera",
        realName: "Marcelo David",
        country: "BR",
        role: "Lurker",
        style: "Balanced",
        hltvRating: 1.28,
        statOverrides: { clutch: 93 },
        samples: {
          overall: { rating: 1.25, maps: 120 },
          top50: { rating: 1.25, maps: 120 },
          top20: { rating: 1.27, maps: 92 },
          top10: { rating: 1.29, maps: 62 },
          top5: { rating: 1.31, maps: 36 },
        },
      },
      {
        handle: "FalleN",
        realName: "Gabriel Toledo",
        country: "BR",
        role: "AWP",
        secondaryRole: "IGL", // the Professor: primary AWP (keeps AWP duel profile, no IGL frag debuff)
        style: "Balanced",
        hltvRating: 1.14,
        statOverrides: { igl: 88 },
        samples: {
          overall: { rating: 1.14, maps: 120 },
          top50: { rating: 1.14, maps: 120 },
          top20: { rating: 1.13, maps: 92 },
          top10: { rating: 1.12, maps: 62 },
        },
      },
      {
        handle: "fer",
        realName: "Fernando Alvarenga",
        country: "BR",
        role: "Entry",
        style: "Aggressive",
        hltvRating: 1.13,
        samples: {
          overall: { rating: 1.13, maps: 120 },
          top50: { rating: 1.13, maps: 120 },
          top20: { rating: 1.12, maps: 90 },
          top10: { rating: 1.11, maps: 60 },
        },
      },
      {
        handle: "fnx",
        realName: "Lincoln Lau",
        country: "BR",
        role: "Rifler",
        style: "Aggressive",
        hltvRating: 1.06,
        samples: {
          overall: { rating: 1.05, maps: 118 },
          top50: { rating: 1.05, maps: 118 },
          top20: { rating: 1.06, maps: 88 },
          top10: { rating: 1.08, maps: 58 },
        },
      },
      {
        handle: "TACO",
        realName: "Epitácio Pessoa",
        country: "BR",
        role: "Support",
        style: "Passive",
        hltvRating: 0.92,
        samples: {
          overall: { rating: 0.92, maps: 120 },
          top50: { rating: 0.92, maps: 120 },
          top20: { rating: 0.91, maps: 90 },
          top10: { rating: 0.9, maps: 60 },
        },
      },
    ],
  },
  {
    id: "spirit",
    rank: 3,
    points: 544,
    tag: "SPI",
    name: "Spirit",
    trophies: ["PGL Astana 2025", "PGL Cluj-Napoca 2024"],
    country: "RU",
    accent: "#79b8ff",
    coachHandle: "hally",
    coachRealName: "Sergey Shavaev",
    coachCountry: "RU",
    coachStyle: "Discipline",
    coachMaps: 430,
    coachTrophies: 6,
    coachWinrate: 64,
    mapBias: { dust2: 3, mirage: 2, nuke: 1, ancient: 2 },
    players: [
      { handle: "sh1ro", realName: "Dmitry Sokolov", country: "RU", role: "AWP", style: "Passive", hltvRating: 1.18 },
      { handle: "magixx", realName: "Boris Vorobiev", country: "RU", role: "Support", secondaryRole: "IGL", style: "Balanced", hltvRating: 1.01 },
      { handle: "tN1R", realName: "Andrey Tatarinovich", country: "BY", role: "Rifler", style: "Aggressive", hltvRating: 1.09 },
      { handle: "zont1x", realName: "Myroslav Plakhotia", country: "UA", role: "Lurker", style: "Passive", hltvRating: 1.03 },
      // HLTV #1 of 2024 (top-2 of 2025) with monster big-event numbers — belongs at the OVR ceiling.
      // Stat overrides reflect his all-round dominance incl. genuine hybrid AWP use.
      { handle: "donk", realName: "Danil Kryshkovets", country: "RU", role: "Entry", style: "Aggressive", hltvRating: 1.45, statOverrides: { aim: 99, clutch: 99, consistency: 99, awp: 92, igl: 82 } },
    ],
  },
  {
    id: "falcons",
    rank: 4,
    points: 509,
    tag: "FLC",
    name: "Falcons",
    country: "EU",
    accent: "#3fbf72",
    coachHandle: "zonic",
    coachRealName: "Danny Sorensen",
    coachCountry: "DK",
    coachStyle: "Tactical",
    coachMaps: 439,
    coachTrophies: 1,
    coachWinrate: 54,
    mapBias: { nuke: 2, dust2: 3, anubis: 1, inferno: -1 },
    players: [
      { handle: "karrigan", realName: "Finn Andersen", country: "DK", role: "IGL", style: "Balanced", hltvRating: 0.72, statOverrides: { igl: 90 } },
      { handle: "NiKo", realName: "Nikola Kovac", country: "BA", role: "Rifler", style: "Aggressive", hltvRating: 1.13, statOverrides: { aim: 91, clutch: 88, consistency: 88, awp: 70, igl: 72 } },
      { handle: "TeSeS", realName: "Rene Madsen", country: "DK", role: "Support", style: "Balanced", hltvRating: 1.03 },
      { handle: "m0NESY", realName: "Ilya Osipov", country: "RU", role: "AWP", style: "Aggressive", hltvRating: 1.26 },
      { handle: "kyousuke", realName: "Maxim Lukin", country: "RU", role: "Entry", style: "Aggressive", hltvRating: 1.16 },
    ],
  },
  {
    id: "furia",
    rank: 5,
    points: 393,
    tag: "FUR",
    name: "FURIA",
    country: "BR",
    accent: "#f2f4f7",
    coachHandle: "sidde",
    coachRealName: "Sid Macedo",
    coachCountry: "BR",
    coachStyle: "Aggressive",
    coachMaps: 346,
    coachTrophies: 4,
    coachWinrate: 58,
    mapBias: { inferno: 2, mirage: 2, train: 2, dust2: 1 },
    players: [
      { handle: "FalleN", realName: "Gabriel Toledo", country: "BR", role: "IGL", style: "Passive", hltvRating: 0.98 },
      { handle: "yuurih", realName: "Yuri Santos", country: "BR", role: "Rifler", style: "Balanced", hltvRating: 1.16 },
      { handle: "YEKINDAR", realName: "Mareks Galinskis", country: "LV", role: "Entry", style: "Aggressive", hltvRating: 1.08 },
      { handle: "KSCERATO", realName: "Kaike Cerato", country: "BR", role: "Rifler", style: "Passive", hltvRating: 1.19 },
      { handle: "molodoy", realName: "Danil Golubenko", country: "KZ", role: "AWP", style: "Balanced", hltvRating: 1.14 },
    ],
  },
  {
    id: "aurora",
    rank: 6,
    points: 354,
    tag: "AUR",
    name: "Aurora",
    country: "TR",
    accent: "#22c7c7",
    coachHandle: "Fabre",
    coachRealName: "Sezgin Kalayci",
    coachCountry: "TR",
    coachStyle: "Aggressive",
    coachMaps: 241,
    coachTrophies: 1,
    coachWinrate: 55,
    mapBias: { anubis: 3, dust2: 2, mirage: 2, inferno: 1 },
    players: [
      { handle: "MAJ3R", realName: "Engin Kupeli", country: "TR", role: "IGL", style: "Balanced", hltvRating: 0.89 },
      { handle: "XANTARES", realName: "Ismailcan Dortkardes", country: "TR", role: "Rifler", style: "Aggressive", hltvRating: 1.15 },
      { handle: "woxic", realName: "Ozgur Eker", country: "TR", role: "AWP", style: "Passive", hltvRating: 1.05 },
      { handle: "soulfly", realName: "Caner Kesici", country: "TR", role: "Support", style: "Balanced", hltvRating: 1.01 },
      { handle: "Wicadia", realName: "Ali Haydar Yalcin", country: "TR", role: "Entry", style: "Aggressive", hltvRating: 1.12 },
    ],
  },
  {
    id: "mouz",
    rank: 7,
    points: 301,
    tag: "MOUZ",
    name: "MOUZ",
    trophies: ["ESL Pro League Season 20"],
    country: "EU",
    accent: "#ef4444",
    coachHandle: "sycrone",
    coachRealName: "Dennis Nielsen",
    coachCountry: "DK",
    coachStyle: "Tactical",
    coachMaps: 540,
    coachTrophies: 3,
    coachWinrate: 59,
    mapBias: { mirage: 2, nuke: 2, ancient: 3, train: 1 },
    players: [
      { handle: "torzsi", realName: "Adam Torzsas", country: "HU", role: "AWP", style: "Balanced", hltvRating: 1.1 },
      { handle: "Spinx", realName: "Lotan Giladi", country: "IL", role: "Rifler", style: "Passive", hltvRating: 1.12 },
      { handle: "xertioN", realName: "Dorian Berman", country: "IL", role: "Entry", style: "Aggressive", hltvRating: 1.09 },
      { handle: "xelex", realName: "Adrian Vincze", country: "HU", role: "Rifler", style: "Aggressive", hltvRating: 1.04 },
      { handle: "Brollan", realName: "Ludvig Brolin", country: "SE", role: "IGL", style: "Balanced", hltvRating: 1.05 },
    ],
  },
  {
    id: "legacy",
    rank: 8,
    points: 297,
    tag: "LEG",
    name: "Legacy",
    country: "BR",
    accent: "#4ade80",
    coachHandle: "adrrr",
    coachRealName: "Adriano Machado",
    coachCountry: "BR",
    coachStyle: "Aggressive",
    coachMaps: 48,
    coachTrophies: 1,
    coachWinrate: 69,
    mapBias: { dust2: 2, ancient: 1, inferno: 2, mirage: 1 },
    players: [
      { handle: "arT", realName: "Andrei Piovezan", country: "BR", role: "IGL", style: "Aggressive", hltvRating: 0.98 },
      { handle: "dumau", realName: "Eduardo Wolkmer", country: "BR", role: "Rifler", style: "Balanced", hltvRating: 1.19 },
      { handle: "latto", realName: "Bruno Rebelatto", country: "BR", role: "Entry", style: "Aggressive", hltvRating: 1.18 },
      { handle: "n1ssim", realName: "Guilherme Nascimento", country: "BR", role: "Support", style: "Balanced", hltvRating: 1.02 },
      { handle: "saadzin", realName: "Saad Ghonem", country: "BR", role: "AWP", style: "Passive", hltvRating: 1.09 },
    ],
  },
  {
    id: "the-mongolz",
    rank: 9,
    points: 260,
    tag: "MGLZ",
    name: "The MongolZ",
    country: "MN",
    accent: "#f59e0b",
    coachHandle: "maaRaa",
    coachRealName: "Erdenedalai Bayanbat",
    coachCountry: "MN",
    coachStyle: "Discipline",
    coachMaps: 593,
    coachTrophies: 2,
    coachWinrate: 59,
    mapBias: { ancient: 3, mirage: 1, nuke: 2, anubis: 2 },
    players: [
      { handle: "bLitz", realName: "Garidmagnai Byambasuren", country: "MN", role: "IGL", style: "Aggressive", hltvRating: 1.08 },
      { handle: "Techno", realName: "Sodbayar Munkhbold", country: "MN", role: "Support", style: "Balanced", hltvRating: 1.02 },
      { handle: "mzinho", realName: "Ayush Batbold", country: "MN", role: "Rifler", style: "Balanced", hltvRating: 1.05 },
      { handle: "910", realName: "Usukhbayar Banzragch", country: "MN", role: "AWP", style: "Passive", hltvRating: 1.12 },
      { handle: "cobrazera", realName: "Unudelger Baasanjargal", country: "MN", role: "Entry", style: "Aggressive", hltvRating: 1.02 },
    ],
  },
  {
    id: "parivision",
    rank: 10,
    points: 259,
    tag: "PARI",
    name: "PARIVISION",
    country: "RU",
    accent: "#9ca3af",
    coachHandle: "dastan",
    coachRealName: "Dastan Akbayev",
    coachCountry: "KZ",
    coachStyle: "Tactical",
    coachMaps: 450,
    coachTrophies: 1,
    coachWinrate: 60,
    mapBias: { mirage: 1, nuke: 2, anubis: 1, train: 2 },
    players: [
      { handle: "Jame", realName: "Dzhami Ali", country: "RU", role: "AWP", style: "Passive", hltvRating: 1.13 },
      { handle: "BELCHONOKK", realName: "Andrey Yasinskiy", country: "RU", role: "Rifler", style: "Balanced", hltvRating: 1.07 },
      { handle: "xiELO", realName: "Aleksey Zhilkin", country: "RU", role: "Entry", style: "Aggressive", hltvRating: 1.06 },
      { handle: "nota", realName: "Emil Moskvitin", country: "RU", role: "Support", style: "Balanced", hltvRating: 1.04 },
      { handle: "zweih", realName: "Ivan Gogin", country: "RU", role: "Rifler", style: "Passive", hltvRating: 1.08 },
    ],
  },
  {
    id: "gamerlegion",
    rank: 11,
    points: 259,
    tag: "GL",
    name: "GamerLegion",
    country: "EU",
    accent: "#60a5fa",
    coachHandle: "imd",
    coachRealName: "Adrian Pieper",
    coachCountry: "DE",
    coachStyle: "Discipline",
    coachMaps: 100,
    coachTrophies: 0,
    coachWinrate: 57,
    mapBias: { anubis: 2, ancient: 2, mirage: 1, train: 1 },
    players: [
      { handle: "Snax", realName: "Janusz Pogorzelski", country: "PL", role: "IGL", style: "Passive", hltvRating: 0.89 },
      { handle: "REZ", realName: "Fredrik Sterner", country: "SE", role: "Rifler", style: "Aggressive", hltvRating: 1.12 },
      { handle: "Tauson", realName: "Sebastian Lindelof", country: "DK", role: "Entry", style: "Balanced", hltvRating: 1.03 },
      { handle: "PR", realName: "Oldrich Novy", country: "CZ", role: "Rifler", style: "Aggressive", hltvRating: 1.1 },
      { handle: "hypex", realName: "Sebastian Rasmussen", country: "DK", role: "AWP", style: "Passive", hltvRating: 1.02 },
    ],
  },
  {
    id: "astralis",
    rank: 12,
    points: 214,
    tag: "AST",
    name: "Astralis",
    country: "DK",
    accent: "#ef4444",
    coachHandle: "ruggah",
    coachRealName: "Casper Due",
    coachCountry: "DK",
    coachStyle: "Discipline",
    coachMaps: 260,
    coachTrophies: 0,
    coachWinrate: 55,
    mapBias: { nuke: 3, inferno: 2, ancient: 1, dust2: -1 },
    players: [
      { handle: "HooXi", realName: "Rasmus Nielsen", country: "DK", role: "IGL", style: "Balanced", hltvRating: 0.88 },
      { handle: "phzy", realName: "Love Smidebrant", country: "SE", role: "AWP", style: "Passive", hltvRating: 1.05 },
      { handle: "jabbi", realName: "Jakob Nygaard", country: "DK", role: "Rifler", style: "Balanced", hltvRating: 1.08 },
      { handle: "Staehr", realName: "Victor Staehr", country: "DK", role: "Entry", style: "Aggressive", hltvRating: 1.1 },
      { handle: "ryu", realName: "Rasmus Lynge", country: "DK", role: "Support", style: "Balanced", hltvRating: 1.01 },
    ],
  },
  {
    id: "g2",
    rank: 13,
    points: 206,
    tag: "G2",
    name: "G2",
    country: "EU",
    accent: "#9ca3af",
    coachHandle: "sAw",
    coachRealName: "Eetu Saha",
    coachCountry: "FI",
    coachStyle: "Tactical",
    coachMaps: 209,
    coachTrophies: 1,
    coachWinrate: 55,
    mapBias: { mirage: 2, dust2: 2, anubis: 1, train: 1 },
    players: [
      { handle: "huNter-", realName: "Nemanja Kovac", country: "BA", role: "IGL", style: "Balanced", hltvRating: 1.1 },
      { handle: "NertZ", realName: "Guy Iluz", country: "IL", role: "Entry", style: "Aggressive", hltvRating: 1.15 },
      { handle: "SunPayus", realName: "Alvaro Garcia", country: "ES", role: "AWP", style: "Passive", hltvRating: 1.08 },
      // star support: plays the support role but frags like a rifler — no support debuff
      { handle: "HeavyGod", realName: "Nikita Martynenko", country: "IL", role: "Support", fragSupport: true, style: "Aggressive", hltvRating: 1.16 },
      { handle: "MATYS", realName: "Matus Simko", country: "SK", role: "Lurker", style: "Aggressive", hltvRating: 1.12 },
    ],
  },
  {
    id: "fut",
    rank: 14,
    points: 190,
    tag: "FUT",
    name: "FUT",
    country: "EU",
    accent: "#f97316",
    coachHandle: "coolio",
    coachRealName: "Andras Fercsak",
    coachCountry: "HU",
    coachStyle: "Tactical",
    coachMaps: 231,
    coachTrophies: 1,
    coachWinrate: 60,
    mapBias: { ancient: 2, anubis: 2, inferno: 1, train: 1 },
    players: [
      {
        handle: "dem0n",
        realName: "Dmytro Myroshnychenko",
        country: "UA",
        role: "Entry",
        style: "Aggressive",
        hltvRating: 1.11,
        samples: {
          overall: { rating: 1.11, maps: 231 },
          top50: { rating: 1.08, maps: 72 },
          top20: { rating: 1.05, maps: 27 },
          top10: { rating: 1.01, maps: 12 },
        },
      },
      {
        handle: "lauNX",
        realName: "Laurentiu Tarlea",
        country: "RO",
        role: "Rifler",
        style: "Aggressive",
        hltvRating: 1.1,
        samples: {
          overall: { rating: 1.1, maps: 231 },
          top50: { rating: 1.07, maps: 66 },
          top20: { rating: 1.05, maps: 26 },
          top10: { rating: 1.02, maps: 11 },
        },
      },
      {
        handle: "Krabeni",
        realName: "Aulon Fazlija",
        country: "XK",
        role: "IGL",
        style: "Balanced",
        hltvRating: 1.05,
        samples: {
          overall: { rating: 1.05, maps: 231 },
          top50: { rating: 1.03, maps: 72 },
          top20: { rating: 1.01, maps: 27 },
          top10: { rating: 0.98, maps: 12 },
        },
      },
      {
        handle: "cmtry",
        realName: "Nikita Samolotov",
        country: "UA",
        role: "AWP",
        style: "Balanced",
        hltvRating: 1.03,
        samples: {
          overall: { rating: 1.03, maps: 231 },
          top50: { rating: 1.02, maps: 72 },
          top20: { rating: 1.01, maps: 27 },
          top10: { rating: 0.98, maps: 12 },
        },
      },
      {
        handle: "dziugss",
        realName: "Dziugas Steponavicius",
        country: "LT",
        role: "Lurker",
        style: "Passive",
        hltvRating: 1.11,
        samples: {
          overall: { rating: 1.11, maps: 231 },
          top50: { rating: 1.08, maps: 70 },
          top20: { rating: 1.04, maps: 26 },
          top10: { rating: 1.0, maps: 12 },
        },
      },
    ],
  },
  {
    id: "b8",
    rank: 15,
    points: 179,
    tag: "B8",
    name: "B8",
    country: "UA",
    accent: "#60a5fa",
    coachHandle: "maddened",
    coachRealName: "Ivan Iordanidi",
    coachCountry: "RU",
    coachStyle: "Discipline",
    coachMaps: 895,
    coachTrophies: 0,
    coachWinrate: 55,
    mapBias: { nuke: 2, ancient: 1, anubis: 2, dust2: 1 },
    players: [
      { handle: "alex666", realName: "Alexey Yarmoshchuk", country: "UA", role: "IGL", style: "Balanced", hltvRating: 1.04 },
      { handle: "npl", realName: "Andrii Kukharskyi", country: "UA", role: "Entry", style: "Aggressive", hltvRating: 1.16 },
      { handle: "kensizor", realName: "Artem Kapran", country: "UA", role: "Rifler", style: "Balanced", hltvRating: 1.03 },
      { handle: "esenthial", realName: "Dmytro Tsvir", country: "UA", role: "Support", style: "Passive", hltvRating: 0.98 },
      { handle: "s1zzi", realName: "Danylo Vinnyk", country: "UA", role: "AWP", style: "Passive", hltvRating: 0.99 },
    ],
  },
  {
    id: "faze",
    rank: 16,
    points: 171,
    tag: "FAZE",
    name: "FaZe",
    country: "EU",
    accent: "#d1d5db",
    coachHandle: "enkay J",
    coachRealName: "Niclas Krumhorn",
    coachCountry: "DE",
    coachStyle: "Tactical",
    coachMaps: 180,
    coachTrophies: 0,
    coachWinrate: 52,
    mapBias: { mirage: 2, dust2: 2, nuke: 1, ancient: 1 },
    note: "Twistzz is modeled as the caller, with Neityu as the French support stand-in.",
    players: [
      {
        handle: "frozen",
        realName: "David Cernansky",
        country: "SK",
        role: "Lurker",
        style: "Passive",
        hltvRating: 1.22,
        statOverrides: {
          aim: 88,
          clutch: 93,
          consistency: 88,
          awp: 75,
          igl: 75,
        },
        samples: {
          overall: { rating: 1.22, maps: 54 },
          top50: { rating: 1.2, maps: 54 },
          top20: { rating: 1.16, maps: 36 },
          top10: { rating: 1.12, maps: 20 },
        },
      },
      {
        handle: "Twistzz",
        realName: "Russel Van Dulken",
        country: "CA",
        role: "IGL",
        style: "Balanced",
        hltvRating: 1.17,
        recentRating: 1.2,
        samples: {
          overall: { rating: 1.17, maps: 130 },
          top50: { rating: 1.17, maps: 120 },
          top20: { rating: 1.16, maps: 100 },
          top10: { rating: 1.15, maps: 70 },
        },
      },
      { handle: "broky", realName: "Helvijs Saukants", country: "LV", role: "AWP", style: "Passive", hltvRating: 1.08 },
      { handle: "jcobbb", realName: "Jakub Pietruszewski", country: "PL", role: "Entry", style: "Aggressive", hltvRating: 0.98 },
      { handle: "Neityu", realName: "Ryan Aubry", country: "FR", role: "Support", style: "Balanced", hltvRating: 1.06 },
    ],
  },
  {
    id: "betboom",
    rank: 17,
    points: 145,
    tag: "BB",
    name: "BetBoom",
    country: "RU",
    accent: "#fbbf24",
    coachHandle: "Fierce",
    coachRealName: "Artem Ivanov",
    coachCountry: "RU",
    coachStyle: "Aggressive",
    coachMaps: 134,
    coachTrophies: 0,
    coachWinrate: 64,
    mapBias: { dust2: 2, mirage: 1, ancient: 2, train: 1 },
    players: [
      { handle: "Boombl4", realName: "Kirill Mikhailov", country: "RU", role: "IGL", style: "Aggressive", hltvRating: 0.98 },
      { handle: "zorte", realName: "Aleksandr Zagodyrenko", country: "RU", role: "AWP", style: "Passive", hltvRating: 0.98 },
      { handle: "S1ren", realName: "Pavel Ogloblin", country: "RU", role: "Support", style: "Passive", hltvRating: 1.06 },
      { handle: "d1Ledez", realName: "Daniil Kustov", country: "RU", role: "Entry", style: "Aggressive", hltvRating: 1.1 },
      { handle: "Magnojez", realName: "Danil Arzanov", country: "RU", role: "Rifler", style: "Balanced", hltvRating: 1.16 },
    ],
  },
  {
    id: "magic",
    rank: 18,
    points: 135,
    tag: "MAG",
    name: "magic",
    country: "EU",
    accent: "#a78bfa",
    coachHandle: "eksiver",
    coachRealName: "Danila Yurkov",
    coachCountry: "RU",
    coachStyle: "Aggressive",
    coachMaps: 34,
    coachTrophies: 0,
    coachWinrate: 62,
    mapBias: { anubis: 2, mirage: 1, inferno: 1, train: 2 },
    players: [
      { handle: "MaSvAl", realName: "Svyatoslav Masko", country: "BY", role: "Rifler", style: "Aggressive", hltvRating: 1.17 },
      { handle: "sFade8", realName: "Vitaliy Marushka", country: "UA", role: "Support", style: "Passive", hltvRating: 0.95 },
      { handle: "AW", realName: "Anton Wartsev", country: "RU", role: "AWP", style: "Balanced", hltvRating: 1.05 },
      { handle: "mo0N", realName: "Artur Ponomarev", country: "RU", role: "IGL", style: "Balanced", hltvRating: 1.05 },
      { handle: "tenzy", realName: "Nikita Kochenyuk", country: "RU", role: "Entry", style: "Aggressive", hltvRating: 1.19 },
    ],
  },
  {
    id: "pain",
    rank: 19,
    points: 128,
    tag: "PAIN",
    name: "paiN",
    country: "BR",
    accent: "#ef4444",
    coachHandle: "rikz",
    coachRealName: "Henrique Waku",
    coachCountry: "BR",
    coachStyle: "Discipline",
    coachMaps: 1062,
    coachTrophies: 0,
    coachWinrate: 61,
    mapBias: { nuke: 2, ancient: 2, dust2: 1, inferno: 1 },
    players: [
      { handle: "vsm", realName: "Vinicius Moreira", country: "BR", role: "Rifler", style: "Aggressive", hltvRating: 1.0 },
      { handle: "biguzera", realName: "Rodrigo Bittencourt", country: "BR", role: "IGL", style: "Balanced", hltvRating: 1.12 },
      { handle: "piriajr", realName: "Joao Pedro", country: "BR", role: "Entry", style: "Aggressive", hltvRating: 1.05 },
      { handle: "saffee", realName: "Rafael Costa", country: "BR", role: "AWP", style: "Passive", hltvRating: 1.03 },
      { handle: "snow", realName: "Joao Vinicius", country: "BR", role: "Support", style: "Balanced", hltvRating: 1.01 },
    ],
  },
  {
    id: "mibr",
    rank: 20,
    points: 124,
    tag: "MIBR",
    name: "MIBR",
    country: "BR",
    accent: "#f8fafc",
    coachHandle: "LETN1",
    coachRealName: "Nestor Tanic",
    coachCountry: "RS",
    coachStyle: "Tactical",
    coachMaps: 92,
    coachTrophies: 0,
    coachWinrate: 68,
    mapBias: { mirage: 2, anubis: 1, train: 2, ancient: 1 },
    players: [
      {
        handle: "LNZ",
        realName: "Linus Holtang",
        country: "SE",
        role: "IGL",
        style: "Balanced",
        hltvRating: 1.02,
        samples: {
          overall: { rating: 1.02, maps: 111 },
          top50: { rating: 0.97, maps: 38 },
          top20: { rating: 0.91, maps: 12 },
          top10: { rating: 0.88, maps: 4 },
        },
      },
      {
        handle: "brnz4n",
        realName: "Breno Poletto",
        country: "BR",
        role: "Support",
        style: "Balanced",
        hltvRating: 1.08,
        samples: {
          overall: { rating: 1.08, maps: 792 },
          top50: { rating: 1.0, maps: 51 },
          top20: { rating: 0.95, maps: 18 },
          top10: { rating: 0.9, maps: 6 },
        },
      },
      {
        handle: "insani",
        realName: "Felipe Yuji",
        country: "BR",
        role: "Entry",
        style: "Aggressive",
        hltvRating: 1.2,
        samples: {
          overall: { rating: 1.2, maps: 736 },
          top50: { rating: 1.09, maps: 64 },
          top20: { rating: 1.01, maps: 21 },
          top10: { rating: 0.96, maps: 7 },
        },
      },
      {
        handle: "venomzera",
        realName: "Vinicius Santos",
        country: "BR",
        role: "Rifler",
        style: "Passive",
        hltvRating: 1.06,
        samples: {
          overall: { rating: 1.06, maps: 92 },
          top50: { rating: 1.0, maps: 41 },
          top20: { rating: 0.96, maps: 15 },
          top10: { rating: 0.91, maps: 5 },
        },
      },
      {
        handle: "kl1m",
        realName: "Klim Sazonov",
        country: "RU",
        role: "AWP",
        style: "Passive",
        hltvRating: 1.23,
        samples: {
          overall: { rating: 1.23, maps: 159 },
          top50: { rating: 1.13, maps: 62 },
          top20: { rating: 1.04, maps: 18 },
          top10: { rating: 0.98, maps: 6 },
        },
      },
    ],
  },
];

export const hltvTop20Rosters: Roster[] = hltvTeams.map(makeHltvRoster);
export const hltvTop20Coaches: Coach[] = hltvTeams.map(makeHltvCoach);
