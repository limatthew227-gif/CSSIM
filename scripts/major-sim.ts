// Headless 100-major simulation with the real top-16 teams (no user/random teams). Standard Major
// format: 16-team Swiss (3 wins qualify / 3 losses out; advancement & elimination games are BO3) ->
// 8-team single-elim BO3 playoff. Counts how often each team is champion.
//   node --import tsx --import ./scripts/register-stub.mjs scripts/major-sim.ts
import { hltvTop20Rosters, hltvTop20Coaches } from "../src/hltvTop20";
import { toFieldTeam, initMatch, playRound, type FieldTeam } from "../src/sim";
import { defaultSettings, difficulties, mapPool, type MapId } from "../src/gameData";

function mulberry32(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function coachForRoster(roster: any) {
  if (!roster.id?.startsWith("hltv-")) return undefined;
  const teamId = roster.id.replace(/^hltv-/, "").replace(/-2026-06-08$/, "");
  return hltvTop20Coaches.find((c) => c.id === `hltv-coach-${teamId}`);
}
const toTeam = (roster: any): FieldTeam => ({ ...toFieldTeam(roster), coach: coachForRoster(roster) });

const FIELD = hltvTop20Rosters.slice(0, 16).map(toTeam);
const neutralDiff = { ...difficulties[0], opponentBonus: 0 };

function playMap(map: MapId, a: FieldTeam, b: FieldTeam, stage: "swiss" | "playoff"): FieldTeam {
  // randomize who starts CT (the sim has a small home/CT-start edge) so neither team is favoured by
  // always being passed first — keeps the bracket fair.
  const [home, away] = Math.random() < 0.5 ? [a, b] : [b, a];
  let st = initMatch(map, home, away, { stage } as any);
  let g = 0;
  while (!st.ended && g < 60) { st = playRound(st, home, away, defaultSettings, neutralDiff, "standard", 0, true); g += 1; }
  return st.you > st.opponent ? home : away;
}
function playSeries(a: FieldTeam, b: FieldTeam, bestOf: number, stage: "swiss" | "playoff"): FieldTeam {
  const need = Math.ceil(bestOf / 2);
  const pool = [...mapPool.map((m) => m.id)];
  for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  let aw = 0, bw = 0, mi = 0;
  while (aw < need && bw < need) { const w = playMap(pool[mi % pool.length], a, b, stage); if (w === a) aw += 1; else bw += 1; mi += 1; }
  return aw > bw ? a : b;
}

interface Rec { team: FieldTeam; seed: number; w: number; l: number; opp: Set<number>; }
function swiss(): Rec[] {
  const recs: Rec[] = FIELD.map((team, seed) => ({ team, seed, w: 0, l: 0, opp: new Set() }));
  const qualified: Rec[] = [];
  let guard = 0;
  while (qualified.length < 8 && guard < 12) {
    guard += 1;
    const active = recs.filter((t) => t.w < 3 && t.l < 3);
    const byRec = new Map<number, Rec[]>();
    for (const t of active) { const k = t.w * 10 + t.l; (byRec.get(k) ?? byRec.set(k, []).get(k)!).push(t); }
    for (const grp of byRec.values()) {
      grp.sort((a, b) => a.seed - b.seed); // high seed first
      const used = new Set<number>();
      for (let i = 0; i < grp.length; i += 1) {
        if (used.has(i)) continue;
        const a = grp[i];
        let j = -1;
        for (let k = grp.length - 1; k > i; k -= 1) { if (!used.has(k) && !a.opp.has(grp[k].seed)) { j = k; break; } }
        if (j === -1) for (let k = grp.length - 1; k > i; k -= 1) { if (!used.has(k)) { j = k; break; } }
        if (j === -1) continue;
        used.add(i); used.add(j);
        const b = grp[j];
        const decider = a.w === 2 || a.l === 2; // advancement / elimination game -> BO3
        const winner = playSeries(a.team, b.team, decider ? 3 : 1, "swiss");
        const [W, L] = winner === a.team ? [a, b] : [b, a];
        W.w += 1; L.l += 1; a.opp.add(b.seed); b.opp.add(a.seed);
      }
    }
    for (const t of recs) if (t.w === 3 && !qualified.includes(t)) qualified.push(t);
  }
  return qualified.sort((a, b) => b.w - a.w || a.l - b.l || a.seed - b.seed).slice(0, 8);
}

function major(): FieldTeam {
  const seeds = swiss();
  if (seeds.length < 8) return seeds[0]?.team ?? FIELD[0];
  const w = (a: Rec, b: Rec) => (playSeries(a.team, b.team, 3, "playoff") === a.team ? a : b);
  const qf = [w(seeds[0], seeds[7]), w(seeds[3], seeds[4]), w(seeds[1], seeds[6]), w(seeds[2], seeds[5])];
  const sf = [w(qf[0], qf[1]), w(qf[2], qf[3])];
  return (playSeries(sf[0].team, sf[1].team, 3, "playoff") === sf[0].team ? sf[0] : sf[1]).team;
}

const N = 100;
const champions: Record<string, number> = {};
const orig = Math.random;
for (let i = 0; i < N; i += 1) {
  Math.random = mulberry32(i * 7919 + 13);
  const champ = major();
  champions[champ.name] = (champions[champ.name] ?? 0) + 1;
  Math.random = orig;
  if ((i + 1) % 20 === 0) process.stderr.write(`  ${i + 1}/${N} majors\n`);
}
console.log(`\n=== Champions over ${N} majors (real top-16, no random teams) ===`);
for (const [name, n] of Object.entries(champions).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name.padEnd(22)} ${n}`);
}
console.log(`\nVitality won ${champions["Vitality"] ?? 0} / ${N} majors.`);
