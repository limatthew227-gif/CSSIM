import type { Player } from "./gameData";
import type { Site } from "./roundAI";

export type MiragePlanId =
  | "a-execute"
  | "a-split"
  | "b-execute"
  | "b-split"
  | "mid-to-a"
  | "mid-to-b"
  | "contact-b";

export type MirageJob = "entry" | "trader" | "support" | "awper" | "lurker";
export type MirageCallStyle = "standard" | "aggressive" | "cautious";
export type MirageEconomy = "ECO" | "FORCE" | "FULL";

export interface MiragePlan {
  id: MiragePlanId;
  label: string;
  site: Site;
  pace: "contact" | "default" | "execute";
  utilityNeed: number;
  routes: Record<MirageJob, string[]>;
}

export interface MiragePlanContext {
  tactic: MirageCallStyle;
  economy: MirageEconomy;
  utilityCount: number;
}

const A_PALACE = ["palace", "asite"];
const A_RAMP = ["palacealley", "tramp", "scaffolding", "asite"];
const A_MID = ["sidealley", "topmid", "mid", "connector", "asite"];
const B_APPS = ["sidealley", "house", "backalley", "bapps", "van", "bsite"];
const B_SHORT = ["sidealley", "topmid", "mid", "catwalk", "bsite"];
const MID = ["sidealley", "topmid", "mid"];
const UNDERPASS = ["sidealley", "topmid", "mid", "underpass"];
const UNDER_TO_APPS = ["sidealley", "topmid", "mid", "underpass", "backalley", "bapps"];

export const miragePlans: MiragePlan[] = [
  {
    id: "a-execute",
    label: "A execute",
    site: "asite",
    pace: "execute",
    utilityNeed: 5,
    routes: { entry: A_RAMP, trader: A_RAMP, support: A_RAMP, awper: A_PALACE, lurker: MID },
  },
  {
    id: "a-split",
    label: "A connector split",
    site: "asite",
    pace: "default",
    utilityNeed: 4,
    routes: { entry: A_MID, trader: A_MID, support: A_RAMP, awper: MID, lurker: A_PALACE },
  },
  {
    id: "b-execute",
    label: "B apartments execute",
    site: "bsite",
    pace: "execute",
    utilityNeed: 5,
    routes: { entry: B_APPS, trader: B_APPS, support: B_APPS, awper: MID, lurker: UNDER_TO_APPS },
  },
  {
    id: "b-split",
    label: "B short split",
    site: "bsite",
    pace: "default",
    utilityNeed: 4,
    routes: { entry: B_APPS, trader: B_SHORT, support: B_APPS, awper: MID, lurker: UNDER_TO_APPS },
  },
  {
    id: "mid-to-a",
    label: "Mid control into A",
    site: "asite",
    pace: "default",
    utilityNeed: 3,
    routes: { entry: A_MID, trader: A_MID, support: A_RAMP, awper: MID, lurker: A_PALACE },
  },
  {
    id: "mid-to-b",
    label: "Mid control into B",
    site: "bsite",
    pace: "default",
    utilityNeed: 3,
    routes: { entry: B_SHORT, trader: B_SHORT, support: B_APPS, awper: MID, lurker: UNDER_TO_APPS },
  },
  {
    id: "contact-b",
    label: "Contact B",
    site: "bsite",
    pace: "contact",
    utilityNeed: 1,
    routes: { entry: B_APPS, trader: B_APPS, support: B_APPS, awper: MID, lurker: UNDERPASS },
  },
];

export function selectMiragePlan(context: MiragePlanContext, random = Math.random): MiragePlan {
  const weighted = miragePlans.map((plan) => ({ plan, weight: planWeight(plan, context) }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.plan;
  }
  return weighted[weighted.length - 1].plan;
}

export function inferMirageCallStyle(players: Player[]): MirageCallStyle {
  const aggressive = players.filter((player) => player.style === "Aggressive").length;
  const passive = players.filter((player) => player.style === "Passive").length;
  if (aggressive >= 2 && aggressive > passive) return "aggressive";
  if (passive >= 3 && passive > aggressive) return "cautious";
  return "standard";
}

export function assignMirageJobs(players: Player[], hasAwp: (player: Player) => boolean = () => false) {
  const assignments = new Map<string, MirageJob>();
  const remaining = [...players];
  const jobs: MirageJob[] = ["awper", "entry", "lurker", "support"];

  for (const job of jobs) {
    if (!remaining.length) break;
    let bestIndex = 0;
    let bestScore = -Infinity;
    remaining.forEach((player, index) => {
      const score = jobScore(player, job, hasAwp(player));
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    const [player] = remaining.splice(bestIndex, 1);
    assignments.set(player.id, job);
  }

  remaining.forEach((player) => assignments.set(player.id, "trader"));
  return assignments;
}

export function routeForMirageJob(plan: MiragePlan, job: MirageJob) {
  return plan.routes[job];
}

export function ctObjectiveForMirageJob(job: MirageJob, push: boolean) {
  if (job === "awper") return push ? "topmid" : "window";
  if (job === "entry") return push ? "catwalk" : "bsite";
  if (job === "lurker") return push ? "underpass" : "market";
  if (job === "support") return push ? "mid" : "jungle";
  return push ? "connector" : "asite";
}

export function postPlantObjectiveForMirageJob(side: "CT" | "T", job: MirageJob, site: Site) {
  if (side === "CT") return site;
  if (job === "lurker") return site === "asite" ? "connector" : "underpass";
  return site;
}

export function selectMirageCtPushers(
  players: Player[],
  jobs: Map<string, MirageJob>,
  tactic: MirageCallStyle,
  random = Math.random,
) {
  if (tactic === "cautious") return new Set<string>();
  const budget = tactic === "aggressive" ? 2 : 1;
  const candidates = players
    .filter((player) => player.style === "Aggressive" || random() < (tactic === "aggressive" ? 0.65 : 0.12))
    .sort((a, b) => pushScore(b, jobs.get(b.id)) - pushScore(a, jobs.get(a.id)));
  return new Set(candidates.slice(0, budget).map((player) => player.id));
}

function planWeight(plan: MiragePlan, context: MiragePlanContext) {
  let weight = 1;
  if (context.tactic === "aggressive") {
    weight *= plan.pace === "execute" ? 1.55 : plan.pace === "contact" ? 1.8 : 0.75;
  } else if (context.tactic === "cautious") {
    weight *= plan.pace === "default" ? 1.55 : plan.pace === "execute" ? 0.7 : 0.45;
  }

  if (context.economy === "ECO") {
    weight *= plan.pace === "contact" ? 2.8 : plan.pace === "execute" ? 1.2 : 0.45;
  } else if (context.economy === "FORCE") {
    weight *= plan.pace === "contact" ? 1.65 : plan.pace === "execute" ? 1.15 : 0.8;
  }

  if (context.utilityCount < plan.utilityNeed) {
    const coverage = plan.utilityNeed ? context.utilityCount / plan.utilityNeed : 1;
    weight *= 0.3 + Math.max(0, Math.min(1, coverage)) * 0.7;
  }
  return Math.max(0.05, weight);
}

function jobScore(player: Player, job: MirageJob, equippedAwp: boolean) {
  const { aim, clutch, consistency, awp, igl } = player.stats;
  if (job === "awper") {
    return awp * 0.75 + consistency * 0.2 + (equippedAwp ? 160 : 0) + (player.role === "AWP" ? 70 : 0) + (player.secondaryRole === "AWP" ? 35 : 0);
  }
  if (job === "entry") {
    return aim * 0.65 + consistency * 0.2 + clutch * 0.15 + (player.role === "Entry" ? 70 : 0) + (player.style === "Aggressive" ? 25 : 0) - (equippedAwp ? 100 : 0);
  }
  if (job === "lurker") {
    return clutch * 0.45 + consistency * 0.35 + aim * 0.2 + (player.role === "Lurker" ? 70 : 0) + (player.style === "Passive" ? 18 : 0) - (equippedAwp ? 30 : 0);
  }
  if (job === "support") {
    return consistency * 0.5 + igl * 0.3 + clutch * 0.2 + (player.role === "Support" ? 70 : 0) + (player.role === "IGL" ? 30 : 0);
  }
  return aim * 0.45 + consistency * 0.35 + clutch * 0.2;
}

function pushScore(player: Player, job: MirageJob | undefined) {
  return player.stats.aim * 0.55 + player.stats.consistency * 0.25 + player.ovr * 0.2
    + (player.style === "Aggressive" ? 20 : 0)
    + (job === "entry" ? 18 : 0)
    - (job === "awper" ? 8 : 0);
}
