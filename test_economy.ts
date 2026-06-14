import { initMatch, playRound } from "./src/sim";
import { rosters, defaultSettings, difficulties } from "./src/gameData";

const you = rosters[0];
const opponent = rosters[1];
const settings = defaultSettings;
const difficulty = difficulties[1]; // Medium

let state = initMatch("mirage", you, opponent);

console.log("=== STARTING MOCK SIMULATION ===");
console.log("Round 1 Initial State:");
you.players.forEach(p => {
  console.log(`  Player ${p.handle}: Money = $${state.yourMoney?.[p.id]}, Weapon = ${state.yourWeapons?.[p.id]}`);
});

// Force your team to win by mocking Math.random to always return 0
const originalRandom = Math.random;
Math.random = () => 0;

for (let r = 1; r <= 8; r++) {
  console.log(`\n--- PLAYING ROUND ${r} ---`);
  const prevMoney = { ...state.yourMoney };
  const prevWeapons = { ...state.yourWeapons };

  state = playRound(state, you, opponent, settings, difficulty, "standard", 0, true);

  console.log(`Round Winner: ${state.roundWinners[r - 1] === "you" ? "YOUR TEAM" : "OPPONENT"}`);
  console.log(`Round Reason: ${state.lastReason}`);
  console.log("Your Team Player Statuses AFTER Round:");
  you.players.forEach(p => {
    const change = (state.yourMoney?.[p.id] ?? 0) - (prevMoney[p.id] ?? 0);
    const sign = change >= 0 ? "+" : "";
    console.log(`  Player ${p.handle}: Money = $${state.yourMoney?.[p.id]} (${sign}${change}), Carried Weapon for NEXT Round = ${state.yourWeapons?.[p.id]} (Prev: ${prevWeapons[p.id]})`);
  });
}

Math.random = originalRandom;
