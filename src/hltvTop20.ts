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
import { teamLogoUrls } from "./teamLogos";

type CoachStyle = Coach["style"];
type RatingFilter = "top10" | "top20" | "top50" | "overall";

interface RatingSample {
  rating: number;
  maps: number;
}

interface HltvPlayerSeed {
  handle: string;
  realName: string;
  country: string;
  role: Role;
  style: Style;
  hltvRating: number;
  samples?: Partial<Record<RatingFilter, RatingSample>>;
  recentRating?: number;
}

interface HltvTeamSeed {
  id: string;
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
}

const ids = mapPool.map((map) => map.id) as MapId[];
const ratingFilters: RatingFilter[] = ["top10", "top20", "top50", "overall"];
const requiredMaps: Record<RatingFilter, number> = {
  top10: 20,
  top20: 30,
  top50: 45,
  overall: 60,
};
const filterWeights: Record<RatingFilter, number> = {
  top10: 0.4,
  top20: 0.35,
  top50: 0.15,
  overall: 0.1,
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

  const rankPressure = (team.rank - 1) / 19;
  const factor =
    filter === "top50"
      ? 0.68 - rankPressure * 0.23
      : filter === "top20"
        ? 0.46 - rankPressure * 0.22
        : 0.29 - rankPressure * 0.17;
  const rankLift = Math.max(0, 21 - team.rank) * (filter === "top50" ? 0.9 : filter === "top20" ? 0.45 : 0.18);
  return Math.round(clampNumber(base * factor + rankLift, 3, filter === "top50" ? 88 : filter === "top20" ? 56 : 36));
}

function inferRating(player: HltvPlayerSeed, team: HltvTeamSeed, filter: RatingFilter) {
  if (filter === "overall") return clampRating(player.hltvRating);

  const rankPressure = (team.rank - 1) / 19;
  const baseDrop =
    filter === "top10" ? 0.015 + rankPressure * 0.09 : filter === "top20" ? 0.006 + rankPressure * 0.065 : 0.002 + rankPressure * 0.028;
  const starResilience = Math.max(0, player.hltvRating - 1.12) * (filter === "top10" ? 0.08 : filter === "top20" ? 0.06 : 0.035);
  const roleResilience =
    player.role === "AWP"
      ? filter === "top10"
        ? 0.006
        : 0.004
      : player.role === "IGL"
        ? -0.006
        : player.role === "Entry"
          ? -0.002
          : player.role === "Lurker"
            ? 0.002
            : 0;
  return clampRating(player.hltvRating - baseDrop + starResilience + roleResilience);
}

function ratingSample(player: HltvPlayerSeed, team: HltvTeamSeed, filter: RatingFilter): RatingSample {
  const explicit = player.samples?.[filter];
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
  const rankValue = (21 - team.rank) / 20;
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
  const recentRating = player.recentRating ?? oppositionAdjustedRating(player, team) * 0.65 + player.hltvRating * 0.35;
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

  return {
    aim: clampWhole(card + ratingLift + styleAim + (player.role === "Entry" ? 4 : player.role === "IGL" ? -4 : player.role === "Support" ? -2 : player.role === "Rifler" ? 2 : 1), 50, 99),
    clutch: clampWhole(card + ratingLift + stylePatience + (player.role === "Lurker" ? 5 : player.role === "AWP" ? 2 : player.role === "Rifler" ? 1 : player.role === "Entry" ? -1 : 0), 50, 99),
    consistency: clampWhole(card + (teamContextRating(team) - 1) * 18 + (player.role === "Support" ? 4 : player.role === "Lurker" ? 3 : player.role === "IGL" ? 3 : player.role === "Entry" ? -2 : 0), 50, 99),
    awp: clampWhole(
      player.role === "AWP" ? card + 8 : player.role === "Rifler" ? card - 11 : player.role === "Entry" ? card - 15 : player.role === "Lurker" ? card - 13 : card - 18,
      45,
      99,
    ),
    igl: clampWhole(
      player.role === "IGL" ? card + 10 : player.role === "Support" ? card + 1 : player.role === "Lurker" ? card - 5 : player.role === "Rifler" ? card - 9 : card - 14,
      45,
      99,
    ),
  };
}

function traitsFor(player: HltvPlayerSeed, stats: PlayerStats) {
  const traits = new Set<string>();
  traits.add(player.role === "AWP" ? "Sniper" : player.role === "IGL" ? "Brain" : player.role === "Lurker" ? "Late round" : player.role);
  if (player.hltvRating >= 1.16) traits.add("Star");
  if (stats.clutch >= 88) traits.add("Clutch");
  if (player.style === "Aggressive") traits.add("Entry");
  if (player.style === "Passive") traits.add("Anchor");
  traits.add(`HLTV ${player.hltvRating.toFixed(2)}`);
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

function makeRoster(team: HltvTeamSeed): Roster {
  const source: SourceTeam = {
    tag: team.tag,
    name: team.name,
    country: team.country,
    era: "CS2",
    year: "2026",
    accent: team.accent,
    logo: teamLogoUrls[team.id],
  };
  const maps = teamMapPool(team);

  return {
    id: `hltv-${team.id}-2026-06-08`,
    ...source,
    tagline: `HLTV #${team.rank} on June 8, 2026 with ${team.points} points. OVR is opposition, role, sample-size, recent-form, and team-context adjusted.${team.note ? ` ${team.note}` : ""}`,
    mapPool: maps,
    players: team.players.map((player, index) => {
      const stats = statsFromHltv(player, team);
      return {
        id: `hltv-${team.id}-${slugify(player.handle)}`,
        handle: player.handle,
        realName: player.realName,
        country: player.country,
        role: player.role,
        style: player.style,
        traits: traitsFor(player, stats),
        stats,
        ovr: rateStatsForRole(stats, player.role),
        hltvRating: player.hltvRating,
        hltvMaps: ratingSample(player, team, "overall").maps,
        source,
        maps: playerMapPool(index, player, team, maps),
      };
    }),
  };
}

function coachRating(team: HltvTeamSeed) {
  const averagePlayerRating = team.players.reduce((sum, player) => sum + player.hltvRating, 0) / team.players.length;
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

function makeCoach(team: HltvTeamSeed): Coach {
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
    rank: 2,
    points: 712,
    tag: "NAVI",
    name: "Natus Vincere",
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
      { handle: "makazze", realName: "Drin Shaqiri", country: "XK", role: "Rifler", style: "Aggressive", hltvRating: 1.16 },
    ],
  },
  {
    id: "spirit",
    rank: 3,
    points: 544,
    tag: "SPI",
    name: "Spirit",
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
      { handle: "magixx", realName: "Boris Vorobiev", country: "RU", role: "Support", style: "Balanced", hltvRating: 1.01 },
      { handle: "tN1R", realName: "Andrey Tatarinovich", country: "BY", role: "Rifler", style: "Aggressive", hltvRating: 1.09 },
      { handle: "zont1x", realName: "Myroslav Plakhotia", country: "UA", role: "Support", style: "Passive", hltvRating: 1.03 },
      { handle: "donk", realName: "Danil Kryshkovets", country: "RU", role: "Entry", style: "Aggressive", hltvRating: 1.28 },
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
      { handle: "karrigan", realName: "Finn Andersen", country: "DK", role: "IGL", style: "Balanced", hltvRating: 0.72 },
      { handle: "NiKo", realName: "Nikola Kovac", country: "BA", role: "Rifler", style: "Aggressive", hltvRating: 1.13 },
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
      { handle: "xelex", realName: "Adrian Vincze", country: "HU", role: "Rifler", style: "Aggressive", hltvRating: 1.18 },
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
    coachHandle: "TaZ",
    coachRealName: "Wiktor Wojtas",
    coachCountry: "PL",
    coachStyle: "Tactical",
    coachMaps: 360,
    coachTrophies: 2,
    coachWinrate: 57,
    mapBias: { mirage: 2, dust2: 2, anubis: 1, train: 1 },
    players: [
      { handle: "huNter-", realName: "Nemanja Kovac", country: "BA", role: "IGL", style: "Balanced", hltvRating: 0.97 },
      { handle: "NertZ", realName: "Guy Iluz", country: "IL", role: "Entry", style: "Aggressive", hltvRating: 1.15 },
      { handle: "SunPayus", realName: "Alvaro Garcia", country: "ES", role: "AWP", style: "Passive", hltvRating: 1.08 },
      { handle: "HeavyGod", realName: "Nikita Martynenko", country: "IL", role: "Rifler", style: "Balanced", hltvRating: 1.08 },
      { handle: "MATYS", realName: "Matus Simko", country: "SK", role: "Rifler", style: "Aggressive", hltvRating: 1.12 },
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

export const hltvTop20Rosters: Roster[] = hltvTeams.map(makeRoster);
export const hltvTop20Coaches: Coach[] = hltvTeams.map(makeCoach);
