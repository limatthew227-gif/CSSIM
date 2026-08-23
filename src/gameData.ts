export type Role = "IGL" | "AWP" | "Entry" | "Lurker" | "Rifler" | "Support";
export type Style = "Aggressive" | "Balanced" | "Passive";
export type Era = "CS 1.6" | "CS:Source" | "CS:GO" | "CS2";
export type MapId =
  | "mirage"
  | "inferno"
  | "nuke"
  | "ancient"
  | "anubis"
  | "dust2"
  | "train";

export interface PlayerStats {
  aim: number;
  clutch: number;
  consistency: number;
  awp: number;
  igl: number;
}

export interface SourceTeam {
  tag: string;
  name: string;
  country: string;
  era: Era;
  year: string;
  accent: string;
  logo?: string;
}

export interface PlayoffNerves {
  /** Fractional performance penalty at the start of the save (0.08 = 8%). */
  initialPenalty: number;
  /** Player age when the trait was assigned, used to measure career time elapsed. */
  baselineAge: number;
  /** Fraction of the penalty removed per in-game year. */
  fadePerYear: number;
}

export interface Player {
  id: string;
  handle: string;
  realName: string;
  country: string;
  role: Role;
  // A second job the player also does (e.g. an AWP who also IGLs, like FalleN). It counts toward team
  // composition / role coverage, but NOT the fragging weights — so a star AWP-IGL keeps his AWP duel
  // profile and does NOT take the IGL fragging debuff.
  secondaryRole?: Role;
  // A Support who frags like a rifler (e.g. a star support such as HeavyGod). Keeps the Support role
  // for composition/utility/display, but his stats, OVR and fragging weights are rifler-grade — i.e.
  // NO support debuff.
  fragSupport?: boolean;
  style: Style;
  traits: string[];
  // A persistent negative trait used only in playoff maps. Career mode advances player age by half a
  // year per Major, so the penalty naturally fades as the player gains playoff experience.
  playoffNerves?: PlayoffNerves;
  stats: PlayerStats;
  ovr: number;
  hltvRating?: number;
  hltvMaps?: number;
  source: SourceTeam;
  maps: Record<MapId, number>;
  // Verified roster-snapshot age when available. Career mode uses it to set the development ceiling
  // and only synthesizes an age for players whose source profile does not expose one.
  age?: number;
  potential?: number;
  // Save-local career metadata version. Source roster players omit this; drafted/signed copies persist it.
  potentialModelVersion?: number;
}

export interface Roster extends SourceTeam {
  id: string;
  tagline: string;
  players: Player[];
  mapPool: Record<MapId, number>;
  /** Rank from the roster's source snapshot, before mixed-era display sorting. */
  sourceRank?: number;
  rank?: number;
  vrsPoints?: number;
  trophies?: string[]; // notable titles this roster has won (for the team profile)
}

export interface Coach {
  id: string;
  handle: string;
  realName: string;
  country: string;
  style: "Tactical" | "Aggressive" | "Discipline";
  rating: number;
  text: string;
}

export interface MapInfo {
  id: MapId;
  name: string;
  lane: string;
  accent: string;
}

export interface Difficulty {
  id: "normal" | "hard" | "legend";
  label: string;
  opponentBonus: number;
  luck: number;
}

export interface CustomSettings {
  brand: string;
  accent: string;
  draftRolls: number;
  rolePenalty: number;
  mapWeight: number;
  luck: number;
  tacticalPauses: boolean;
}

export const defaultSettings: CustomSettings = {
  brand: "Major Draft Lab",
  accent: "#65a7ff",
  draftRolls: 2,
  rolePenalty: 6,
  mapWeight: 1,
  luck: 0.32,
  tacticalPauses: false,
};

export const difficulties: Difficulty[] = [
  { id: "normal", label: "Normal", opponentBonus: 0, luck: 0.34 },
  { id: "hard", label: "Hard", opponentBonus: 4, luck: 0.26 },
  { id: "legend", label: "Legend", opponentBonus: 8, luck: 0.2 },
];

export const mapPool: MapInfo[] = [
  { id: "mirage", name: "Mirage", lane: "mid control", accent: "#d6a85f" },
  { id: "inferno", name: "Inferno", lane: "banana pressure", accent: "#d86b56" },
  { id: "nuke", name: "Nuke", lane: "vertical reads", accent: "#6fb8c9" },
  { id: "ancient", name: "Ancient", lane: "temple defaults", accent: "#82b366" },
  { id: "anubis", name: "Anubis", lane: "canal fights", accent: "#a78bfa" },
  { id: "dust2", name: "Dust2", lane: "long picks", accent: "#d9c36f" },
  { id: "train", name: "Train", lane: "yard trades", accent: "#8fb0bd" },
];

const ids = mapPool.map((map) => map.id) as MapId[];

// Per-role weighting of the five stats that produces a player's OVR. Single source of truth so the
// balance debugger can explain an OVR from the SAME weights the rating uses.
export const roleStatWeights: Record<Role, PlayerStats> = {
  AWP: { aim: 0.29, clutch: 0.16, consistency: 0.14, awp: 0.38, igl: 0.03 },
  IGL: { aim: 0.2, clutch: 0.16, consistency: 0.25, awp: 0.03, igl: 0.36 },
  Entry: { aim: 0.47, clutch: 0.19, consistency: 0.26, awp: 0.04, igl: 0.04 },
  Lurker: { aim: 0.29, clutch: 0.32, consistency: 0.29, awp: 0.04, igl: 0.06 },
  Rifler: { aim: 0.43, clutch: 0.22, consistency: 0.27, awp: 0.04, igl: 0.04 },
  Support: { aim: 0.28, clutch: 0.24, consistency: 0.38, awp: 0.04, igl: 0.06 },
};

export type StatKey = keyof PlayerStats;

export interface OvrStatContribution {
  stat: StatKey;
  rating: number; // the player's raw stat value (0..100)
  weight: number; // this role's weight on that stat
  contribution: number; // rating * weight — how many OVR points it adds
}

export interface OvrBreakdown {
  role: Role;
  contributions: OvrStatContribution[]; // sorted high → low contribution
  ovr: number; // rounded sum (== rateStatsForRole)
}

const STAT_KEYS: StatKey[] = ["aim", "clutch", "consistency", "awp", "igl"];

export function ovrBreakdown(stats: PlayerStats, role: Role): OvrBreakdown {
  const weight = roleStatWeights[role];
  const contributions = STAT_KEYS.map((stat) => ({
    stat,
    rating: stats[stat],
    weight: weight[stat],
    contribution: stats[stat] * weight[stat],
  })).sort((a, b) => b.contribution - a.contribution);
  const total = contributions.reduce((sum, entry) => sum + entry.contribution, 0);
  return { role, contributions, ovr: Math.round(total) };
}

export function rateStatsForRole(stats: PlayerStats, role: Role) {
  return ovrBreakdown(stats, role).ovr;
}

function mapValues(seed: number, base: number[]) {
  return ids.reduce(
    (acc, mapId, index) => {
      acc[mapId] = Math.max(62, Math.min(96, base[index] + ((seed + index * 7) % 7) - 3));
      return acc;
    },
    {} as Record<MapId, number>,
  );
}

function makeRoster(
  id: string,
  source: SourceTeam,
  tagline: string,
  baseMaps: number[],
  players: Array<Omit<Player, "id" | "ovr" | "source" | "maps">>,
): Roster {
  const mapPoolForTeam = mapValues(id.length * 9, baseMaps);
  return {
    id,
    ...source,
    tagline,
    mapPool: mapPoolForTeam,
    players: players.map((player, index) => ({
      ...player,
      id: `${id}-${player.handle.toLowerCase()}`,
      source,
      maps: mapValues(index * 11 + id.length, baseMaps),
      ovr: rateStatsForRole(player.stats, player.role),
    })),
  };
}

export const rosters: Roster[] = [
  makeRoster(
    "sao-paulo-storm",
    { tag: "SPS", name: "Sao Paulo Storm", country: "BR", era: "CS2", year: "2026", accent: "#36d399" },
    "A fearless Brazilian mix built around late-round trades.",
    [84, 86, 78, 80, 82, 88, 76],
    [
      {
        handle: "Vanta",
        realName: "Mateus Rocha",
        country: "BR",
        role: "Entry",
        style: "Aggressive",
        traits: ["Entry", "Aim"],
        stats: { aim: 91, clutch: 81, consistency: 84, awp: 58, igl: 55 },
      },
      {
        handle: "Melo",
        realName: "Andre Melo",
        country: "BR",
        role: "IGL",
        style: "Balanced",
        traits: ["Brain"],
        stats: { aim: 80, clutch: 83, consistency: 86, awp: 56, igl: 92 },
      },
      {
        handle: "Kobra",
        realName: "Renan Costa",
        country: "BR",
        role: "AWP",
        style: "Passive",
        traits: ["Sniper", "Clutch"],
        stats: { aim: 88, clutch: 87, consistency: 83, awp: 92, igl: 51 },
      },
      {
        handle: "Nico",
        realName: "Nicolas Araujo",
        country: "BR",
        role: "Support",
        style: "Passive",
        traits: ["Anchor"],
        stats: { aim: 81, clutch: 78, consistency: 88, awp: 55, igl: 62 },
      },
      {
        handle: "Razeiro",
        realName: "Lucas Paiva",
        country: "BR",
        role: "Rifler",
        style: "Balanced",
        traits: ["Trade"],
        stats: { aim: 86, clutch: 82, consistency: 85, awp: 60, igl: 58 },
      },
    ],
  ),
  makeRoster(
    "copenhagen-system",
    { tag: "CPH", name: "Copenhagen System", country: "DK", era: "CS:GO", year: "2018", accent: "#ff6b6b" },
    "A disciplined machine with elite utility and mid-round calls.",
    [83, 91, 94, 79, 75, 82, 88],
    [
      {
        handle: "Axis",
        realName: "Lukas Brandt",
        country: "DK",
        role: "IGL",
        style: "Balanced",
        traits: ["Brain", "Utility"],
        stats: { aim: 84, clutch: 86, consistency: 91, awp: 58, igl: 95 },
      },
      {
        handle: "Rune",
        realName: "Rune Moller",
        country: "DK",
        role: "AWP",
        style: "Balanced",
        traits: ["Sniper", "Clutch"],
        stats: { aim: 93, clutch: 91, consistency: 90, awp: 95, igl: 54 },
      },
      {
        handle: "Mads",
        realName: "Mads Vester",
        country: "DK",
        role: "Entry",
        style: "Aggressive",
        traits: ["Entry", "Trade"],
        stats: { aim: 90, clutch: 84, consistency: 87, awp: 59, igl: 56 },
      },
      {
        handle: "Anchor",
        realName: "Jonas Holm",
        country: "DK",
        role: "Support",
        style: "Passive",
        traits: ["Anchor", "Clutch"],
        stats: { aim: 87, clutch: 90, consistency: 92, awp: 60, igl: 64 },
      },
      {
        handle: "North",
        realName: "Emil Lund",
        country: "DK",
        role: "Rifler",
        style: "Balanced",
        traits: ["Aim", "Trade"],
        stats: { aim: 89, clutch: 85, consistency: 88, awp: 61, igl: 58 },
      },
    ],
  ),
  makeRoster(
    "kyiv-comets",
    { tag: "KYC", name: "Kyiv Comets", country: "UA", era: "CS2", year: "2025", accent: "#facc15" },
    "High-skill stars who can turn broken rounds into highlight reels.",
    [90, 80, 84, 88, 83, 86, 76],
    [
      {
        handle: "Lumen",
        realName: "Oleksii Hrytsenko",
        country: "UA",
        role: "AWP",
        style: "Balanced",
        traits: ["Sniper", "Aim"],
        stats: { aim: 94, clutch: 88, consistency: 87, awp: 96, igl: 52 },
      },
      {
        handle: "Vega",
        realName: "Viktor Bondar",
        country: "UA",
        role: "Rifler",
        style: "Aggressive",
        traits: ["Aim"],
        stats: { aim: 92, clutch: 84, consistency: 83, awp: 62, igl: 57 },
      },
      {
        handle: "Dart",
        realName: "Danylo Teresh",
        country: "UA",
        role: "Entry",
        style: "Aggressive",
        traits: ["Entry"],
        stats: { aim: 88, clutch: 82, consistency: 82, awp: 57, igl: 55 },
      },
      {
        handle: "Sable",
        realName: "Serhii Novak",
        country: "UA",
        role: "Support",
        style: "Passive",
        traits: ["Utility"],
        stats: { aim: 81, clutch: 84, consistency: 88, awp: 55, igl: 66 },
      },
      {
        handle: "Kross",
        realName: "Kirill Moroz",
        country: "UA",
        role: "IGL",
        style: "Balanced",
        traits: ["Brain"],
        stats: { aim: 79, clutch: 80, consistency: 86, awp: 56, igl: 90 },
      },
    ],
  ),
  makeRoster(
    "stockholm-ninjas",
    { tag: "NIN", name: "Stockholm Ninjas", country: "SE", era: "CS 1.6", year: "2003", accent: "#7dd3fc" },
    "Old-school structure, pristine trading, and icy pistol rounds.",
    [88, 84, 78, 74, 70, 90, 82],
    [
      {
        handle: "Pine",
        realName: "Erik Lind",
        country: "SE",
        role: "Rifler",
        style: "Balanced",
        traits: ["Aim", "Clutch"],
        stats: { aim: 90, clutch: 89, consistency: 88, awp: 64, igl: 61 },
      },
      {
        handle: "Frost",
        realName: "Oskar Dahl",
        country: "SE",
        role: "AWP",
        style: "Passive",
        traits: ["Sniper"],
        stats: { aim: 88, clutch: 87, consistency: 86, awp: 91, igl: 53 },
      },
      {
        handle: "Byte",
        realName: "Anton Sjolin",
        country: "SE",
        role: "IGL",
        style: "Balanced",
        traits: ["Brain"],
        stats: { aim: 78, clutch: 82, consistency: 88, awp: 55, igl: 91 },
      },
      {
        handle: "Grit",
        realName: "Mikael Berg",
        country: "SE",
        role: "Entry",
        style: "Aggressive",
        traits: ["Entry"],
        stats: { aim: 86, clutch: 81, consistency: 82, awp: 56, igl: 55 },
      },
      {
        handle: "Warden",
        realName: "Johan Wall",
        country: "SE",
        role: "Support",
        style: "Passive",
        traits: ["Anchor"],
        stats: { aim: 80, clutch: 84, consistency: 89, awp: 58, igl: 63 },
      },
    ],
  ),
  makeRoster(
    "paris-source",
    { tag: "PRS", name: "Paris Source", country: "FR", era: "CS:Source", year: "2012", accent: "#c084fc" },
    "Precision aimers with a Source-era read on every late lurk.",
    [89, 83, 72, 80, 78, 87, 73],
    [
      {
        handle: "Pulse",
        realName: "Adrien Morel",
        country: "FR",
        role: "Entry",
        style: "Aggressive",
        traits: ["Aim", "Entry"],
        stats: { aim: 94, clutch: 82, consistency: 82, awp: 58, igl: 52 },
      },
      {
        handle: "Scope",
        realName: "Theo Martin",
        country: "FR",
        role: "AWP",
        style: "Balanced",
        traits: ["Sniper"],
        stats: { aim: 91, clutch: 87, consistency: 84, awp: 94, igl: 54 },
      },
      {
        handle: "Lurk",
        realName: "Cedric Roux",
        country: "FR",
        role: "Support",
        style: "Passive",
        traits: ["Lurk", "Clutch"],
        stats: { aim: 85, clutch: 89, consistency: 86, awp: 61, igl: 65 },
      },
      {
        handle: "Script",
        realName: "Kevin Rolland",
        country: "FR",
        role: "IGL",
        style: "Balanced",
        traits: ["Brain"],
        stats: { aim: 79, clutch: 80, consistency: 85, awp: 55, igl: 93 },
      },
      {
        handle: "Volt",
        realName: "Maxime Garnier",
        country: "FR",
        role: "Rifler",
        style: "Balanced",
        traits: ["Trade"],
        stats: { aim: 88, clutch: 84, consistency: 84, awp: 59, igl: 58 },
      },
    ],
  ),
  makeRoster(
    "dallas-cloud",
    { tag: "DLC", name: "Dallas Cloud", country: "US", era: "CS:GO", year: "2018", accent: "#60a5fa" },
    "Momentum players with a scary ceiling when the crowd wakes up.",
    [86, 79, 75, 82, 81, 91, 77],
    [
      {
        handle: "Ace",
        realName: "Ryan Carter",
        country: "US",
        role: "AWP",
        style: "Balanced",
        traits: ["Sniper", "Clutch"],
        stats: { aim: 90, clutch: 89, consistency: 83, awp: 92, igl: 52 },
      },
      {
        handle: "Rush",
        realName: "Tyler Stone",
        country: "US",
        role: "Entry",
        style: "Aggressive",
        traits: ["Entry"],
        stats: { aim: 86, clutch: 80, consistency: 84, awp: 56, igl: 56 },
      },
      {
        handle: "Nerve",
        realName: "Jack Collins",
        country: "US",
        role: "IGL",
        style: "Balanced",
        traits: ["Brain"],
        stats: { aim: 80, clutch: 84, consistency: 86, awp: 56, igl: 89 },
      },
      {
        handle: "Slate",
        realName: "Michael Grey",
        country: "US",
        role: "Support",
        style: "Passive",
        traits: ["Utility"],
        stats: { aim: 82, clutch: 81, consistency: 87, awp: 55, igl: 64 },
      },
      {
        handle: "Spark",
        realName: "Josh Reed",
        country: "US",
        role: "Rifler",
        style: "Aggressive",
        traits: ["Aim"],
        stats: { aim: 88, clutch: 82, consistency: 82, awp: 60, igl: 58 },
      },
    ],
  ),
  makeRoster(
    "istanbul-fire",
    { tag: "IST", name: "Istanbul Fire", country: "TR", era: "CS:GO", year: "2021", accent: "#fb7185" },
    "Explosive openers and fearless retakes on high-contact maps.",
    [88, 85, 80, 78, 76, 86, 82],
    [
      {
        handle: "Aslan",
        realName: "Emir Kaya",
        country: "TR",
        role: "Entry",
        style: "Aggressive",
        traits: ["Entry", "Aim"],
        stats: { aim: 92, clutch: 83, consistency: 83, awp: 57, igl: 54 },
      },
      {
        handle: "Peak",
        realName: "Arda Demir",
        country: "TR",
        role: "AWP",
        style: "Aggressive",
        traits: ["Sniper"],
        stats: { aim: 90, clutch: 86, consistency: 81, awp: 91, igl: 50 },
      },
      {
        handle: "Metro",
        realName: "Can Yildiz",
        country: "TR",
        role: "IGL",
        style: "Balanced",
        traits: ["Brain"],
        stats: { aim: 79, clutch: 81, consistency: 86, awp: 55, igl: 88 },
      },
      {
        handle: "Mira",
        realName: "Berk Aydin",
        country: "TR",
        role: "Rifler",
        style: "Balanced",
        traits: ["Trade"],
        stats: { aim: 87, clutch: 82, consistency: 83, awp: 60, igl: 57 },
      },
      {
        handle: "Smoke",
        realName: "Deniz Sahin",
        country: "TR",
        role: "Support",
        style: "Passive",
        traits: ["Utility"],
        stats: { aim: 80, clutch: 79, consistency: 86, awp: 56, igl: 63 },
      },
    ],
  ),
  makeRoster(
    "seoul-mechanics",
    { tag: "SEO", name: "Seoul Mechanics", country: "KR", era: "CS2", year: "2026", accent: "#22d3ee" },
    "Fast rotations, clean protocols, and late-round patience.",
    [82, 78, 86, 90, 87, 79, 84],
    [
      {
        handle: "Kairo",
        realName: "Min Jae Park",
        country: "KR",
        role: "IGL",
        style: "Balanced",
        traits: ["Brain", "Utility"],
        stats: { aim: 81, clutch: 82, consistency: 89, awp: 57, igl: 91 },
      },
      {
        handle: "Jett",
        realName: "Ji Hoon Kim",
        country: "KR",
        role: "Entry",
        style: "Aggressive",
        traits: ["Entry"],
        stats: { aim: 89, clutch: 80, consistency: 82, awp: 56, igl: 55 },
      },
      {
        handle: "Lens",
        realName: "Hyun Woo Lee",
        country: "KR",
        role: "AWP",
        style: "Passive",
        traits: ["Sniper"],
        stats: { aim: 88, clutch: 84, consistency: 86, awp: 90, igl: 52 },
      },
      {
        handle: "Patch",
        realName: "Sung Min Choi",
        country: "KR",
        role: "Support",
        style: "Passive",
        traits: ["Anchor"],
        stats: { aim: 82, clutch: 83, consistency: 89, awp: 56, igl: 66 },
      },
      {
        handle: "Orbit",
        realName: "Jun Seo Han",
        country: "KR",
        role: "Rifler",
        style: "Balanced",
        traits: ["Trade"],
        stats: { aim: 86, clutch: 82, consistency: 85, awp: 60, igl: 58 },
      },
    ],
  ),
];

export const coaches: Coach[] = [
  {
    id: "scribe",
    handle: "Scribe",
    realName: "Tomas Vale",
    country: "PT",
    style: "Tactical",
    rating: 84,
    text: "Boosts map picks and softens IGL gaps.",
  },
  {
    id: "sparkplug",
    handle: "Sparkplug",
    realName: "Noah Beck",
    country: "CA",
    style: "Aggressive",
    rating: 81,
    text: "Adds punch to T sides and opening duels.",
  },
  {
    id: "ledger",
    handle: "Ledger",
    realName: "Mikkel Nygaard",
    country: "DK",
    style: "Discipline",
    rating: 88,
    text: "Stabilizes economy rounds and late leads.",
  },
  {
    id: "oxide",
    handle: "Oxide",
    realName: "Rafael Nunes",
    country: "BR",
    style: "Aggressive",
    rating: 79,
    text: "Turns low buys into chaotic brawls.",
  },
  {
    id: "rivet",
    handle: "Rivet",
    realName: "Ari Chen",
    country: "US",
    style: "Tactical",
    rating: 82,
    text: "Improves veto reads and mid-round calls.",
  },
];
