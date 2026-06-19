/**
 * Mirage spatial round simulator — the round outcome EMERGES from real navigation + line-of-sight
 * duels, instead of being decided by a probability and narrated. Players route from spawn to
 * role-based objectives on the tactical graph (entry/support/AWP/lurker spread across different
 * approaches — NOT all through one choke), and a kill only happens when two enemies actually have
 * line-of-sight on the nav grid and fight. Who wins a duel is still skill-weighted (the `skill` map,
 * built from the sim's killWeight) plus holder/AWP/crossfire factors and a small team bias, so
 * aggregate win rates still track team strength.
 *
 * Output: an ordered event list (kills/plant/defuse/explode with real positions + timestamps) and a
 * position timeline the radar plays back, so movement and kills are the SAME spatial truth.
 */
import type { Player } from "./gameData";
import type { Vec } from "./mapGeometry";
import { getNavGrid, hasLineOfSight, snapToWalkable } from "./mapGeometry";
import { getNode, nearestNode, neighbors, spawnNodeId } from "./mirageNav";
import { findRoute, corridorPath } from "./pathfinder";
import { objectiveFor, roundStateFor, type Situation, type Site } from "./roundAI";

const GRID = getNavGrid("mirage");

// --- Tunables (radar units are 0..100; seconds are round-time) ---
const DT = 0.5; // simulation tick
const ROUND_TIME = 115;
const WALK_SPEED = 5.0; // radar units/sec — calibrated from a real CS2 demo (run ~4.8 u/s)
const SIGHT_RANGE = 44; // farthest a duel reaches. Safe to be generous now that the nav-mesh grid
// blocks real walls — long range only enables genuinely CLEAR sightlines, not through-wall shots.
const PLANT_TIME = 3.2;
const DEFUSE_TIME = 9.0;
const BOMB_TIME = 40;
const TTK_BASE = 0.7; // seconds from "we see each other" to someone dying — paces deaths
const HOLDER_EDGE = 1.45; // a player holding their angle beats a peeker, all else equal
const AWP_EDGE = 1.7; // AWP first-shot advantage
const CROSSFIRE = 0.55; // each extra enemy with LOS on you cuts your odds
// Aggregate-balance knobs. Per-duel edges COMPOUND over a ~16-round match, so individual OVR skill is
// compressed (SKILL_W) and team strength (the [0.16,0.84]-style probability) is the primary, bounded
// driver (TEAM_W). The per-duel clamp keeps even mismatches from being a sure thing (preserves upsets).
// Spawn placement: 5 pads in a pentagon around the (demo-calibrated) spawn centre, so the dots are
// clearly separated (real pads are too tight and overlap on the radar). Snapped to the floor.
const SPAWN_CENTER: Record<"T" | "CT", Vec> = { T: { x: 86.5, y: 36.6 }, CT: { x: 31.9, y: 68.7 } };
const SPAWN_R: Record<"T" | "CT", number> = { T: 3.4, CT: 2.8 };
// Repositioning: once holding, players don't freeze — they shuffle between nearby angles every few
// seconds (peek / re-angle / hold a different spot), so CTs and held Ts play dynamically.
const REPO_MIN = 3.0; // seconds
const REPO_VAR = 5.0;
const REPO_AGGRO = 1.6; // a player repositions sooner right after winning a duel (re-aggress/relocate)
const ROTATE_CHANCE = 0.6; // chance a dead player's teammate swings toward the fight (trade / retake)
const LANE_W = 1.9; // per-player radial offset (radar units) so teammates never render as one stacked
// dot (each sits at a fixed angle around its true position). Visual only — duels use true positions.

const SKILL_W = 0.28; // how much the raw OVR/role skill ratio sways one duel
const TEAM_W = 0.36; // how much team-strength bias sways one duel
const DUEL_CLAMP = 0.28; // per-duel win prob is clamped to [DUEL_CLAMP, 1 - DUEL_CLAMP]

type TeamKey = "you" | "opponent";

export interface MirageSimInput {
  you: Team;
  opponent: Team;
  side: "CT" | "T"; // your team's side
  strategy: number; // mirageStrategy
  skill: Map<string, number>; // playerId -> duel skill (from killWeight); higher wins more
  awp: Set<string>; // playerIds holding an AWP
  weapons: Record<string, string>; // playerId -> weapon name (for the feed)
  teamBias: number; // -0.5..0.5: >0 favours "you" per duel (from team-strength probability)
  tactic?: string; // "aggressive" makes CTs more likely to push out to the extremities
}
interface Team {
  players: Player[];
}

export interface SimEvent {
  t: number;
  type: "kill" | "plant" | "defuse" | "explode";
  side: TeamKey; // acting team (killer/planter/defuser); "explode" uses T team
  killerId?: string;
  victimId?: string;
  killerPos?: Vec;
  victimPos?: Vec;
  engage?: { from: string; to: string };
  headshot?: boolean;
  weapon?: string;
  site?: Site;
}
export interface TimelineFrame {
  t: number;
  players: { id: string; x: number; y: number; alive: boolean; yaw: number }[];
}
export interface MirageSimResult {
  events: SimEvent[];
  timeline: TimelineFrame[];
  youWin: boolean;
  tPlantedBomb: boolean;
  bombOutcome: "none" | "defused" | "exploded";
  roundReason: string;
}

interface SimP {
  ref: Player;
  team: TeamKey;
  side: "CT" | "T";
  idx: number;
  pts: Vec[];
  cum: number[];
  len: number;
  dist: number; // distance travelled along current route
  pos: Vec;
  nodeId: string;
  objective: string;
  alive: boolean;
  awp: boolean;
  skill: number;
  yaw: number;
  fightTimer: number;
  fightTarget: string | null;
  hasBomb: boolean;
  home: string; // the callout this player is anchored to (repositions around it)
  repoTimer: number; // seconds until the next reposition while holding
}

// T-side approach plans — distinct routes per player so a take spreads across the map (ramp, palace,
// mid->connector->A, mid->cat->short->B, apps, underpass lurk) instead of funnelling one choke. Each
// step is a real graph edge; the final node is what they hold. idx 0-4 = roster slots.
function tPlan(idx: number, strategy: number): string[] {
  const A_PALACE = ["palace", "asite"]; // T spawn -> palace -> drop A
  const A_MID = ["sidealley", "topmid", "mid", "connector", "asite"]; // mid -> connector -> A
  const B_APPS = ["sidealley", "house", "backalley", "bapps", "van", "bsite"]; // apps -> van -> B
  const B_MID = ["sidealley", "topmid", "mid", "underpass", "catwalk", "bsite"]; // mid -> cat -> B
  const MID = ["sidealley", "topmid", "mid"]; // mid control / lurk
  const MID_LURK = ["sidealley", "topmid", "mid", "underpass"]; // underpass flank
  if (strategy === 1) return [A_PALACE, A_MID, A_PALACE, A_MID, MID][idx]; // stack A
  if (strategy === 2) return [B_APPS, B_APPS, B_MID, B_MID, MID_LURK][idx]; // stack B
  return [A_PALACE, A_MID, B_APPS, B_MID, MID][idx]; // split A/B
}

// CT objective per slot. `push` sends them out toward the enemy (aggressive peek) instead of holding
// their site — CT-reachable forward positions only.
function ctObjective(idx: number, push: boolean): string {
  if (idx === 0) return push ? "connector" : "asite"; // A anchor / push up connector
  if (idx === 3) return push ? "mid" : "jungle"; // A support: jungle hold / mid push
  if (idx === 1) return push ? "catwalk" : "bsite"; // B anchor / push catwalk
  if (idx === 4) return push ? "underpass" : "market"; // B support: market hold / underpass push
  return push ? "topmid" : "window"; // mid player: snipers hold / top-mid push
}

// Route through a sequence of callouts (each leg via findRoute), corridor-snapped to the floor.
function buildPlanRoute(startId: string, plan: string[], sit: Situation): { pts: Vec[]; cum: number[]; len: number; lastNode: string } {
  const nodeSeq: string[] = [startId];
  let from = startId;
  for (const to of plan) {
    const r = findRoute(from, to, roundStateFor(sit));
    const legNodes = r ? r.nodes.map((n) => n.id) : [to];
    for (let i = 1; i < legNodes.length; i += 1) nodeSeq.push(legNodes[i]); // skip the shared join node
    from = to;
  }
  const raw = nodeSeq.map((id) => getNode(id)).filter(Boolean).map((n) => ({ x: n!.x, y: n!.y }));
  const pts = (corridorPath("mirage", raw) || raw).map((p) => (GRID ? snapToWalkable(GRID, p) : p));
  const cum = [0];
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    cum.push(len);
  }
  return { pts: pts.length ? pts : [{ x: 50, y: 50 }], cum, len, lastNode: plan[plan.length - 1] ?? startId };
}

function buildRoute(fromId: string, toId: string, sit: Situation): { pts: Vec[]; cum: number[]; len: number } {
  const r = findRoute(fromId, toId, roundStateFor(sit));
  const nodes = r ? r.nodes : [getNode(fromId)!].filter(Boolean);
  const raw = nodes.map((n) => ({ x: n.x, y: n.y }));
  const pts = (corridorPath("mirage", raw) || raw).map((p) => (GRID ? snapToWalkable(GRID, p) : p));
  const cum = [0];
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    cum.push(len);
  }
  return { pts: pts.length ? pts : [{ x: 50, y: 50 }], cum, len };
}
// Prepend a starting position (e.g. a spawn pad, or current pos when repositioning) to a route.
// `replaceFirst` drops the route's first node (the spawn node) so players head from their pad
// straight toward the objective instead of funnelling back to the single spawn node and stacking.
function withStart(route: { pts: Vec[]; cum: number[]; len: number }, start: Vec, replaceFirst = false): { pts: Vec[]; cum: number[]; len: number } {
  const base = replaceFirst && route.pts.length > 1 ? route.pts.slice(1) : route.pts;
  const pts = Math.hypot(base[0].x - start.x, base[0].y - start.y) < 0.5 ? base.slice() : [start, ...base];
  const cum = [0];
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); cum.push(len); }
  return { pts, cum, len };
}
function posAtDist(p: SimP): Vec {
  if (p.pts.length <= 1) return p.pts[0] ?? { x: 50, y: 50 };
  const d = Math.max(0, Math.min(p.len, p.dist));
  if (d >= p.len) return p.pts[p.pts.length - 1];
  let i = 1;
  while (i < p.cum.length && p.cum[i] < d) i += 1;
  const segLen = p.cum[i] - p.cum[i - 1];
  const f = segLen > 0 ? (d - p.cum[i - 1]) / segLen : 0;
  const a = p.pts[i - 1];
  const b = p.pts[i];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

function siteNode(site: Site): Vec {
  const n = getNode(site)!;
  return { x: n.x, y: n.y };
}

export function simulateMirageRound(input: MirageSimInput): MirageSimResult {
  const { side, strategy, skill, awp, teamBias } = input;
  const tKey: TeamKey = side === "T" ? "you" : "opponent";
  const ctKey: TeamKey = side === "CT" ? "you" : "opponent";
  const sideOf = (team: TeamKey): "CT" | "T" => (team === tKey ? "T" : "CT");

  const bombSite: Site = strategy === 2 ? "bsite" : strategy === 1 ? "asite" : Math.random() < 0.5 ? "asite" : "bsite";

  // Build the 10 players with role-based objectives (spread across approaches).
  const sit0: Situation = {
    bombPlanted: false,
    enemyAwperPressure: 0.4,
    hasUtility: false,
    availableUtility: 0,
    saving: false,
  };
  const aggressiveRound = input.tactic === "aggressive";
  const make = (team: TeamKey, players: Player[]): SimP[] => {
    const pside = sideOf(team);
    // Decide which CTs push out (cap 2 so the site isn't abandoned). Aggressive-style riflers push,
    // an "aggressive" round call pushes more, plus a small baseline peek chance.
    const ctPush: boolean[] = players.map((ref) =>
      pside === "CT" &&
      (ref.style === "Aggressive" || (aggressiveRound && Math.random() < 0.7) || Math.random() < 0.1),
    );
    let pushBudget = 2;
    return players.map((ref, idx) => {
      let route: { pts: Vec[]; cum: number[]; len: number };
      let objective: string;
      if (pside === "T") {
        const plan = tPlan(idx, strategy);
        const r = buildPlanRoute("tspawn", plan, sit0);
        route = { pts: r.pts, cum: r.cum, len: r.len };
        objective = r.lastNode;
      } else {
        const push = ctPush[idx] && pushBudget > 0;
        if (push) pushBudget -= 1;
        objective = ctObjective(idx, push);
        route = buildRoute("ctspawn", objective, sit0);
      }
      // start spread in a pentagon around the spawn centre so the 5 dots don't stack. Not snapped to
      // the mesh (the strict spawn floor is tiny and would collapse them) — it's just the visual start
      // inside the spawn box; the route corridor-snaps from the first node onward.
      const c = SPAWN_CENTER[pside];
      const ang = ((idx % 5) * 72 + 18) * (Math.PI / 180);
      const pad: Vec = { x: c.x + Math.cos(ang) * SPAWN_R[pside], y: c.y + Math.sin(ang) * SPAWN_R[pside] };
      route = withStart(route, pad, true); // straight from pad toward objective (no spawn-node funnel)
      return {
        ref,
        team,
        side: pside,
        idx,
        ...route,
        dist: 0,
        pos: pad,
        nodeId: pside === "CT" ? "ctspawn" : "tspawn",
        objective,
        alive: true,
        awp: awp.has(ref.id),
        skill: Math.max(0.1, skill.get(ref.id) ?? 1),
        yaw: 0,
        fightTimer: 0,
        fightTarget: null,
        hasBomb: false,
        home: objective,
        repoTimer: REPO_MIN + Math.random() * REPO_VAR,
      };
    });
  };
  const ps: SimP[] = [...make("you", input.you.players), ...make("opponent", input.opponent.players)];
  const byId = new Map(ps.map((p) => [p.ref.id, p]));
  // bomb carrier: the lowest-idx T whose objective is the bomb site
  const carrier = ps.filter((p) => p.side === "T" && p.objective === bombSite).sort((a, b) => a.idx - b.idx)[0]
    ?? ps.find((p) => p.side === "T");
  if (carrier) carrier.hasBomb = true;

  const aliveOf = (s: "CT" | "T") => ps.filter((p) => p.alive && p.side === s);
  const enemiesOf = (p: SimP) => ps.filter((q) => q.alive && q.side !== p.side);

  // Timeline players with a fixed per-player radial offset (a tiny pentagon) so teammates never
  // render as one stacked dot — even bunched on a corridor they read as 5 distinct markers. Sim/duel
  // positions (p.pos) are untouched, so this is purely visual.
  const framePlayers = () =>
    ps.map((p) => {
      const a = p.idx * ((2 * Math.PI) / 5);
      return { id: p.ref.id, x: p.pos.x + Math.cos(a) * LANE_W, y: p.pos.y + Math.sin(a) * LANE_W, alive: p.alive, yaw: p.yaw };
    });

  const events: SimEvent[] = [];
  const timeline: TimelineFrame[] = [];

  let t = 0;
  let planted = false;
  let bombTimer = BOMB_TIME;
  let plantProgress = 0;
  let defuseProgress = 0;
  let bombOutcome: "none" | "defused" | "exploded" = "none";
  let winner: TeamKey | null = null;
  let reason = "";
  let lastFrameT = -1;

  let plantedSite: Site | null = null;
  const replan = (plantSite: Site) => {
    plantedSite = plantSite;
    const sit: Situation = { ...sit0, bombPlanted: true, plantSite };
    for (const p of ps) {
      if (!p.alive) continue;
      const obj = objectiveFor(p.side, p.idx, strategy, sit);
      const route = withStart(buildRoute(p.nodeId, obj, sit), p.pos);
      p.pts = route.pts;
      p.cum = route.cum;
      p.len = route.len;
      p.dist = 0;
      p.objective = obj;
      p.home = obj;
      p.fightTarget = null;
      p.fightTimer = 0;
      p.repoTimer = REPO_MIN + Math.random() * REPO_VAR;
    }
  };

  // Reposition a player from where they are to a new callout (peek/re-angle/rotate) — keeps play dynamic.
  const sitNow = (): Situation => (plantedSite ? { ...sit0, bombPlanted: true, plantSite: plantedSite } : sit0);
  const repositionTo = (p: SimP, toNodeId: string) => {
    const fromNode = nearestNode(p.pos.x, p.pos.y).id;
    const route = withStart(buildRoute(fromNode, toNodeId, sitNow()), p.pos);
    p.pts = route.pts;
    p.cum = route.cum;
    p.len = route.len;
    p.dist = 0;
    p.objective = toNodeId;
  };
  // Pick where to reposition: the player's home callout or an adjacent angle — never retreat to a
  // spawn or wander to the far site, so they hold/peek their assigned area dynamically.
  const repositionTarget = (p: SimP): string => {
    const banned = new Set([spawnNodeId("CT"), spawnNodeId("T")]);
    const opts = [p.home, p.home, ...neighbors(p.home).map((e) => e.to)].filter((id) => !banned.has(id));
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : p.home;
  };

  const hasLos = (a: SimP, b: SimP): boolean => {
    const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
    if (d > SIGHT_RANGE) return false;
    if (!GRID) return true;
    return hasLineOfSight(GRID, a.pos, b.pos);
  };

  // win probability for A in a duel vs B. Built so aggregate round/match win% tracks TEAM strength
  // (the bounded [0.16,0.84]-style probability) while individual skill adds a compressed edge (so a
  // star carries but small OVR gaps don't snowball to ~100% over a match) plus situational factors.
  const winProbA = (a: SimP, b: SimP): number => {
    // 1. individual OVR/role skill, compressed toward 50/50
    const rawSkill = a.skill / (a.skill + b.skill);
    let p = 0.5 + (rawSkill - 0.5) * SKILL_W;
    // 2. situational multipliers (holder / AWP / crossfire) applied in odds space
    const holdA = a.dist >= a.len ? HOLDER_EDGE : 1;
    const holdB = b.dist >= b.len ? HOLDER_EDGE : 1;
    const awpA = a.awp ? AWP_EDGE : 1;
    const awpB = b.awp ? AWP_EDGE : 1;
    const xfA = 1 + CROSSFIRE * (enemiesOf(a).filter((e) => hasLos(a, e)).length - 1);
    const xfB = 1 + CROSSFIRE * (enemiesOf(b).filter((e) => hasLos(b, e)).length - 1);
    const mult = (holdA * awpA) / Math.max(1, xfA) / ((holdB * awpB) / Math.max(1, xfB));
    const odds = (p / (1 - p)) * mult;
    p = odds / (1 + odds);
    // 3. team-strength bias (the primary aggregate driver)
    p += (a.team === "you" ? teamBias : -teamBias) * TEAM_W;
    return Math.max(DUEL_CLAMP, Math.min(1 - DUEL_CLAMP, p));
  };

  const kill = (killer: SimP, victim: SimP) => {
    victim.alive = false;
    victim.fightTarget = null;
    killer.fightTarget = null;
    killer.fightTimer = 0;
    killer.repoTimer = Math.min(killer.repoTimer, REPO_AGGRO); // re-aggress / relocate soon after a kill
    const kn = getNode(killer.nodeId);
    const vn = getNode(victim.nodeId);
    events.push({
      t,
      type: "kill",
      side: killer.team,
      killerId: killer.ref.id,
      victimId: victim.ref.id,
      killerPos: { ...killer.pos },
      victimPos: { ...victim.pos },
      engage: kn && vn ? { from: kn.id, to: vn.id } : undefined,
      headshot: Math.random() < 0.4,
      weapon: input.weapons[killer.ref.id] ?? "Rifle",
    });
    // Reactive rotation / trade: a free teammate of the player who just died swings toward the
    // fight to trade the killer or retake the area — so kills pull players in, like real CS.
    const mates = aliveOf(victim.side).filter((q) => q !== victim && q !== killer && !q.fightTarget);
    if (mates.length && Math.random() < ROTATE_CHANCE) {
      let best: SimP | null = null;
      let bd = Infinity;
      for (const m of mates) {
        const d = Math.hypot(m.pos.x - victim.pos.x, m.pos.y - victim.pos.y);
        if (d > 10 && d < bd) { bd = d; best = m; } // must actually travel (not already there)
      }
      if (best) { repositionTo(best, victim.nodeId); best.repoTimer = REPO_MIN + Math.random() * REPO_VAR; }
    }
    if (victim.hasBomb && victim.side === "T") {
      // drop the bomb to a nearby living T (simplified pickup)
      victim.hasBomb = false;
      const heir = aliveOf("T").sort((a, b) => a.idx - b.idx)[0];
      if (heir) heir.hasBomb = true;
    }
  };

  // initial frame at t=0 so the radar shows players spread on their spawn pads before they move
  timeline.push({ t: 0, players: framePlayers() });

  while (t < ROUND_TIME && !winner) {
    t = Math.round((t + DT) * 100) / 100;

    // 1. Movement — advance toward objective; once arrived, periodically reposition (don't freeze).
    for (const p of ps) {
      if (!p.alive) continue;
      if (p.dist < p.len) {
        const prev = p.pos;
        p.dist = Math.min(p.len, p.dist + WALK_SPEED * DT);
        p.pos = posAtDist(p);
        const dx = p.pos.x - prev.x;
        const dy = p.pos.y - prev.y;
        if (dx * dx + dy * dy > 0.02) p.yaw = (Math.atan2(dy, dx) * 180) / Math.PI;
        p.nodeId = nearestNode(p.pos.x, p.pos.y).id; // current callout for engage/LOS gating
      } else if (!p.fightTarget) {
        // holding: shuffle to a nearby angle every few seconds so play stays dynamic
        p.repoTimer -= DT;
        if (p.repoTimer <= 0) {
          repositionTo(p, repositionTarget(p));
          p.repoTimer = REPO_MIN + Math.random() * REPO_VAR;
        }
      }
    }

    // 2. Fights — resolve ongoing, then form new ones from real LOS contact.
    for (const p of ps) {
      if (!p.alive || !p.fightTarget) continue;
      const foe = byId.get(p.fightTarget);
      if (!foe || !foe.alive || !hasLos(p, foe)) {
        p.fightTarget = null;
        continue;
      }
      p.fightTimer -= DT;
      if (p.fightTimer <= 0 && foe.fightTarget === p.ref.id) {
        // resolve once (guard so the pair resolves a single death)
        if (foe.alive && p.alive) {
          const pWins = Math.random() < winProbA(p, foe);
          if (pWins) kill(p, foe);
          else kill(foe, p);
        }
      }
    }
    // form new fights: each free, alive player engages the nearest enemy in LOS
    for (const p of ps) {
      if (!p.alive || p.fightTarget) continue;
      let nearest: SimP | null = null;
      let nd = Infinity;
      for (const foe of enemiesOf(p)) {
        if (foe.fightTarget && foe.fightTarget !== p.ref.id) continue; // already dueling someone else
        if (!hasLos(p, foe)) continue;
        const d = Math.hypot(p.pos.x - foe.pos.x, p.pos.y - foe.pos.y);
        if (d < nd) {
          nd = d;
          nearest = foe;
        }
      }
      if (nearest) {
        const timer = TTK_BASE * (0.5 + Math.random()) * (p.awp || nearest.awp ? 0.7 : 1);
        p.fightTarget = nearest.ref.id;
        p.fightTimer = timer;
        nearest.fightTarget = p.ref.id;
        nearest.fightTimer = timer;
      }
    }

    // 3. Bomb logic
    const tAlive = aliveOf("T");
    const ctAlive = aliveOf("CT");
    if (!planted) {
      const c = carrier && carrier.alive ? carrier : tAlive.find((p) => p.hasBomb);
      const onSite = c && Math.hypot(c.pos.x - siteNode(bombSite).x, c.pos.y - siteNode(bombSite).y) < 9;
      const contested = c ? ctAlive.some((ct) => hasLos(ct, c)) : true;
      if (c && onSite && !contested) {
        plantProgress += DT;
        if (plantProgress >= PLANT_TIME) {
          planted = true;
          events.push({ t, type: "plant", side: tKey, killerId: c.ref.id, site: bombSite, killerPos: siteNode(bombSite) });
          replan(bombSite);
        }
      } else {
        plantProgress = Math.max(0, plantProgress - DT * 0.5);
      }
    } else {
      bombTimer -= DT;
      if (bombTimer <= 0) {
        bombOutcome = "exploded";
        winner = tKey;
        reason = "Target bombed";
        events.push({ t, type: "explode", side: tKey, killerPos: siteNode(bombSite) });
        break;
      }
      // defuse: a CT at the site with no T holding LOS on the site
      const ctAtSite = ctAlive.find((ct) => Math.hypot(ct.pos.x - siteNode(bombSite).x, ct.pos.y - siteNode(bombSite).y) < 8);
      const tWatching = tAlive.some((tp) => Math.hypot(tp.pos.x - siteNode(bombSite).x, tp.pos.y - siteNode(bombSite).y) < SIGHT_RANGE
        && GRID && hasLineOfSight(GRID, tp.pos, siteNode(bombSite)));
      if (ctAtSite && !tWatching) {
        defuseProgress += DT;
        if (defuseProgress >= DEFUSE_TIME) {
          bombOutcome = "defused";
          winner = ctKey;
          reason = "Bomb defused";
          events.push({ t, type: "defuse", side: ctKey, killerId: ctAtSite.ref.id });
          break;
        }
      } else {
        defuseProgress = Math.max(0, defuseProgress - DT);
      }
    }

    // 4. Round-end by elimination
    if (!winner) {
      const tA = aliveOf("T").length;
      const ctA = aliveOf("CT").length;
      if (tA === 0) {
        if (planted) {
          // no Ts left to contest — CTs defuse
          bombOutcome = "defused";
          winner = ctKey;
          reason = "Bomb defused";
          const ct = aliveOf("CT")[0];
          events.push({ t, type: "defuse", side: ctKey, killerId: ct?.ref.id });
        } else {
          winner = ctKey;
          reason = "Squad eliminated";
        }
      } else if (ctA === 0) {
        winner = tKey;
        reason = planted ? "Target bombed" : "Squad eliminated";
      }
    }

    // 5. Timeline frame (~1s cadence keeps it small)
    if (t - lastFrameT >= 1 - 1e-6) {
      lastFrameT = t;
      timeline.push({ t, players: framePlayers() });
    }
  }

  if (!winner) {
    // time expired
    if (planted) {
      bombOutcome = "exploded";
      winner = tKey;
      reason = "Target bombed";
      events.push({ t: ROUND_TIME, type: "explode", side: tKey, killerPos: siteNode(bombSite) });
    } else {
      winner = ctKey;
      reason = "Time ran out";
    }
  }
  // final frame
  timeline.push({ t, players: framePlayers() });

  return {
    events,
    timeline,
    youWin: winner === "you",
    tPlantedBomb: planted,
    bombOutcome,
    roundReason: reason,
  };
}
