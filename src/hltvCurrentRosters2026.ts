import type { Player, Roster, SourceTeam } from "./gameData";
import { hltvRanked27To50Coaches, hltvRanked27To50Rosters } from "./hltvRanked27To50";
import { hltvRosterAdditionCoaches, hltvRosterAdditions } from "./hltvRosterAdditions";
import { makeHltvRoster, type HltvPlayerSeed, type HltvTeamSeed } from "./hltvTop20";
import { hltvTop20Coaches, hltvTop20Rosters } from "./hltvTop20";

interface CurrentRosterSnapshot {
  name: string;
  rank: number;
  points: number;
  players: string[];
  note?: string;
}

// HLTV July 20 ranking order/points and July 23 live starter lists. Teams below #50 remain in the
// database at their current displayed rank so the previous playable pool is not silently removed.
const currentRosterSnapshot: CurrentRosterSnapshot[] = [
  { name: "Falcons", rank: 1, points: 902, players: ["karrigan", "NiKo", "TeSeS", "m0NESY", "kyousuke"] },
  { name: "Vitality", rank: 2, points: 779, players: ["apEX", "ropz", "ZywOo", "flameZ", "mezii"] },
  { name: "FURIA", rank: 3, points: 671, players: ["FalleN", "yuurih", "YEKINDAR", "KSCERATO", "molodoy"] },
  { name: "Spirit", rank: 4, points: 669, players: ["sh1ro", "magixx", "tN1R", "zont1x", "donk"] },
  { name: "Natus Vincere", rank: 5, points: 502, players: ["Aleksib", "iM", "b1t", "w0nderful", "makazze"] },
  { name: "9z", rank: 6, points: 370, players: ["max", "dgt", "meyern", "luchov", "HUASOPEEK"] },
  { name: "Aurora", rank: 7, points: 364, players: ["XANTARES", "woxic", "Jimpphat", "kyxsan", "Wicadia"] },
  { name: "G2", rank: 8, points: 318, players: ["huNter-", "NertZ", "r1nkle", "HeavyGod", "MATYS"] },
  { name: "BetBoom", rank: 9, points: 317, players: ["Boombl4", "zorte", "S1ren", "d1Ledez", "Magnojez"] },
  { name: "Legacy", rank: 10, points: 233, players: ["arT", "dumau", "latto", "n1ssim", "try"] },
  { name: "MOUZ", rank: 11, points: 229, players: ["torzsi", "Spinx", "xertioN", "PR", "xelex"] },
  { name: "FUT", rank: 12, points: 207, players: ["xfl0ud", "dem0n", "Krabeni", "cmtry", "dziugss"] },
  { name: "B8", rank: 13, points: 187, players: ["alex666", "npl", "kensizor", "esenthial", "s1zzi"] },
  { name: "PARIVISION", rank: 14, points: 185, players: ["HObbit", "Jame", "xiELO", "zweih", "slaxejezzz"] },
  { name: "The MongolZ", rank: 15, points: 168, players: ["bLitz", "Techno", "910", "tikuak", "DarkMeister"] },
  {
    name: "FaZe",
    rank: 16,
    points: 163,
    players: ["frozen", "Twistzz", "jcobbb", "JBOEN", "Neityu"],
    note: "Neityu is retained as the reported stand-in while FaZe's official profile lists four starters.",
  },
  { name: "GamerLegion", rank: 17, points: 159, players: ["Snax", "REZ", "Tauson", "FL4MUS", "hypex"] },
  { name: "Astralis", rank: 18, points: 146, players: ["HooXi", "phzy", "jabbi", "Staehr", "ryu"] },
  { name: "TYLOO", rank: 19, points: 134, players: ["JamYoung", "Jee", "Mercury", "Moseyuh", "Zero"] },
  { name: "magic", rank: 20, points: 123, players: ["MaSvAl", "sFade8", "AW", "mo0N", "tenzy"] },
  { name: "BIG", rank: 21, points: 112, players: ["tabseN", "JDC", "faveN", "blameF", "gr1ks"] },
  { name: "Luminosity", rank: 22, points: 111, players: ["Rainwaker", "Bymas", "afro", "lux", "AZUWU"] },
  { name: "MIBR", rank: 23, points: 107, players: ["LNZ", "nqz", "brnz4n", "insani", "venomzera"] },
  { name: "paiN", rank: 24, points: 102, players: ["vsm", "biguzera", "piriajr", "saffee", "snow"] },
  { name: "Alliance", rank: 25, points: 96, players: ["twist", "eraa", "bobeksde", "upE", "avid"] },
  { name: "M80", rank: 26, points: 93, players: ["slaxz-", "Swisher", "s1n", "JBa", "Lake"] },
  { name: "Ninjas in Pyjamas", rank: 27, points: 85, players: ["Snappi", "stavn", "sjuush", "n0te", "xKacpersky"] },
  { name: "HEROIC", rank: 28, points: 70, players: ["Brollan", "nilo", "susp", "MartinezSa", "Chr1zN"] },
  { name: "Sharks", rank: 29, points: 67, players: ["gafolo", "koala", "maxxkor", "rdnzao", "doc"] },
  {
    name: "FlyQuest",
    rank: 30,
    points: 65,
    players: ["jks", "INS", "Vexite", "nettik", "Gratisfaction"],
    note: "Gratisfaction fills the open AWP slot as FlyQuest's current stand-in; story transferred to SAW.",
  },
  { name: "Liquid", rank: 31, points: 65, players: ["NAF", "EliGE", "malbsMd", "siuhy", "Jorko"] },
  { name: "Inner Circle", rank: 32, points: 65, players: ["cptkurtka023", "headtr1ck", "zeRRoFIX", "onic", "Dawy"] },
  { name: "Nemesis", rank: 33, points: 65, players: ["SELLTER", "r3salt", "mag1k3Y", "tex1y", "Sdaim"] },
  { name: "3DMAX", rank: 34, points: 59, players: ["Maka", "Lucky", "misutaaa", "Kursy", "Graviti"] },
  { name: "Lynn Vision", rank: 35, points: 56, players: ["Westmelon", "z4KR", "Starry", "EmiliaQAQ", "C4LLM3SU3"] },
  { name: "EYEBALLERS", rank: 36, points: 49, players: ["JW", "KRIMZ", "maxster", "Ro1f", "dex"] },
  { name: "NRG", rank: 37, points: 46, players: ["nitr0", "Sonic", "hallzerk", "Grim", "Jeorge"] },
  { name: "K27", rank: 38, points: 44, players: ["clax", "X5G7V", "xeedo", "kashl1d", "qw1nk1"] },
  {
    name: "Gentle Mates",
    rank: 39,
    points: 37,
    players: ["alex", "mopoz", "sausol", "dav1g", "CRUC1AL"],
    note: "CRUC1AL is the current event stand-in after MartinezSa transferred to HEROIC.",
  },
  { name: "Echo", rank: 40, points: 32, players: ["IceBerg", "salazar", "leakz", "Boye", "NickyB"] },
  { name: "Virtus.pro", rank: 41, points: 32, players: ["mir", "b1st", "F0R3VER", "AquaRS", "tO0RO"] },
  { name: "Acend", rank: 42, points: 30, players: ["SPELLAN", "REDSTAR", "KalubeR", "h4rn", "Skrimo"] },
  { name: "SINNERS", rank: 43, points: 27, players: ["beastik", "SHOCK", "MoDo", "kisserek", "stressarN"] },
  { name: "Nuclear TigeRES", rank: 44, points: 25, players: ["senka", "m1QUSE", "z1k4", "flouzer", "ayuki"] },
  { name: "HOTU", rank: 45, points: 25, players: ["n0rb3r7", "kade0", "mizu", "dwushka", "frontales"] },
  { name: "THUNDER dOWNUNDER", rank: 46, points: 23, players: ["dexter", "Liazz", "aliStair", "asap", "TjP"] },
  { name: "Imperial", rank: 47, points: 23, players: ["chelo", "VINI", "decenty", "noway", "saadzin"] },
  { name: "TDK", rank: 48, points: 23, players: ["Ax1Le", "nafany", "BELCHONOKK", "fame", "ArtFr0st"] },
  { name: "Fluxo", rank: 50, points: 21, players: ["exit", "dav1deuS", "zevy", "kye", "Ltz"] },
  { name: "Walczaki", rank: 54, points: 20, players: ["SaMey", "bajmi", "sk1tt", "olimp", "moonwalk"] },
  { name: "LP", rank: 55, points: 19, players: ["zmb", "Leomonster", "Alisson", "happ", "divine"] },
  { name: "FOKUS", rank: 58, points: 19, players: ["ztr", "Banjo", "podi", "jocab", "Matheos"] },
  { name: "100 Thieves", rank: 60, points: 18, players: ["device", "rain", "Gizmy", "sirah", "poiii"] },
  { name: "INFINITE", rank: 62, points: 17, players: ["kreaz", "Blytz", "Dytor", "volt", "sl3nd"] },
  { name: "Wildcard", rank: 77, points: 13, players: ["nEMANHA", "mhL", "Cxzi", "reck", "HexT"] },
  { name: "BC.Game", rank: 200, points: 3, players: ["s1mple", "electroNic", "Magisk", "Senzu", "mzinho"] },
];

function player(
  handle: string,
  realName: string,
  country: string,
  role: HltvPlayerSeed["role"],
  style: HltvPlayerSeed["style"],
  hltvRating: number,
  maps: number,
  fragSupport = false,
  options: Pick<HltvPlayerSeed, "statOverrides"> = {},
): HltvPlayerSeed {
  return {
    handle,
    realName,
    country,
    role,
    style,
    hltvRating,
    fragSupport: fragSupport || undefined,
    samples: { overall: { rating: hltvRating, maps } },
    ...options,
  };
}

const supplementalPlayerSeed: HltvTeamSeed = {
  id: "current-player-bank",
  rank: 50,
  points: 21,
  tag: "CUR",
  name: "Current Player Bank",
  country: "INT",
  accent: "#70839b",
  coachHandle: "—",
  coachRealName: "—",
  coachCountry: "INT",
  coachStyle: "Discipline",
  coachMaps: 0,
  coachTrophies: 0,
  coachWinrate: 50,
  mapBias: {},
  players: [
    player("Jimpphat", "Jimi Salo", "FI", "Lurker", "Balanced", 1.14, 9, false, {
      statOverrides: { aim: 81, clutch: 80, consistency: 79, awp: 50, igl: 52 },
    }),
    player("kyxsan", "Damjan Stoilkovski", "MK", "IGL", "Balanced", 1.01, 9, false, {
      statOverrides: { aim: 67, clutch: 69, consistency: 74, awp: 47, igl: 80 },
    }),
    player("r1nkle", "Artem Moroz", "UA", "AWP", "Passive", 0.85, 3),
    player("try", "Santino Rigal", "AR", "AWP", "Passive", 1.13, 16),
    player("DarkMeister", "Dugarsuren Ireedui", "MN", "Entry", "Aggressive", 1.0, 0),
    player("tikuak", "Zolbayar Chimedtseren", "MN", "Rifler", "Aggressive", 1.0, 0),
    player("HObbit", "Abay Khassenov", "KZ", "Lurker", "Balanced", 0.9, 15),
    player("slaxejezzz", "Vyacheslav Vinokurov", "RU", "Entry", "Aggressive", 1.05, 15),
    player("FL4MUS", "Timur Marev", "RU", "Entry", "Aggressive", 1.08, 38),
    player("xfl0ud", "Yasin Koç", "TR", "Support", "Balanced", 1.51, 3, true),
    player("JBOEN", "Jason Boe Nielsen", "DK", "AWP", "Passive", 1.17, 16),
    player("podi", "Paavo Heiskanen", "FI", "AWP", "Passive", 1.01, 8),
    player("jocab", "Jacob Nerheden", "SE", "Rifler", "Balanced", 0.89, 8),
    player("ArtFr0st", "Artem Kharitonov", "RU", "AWP", "Passive", 1.15, 79),
    player("fame", "Petr Bolyshev", "RU", "Lurker", "Balanced", 1.0, 0),
    player("nqz", "Lucas Soares", "BR", "AWP", "Passive", 1.1, 185),
    player("Gratisfaction", "Sean Kaiwai", "NZ", "AWP", "Passive", 1.01, 758),
    player("CRUC1AL", "Joey Steusel", "NL", "AWP", "Passive", 1.07, 1180),
  ],
};

const supplementalPlayers = makeHltvRoster(supplementalPlayerSeed).players;
const sourceRosters = [...hltvTop20Rosters, ...hltvRanked27To50Rosters, ...hltvRosterAdditions];
const currentSourceRosters = sourceRosters.filter((roster) => roster.era === "CS2");
const historicalRosters = sourceRosters.filter((roster) => roster.era !== "CS2");

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function playerId(team: Roster, handle: string) {
  return `hltv-${normalize(team.name)}-${normalize(handle)}`;
}

function currentSource(team: Roster): SourceTeam {
  return {
    tag: team.tag,
    name: team.name,
    country: team.country,
    era: team.era,
    year: team.year,
    accent: team.accent,
    logo: team.logo,
  };
}

function reconcileCurrentRosters() {
  const rostersByName = new Map(currentSourceRosters.map((roster) => [normalize(roster.name), roster]));
  const playersByHandle = new Map<string, Player>();
  for (const roster of currentSourceRosters) {
    for (const sourcePlayer of roster.players) playersByHandle.set(normalize(sourcePlayer.handle), sourcePlayer);
  }
  for (const sourcePlayer of supplementalPlayers) playersByHandle.set(normalize(sourcePlayer.handle), sourcePlayer);

  return currentRosterSnapshot.map((snapshot) => {
    const team = rostersByName.get(normalize(snapshot.name));
    if (!team) throw new Error(`Missing source roster for ${snapshot.name}`);
    const source = currentSource(team);
    const players = snapshot.players.map((handle) => {
      const sourcePlayer = playersByHandle.get(normalize(handle));
      if (!sourcePlayer) throw new Error(`Missing current player data for ${snapshot.name}: ${handle}`);
      return {
        ...sourcePlayer,
        id: playerId(team, handle),
        source,
      };
    });
    return {
      ...team,
      sourceRank: snapshot.rank,
      rank: snapshot.rank,
      vrsPoints: snapshot.points,
      players,
      tagline: `HLTV #${snapshot.rank} on July 20, 2026 with ${snapshot.points} points. Active lineup verified July 23, 2026.${snapshot.note ? ` ${snapshot.note}` : ""}`,
    };
  });
}

export const hltvCurrentRosters2026: Roster[] = [...reconcileCurrentRosters(), ...historicalRosters];
export const hltvCurrentCoaches2026 = [
  ...hltvTop20Coaches,
  ...hltvRanked27To50Coaches,
  ...hltvRosterAdditionCoaches,
];

export const hltvCurrentRosterSnapshot2026 = currentRosterSnapshot;
