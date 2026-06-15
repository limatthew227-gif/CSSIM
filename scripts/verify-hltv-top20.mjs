#!/usr/bin/env node
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { HLTV } = require("hltv");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_FILE = path.join(ROOT, "src", "hltvTop20.ts");
const OUT_JSON = path.join(ROOT, "data", "hltv-verification-2026-06-08.json");
const OUT_MD = path.join(ROOT, "data", "hltv-verification-2026-06-08.md");
const RANKING_DATE = { year: 2026, month: "june", day: 8 };
const RANKING_URL = "https://www.hltv.org/ranking/teams/2026/june/8";
const JINA_PREFIX = "https://r.jina.ai/http://r.jina.ai/http://";
const TOP_COUNT = 20;
const REQUEST_DELAY_MS = 900;
const FETCH_RETRIES = 4;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const localTeams = await readLocalHltvTeams();
  const local2026 = localTeams.filter((team) => (team.year ?? "2026") === "2026" && !team.rosterId?.includes("2018"));
  const historicalExtras = localTeams.filter((team) => team.year && team.year !== "2026");

  let packageRanking = [];
  let packageRankingError;
  try {
    packageRanking = await fetchRankingWithHltvPackage();
  } catch (error) {
    packageRankingError = error instanceof Error ? error.message : String(error);
    console.warn(`gigobyte/HLTV ranking fetch failed, using rendered ranking fallback: ${packageRankingError}`);
  }

  const rankingMarkdown = await fetchRenderedMarkdown(RANKING_URL);
  const renderedRanking = parseRankingMarkdown(rankingMarkdown).slice(0, TOP_COUNT);
  const ranking = packageRanking.length
    ? mergeRanking(packageRanking.slice(0, TOP_COUNT), renderedRanking)
    : renderedRanking.map((team) => ({ ...team, source: "rendered ranking fallback after gigobyte/HLTV block" }));

  const detailedTeams = [];
  for (const team of ranking) {
    await sleep(REQUEST_DELAY_MS);
    const markdown = await fetchRenderedMarkdown(`https://www.hltv.org/team/${team.id}/${slugify(team.name)}`);
    detailedTeams.push({
      ...team,
      ...parseTeamMarkdown(markdown, team),
    });
  }

  const report = buildReport({ local2026, historicalExtras, ranking, detailedTeams, packageRankingError });
  await fs.writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(OUT_MD, renderMarkdownReport(report));

  printSummary(report);
}

async function fetchRankingWithHltvPackage() {
  const ranking = await HLTV.getTeamRanking(RANKING_DATE);
  return ranking.map((entry) => ({
    rank: entry.place,
    points: entry.points,
    name: entry.team.name,
    id: entry.team.id,
    source: "gigobyte/HLTV",
  }));
}

async function fetchRenderedMarkdown(url) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt += 1) {
    const response = await fetch(`${JINA_PREFIX}${url}`);
    if (response.ok) {
      const text = await response.text();
      if (/Performing security verification|Just a moment/i.test(text)) {
        throw new Error(`Rendered fetch was blocked by security verification for ${url}`);
      }
      return text;
    }

    lastError = new Error(`Failed to fetch rendered markdown for ${url}: ${response.status} ${response.statusText}`);
    if (response.status !== 429 || attempt === FETCH_RETRIES) break;
    await sleep(1500 * attempt);
  }

  throw lastError;
}

function parseRankingMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const teams = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rankMatch = lines[index].match(/^#(\d+)!/);
    if (!rankMatch) continue;

    const rank = Number(rankMatch[1]);
    if (rank > TOP_COUNT) break;

    let cursor = index + 1;
    while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;
    const teamLine = lines[cursor]?.trim() ?? "";
    const teamMatch = teamLine.match(/^(.+?)\((\d+) HLTV points\)$/);
    if (!teamMatch) continue;

    const players = [];
    cursor += 1;
    while (cursor < lines.length && !lines[cursor].includes("[HLTV Team profile]")) {
      const value = lines[cursor].trim();
      if (value && !value.startsWith("![") && !value.startsWith("[")) players.push(value);
      cursor += 1;
    }

    const profileLine = lines[cursor] ?? "";
    const idMatch = profileLine.match(/https:\/\/www\.hltv\.org\/team\/(\d+)\//);

    teams.push({
      rank,
      points: Number(teamMatch[2]),
      name: teamMatch[1],
      id: idMatch ? Number(idMatch[1]) : undefined,
      rankingPlayers: players.slice(0, 5),
      source: "jparedes-style rendered ranking fallback",
    });
  }

  return teams;
}

function parseTeamMarkdown(markdown, team) {
  const starterRows = [];
  const playerSection = sectionBetween(markdown, `## Players of ${team.name}`, "## Roster timeline");
  const rowRegex = /^\| (.+?) \| (STARTER|BENCHED|SUBSTITUTE) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(playerSection)) !== null) {
    const linkCell = rowMatch[1];
    const playerMatch = extractHltvLink(linkCell, "player");
    const ratingText = rowMatch[5].replace(/\*/g, "").trim();
    const entry = {
      handle: cleanHandle(playerMatch?.handle ?? playerMatch?.slug ?? ""),
      id: playerMatch?.id,
      slug: playerMatch?.slug,
      status: rowMatch[2],
      timeOnTeam: rowMatch[3].trim(),
      mapsPlayed: parseNumber(rowMatch[4]),
      teamPeriodRating: parseNumber(ratingText),
    };
    if (entry.status === "STARTER") starterRows.push(entry);
  }

  const coachSection = sectionBetween(markdown, `## Coach of ${team.name}`, `## Players of ${team.name}`);
  const coachRow = [...coachSection.matchAll(/^\| (.+?) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)].find((row) =>
    row[1].includes("hltv.org/coach/"),
  );
  const coachMatch = coachRow ? extractHltvLink(coachRow[1], "coach") : undefined;
  const coach = coachRow
    ? {
        handle: cleanHandle(coachMatch?.handle ?? coachMatch?.slug ?? ""),
        id: coachMatch?.id,
        slug: coachMatch?.slug,
        timeOnTeam: coachRow[2].trim(),
        mapsCoached: parseNumber(coachRow[3]),
        trophies: parseNumber(coachRow[4]),
        winrate: parseNumber(coachRow[5]),
      }
    : parseSimpleCoach(markdown);

  return {
    teamPagePlayers: starterRows,
    coach,
    teamPageSource: "jparedes-style rendered team page fallback",
  };
}

function sectionBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const end = text.indexOf(endMarker, start + startMarker.length);
  return text.slice(start, end === -1 ? text.length : end);
}

function extractHltvLink(markdown, type) {
  const imageStripped = markdown.replace(/!\[[^\]]*]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const linkMatch = imageStripped.match(new RegExp(`\\[\\s*([^\\]]+?)\\s*\\]\\(https://www\\.hltv\\.org/${type}/(\\d+)/([^)]*)\\)`));
  if (!linkMatch) return undefined;

  return {
    handle: linkMatch[1].trim(),
    id: Number(linkMatch[2]),
    slug: linkMatch[3],
  };
}

function parseSimpleCoach(markdown) {
  const coachLine = markdown.match(/(?:^|\n)Coach\n\s*([^\n]+)/);
  if (!coachLine) return undefined;

  const handle = coachLine[1].match(/'([^']+)'/)?.[1] ?? coachLine[1].trim();
  return {
    handle: cleanHandle(handle),
    source: "simplified rendered team page",
  };
}

function buildReport({ local2026, historicalExtras, ranking, detailedTeams, packageRankingError }) {
  const localByName = new Map(local2026.map((team) => [normalizeName(team.name), team]));
  const comparisons = detailedTeams.map((remote) => {
    const local = localByName.get(normalizeName(remote.name));
    const rankingPlayers = normalizeHandles(remote.rankingPlayers ?? []);
    const teamPagePlayers = normalizeHandles((remote.teamPagePlayers ?? []).map((player) => player.handle));
    const localPlayers = normalizeHandles(local?.players.map((player) => player.handle) ?? []);
    const preferredRemotePlayers = teamPagePlayers.length ? teamPagePlayers : rankingPlayers;
    const ratingChecks = (remote.teamPagePlayers ?? []).map((remotePlayer) => {
      const localPlayer = local?.players.find((player) => normalizeHandle(player.handle) === normalizeHandle(remotePlayer.handle));
      return {
        handle: remotePlayer.handle,
        teamPeriodRating3: remotePlayer.teamPeriodRating,
        localHltvRating: localPlayer?.hltvRating,
        difference: typeof localPlayer?.hltvRating === "number" && typeof remotePlayer.teamPeriodRating === "number"
          ? Number((localPlayer.hltvRating - remotePlayer.teamPeriodRating).toFixed(2))
          : undefined,
      };
    });

    return {
      rank: remote.rank,
      name: remote.name,
      hltvId: remote.id,
      points: remote.points,
      localFound: Boolean(local),
      localRank: local?.rank,
      localPoints: local?.points,
      rankMatches: local ? local.rank === remote.rank : false,
      pointsMatch: local ? local.points === remote.points : false,
      remoteRankingPlayers: remote.rankingPlayers ?? [],
      remoteTeamPagePlayers: (remote.teamPagePlayers ?? []).map((player) => player.handle),
      remoteTeamPagePlayerDetails: (remote.teamPagePlayers ?? []).map((player) => ({
        handle: player.handle,
        id: player.id,
        slug: player.slug,
        mapsPlayed: player.mapsPlayed,
        teamPeriodRating3: player.teamPeriodRating,
      })),
      localPlayers: local?.players.map((player) => player.handle) ?? [],
      missingLocalPlayers: preferredRemotePlayers.filter((handle) => !localPlayers.includes(handle)),
      extraLocalPlayers: localPlayers.filter((handle) => !preferredRemotePlayers.includes(handle)),
      remoteCoach: remote.coach?.handle,
      localCoach: local?.coachHandle,
      coachMatches: remote.coach && local ? normalizeHandle(remote.coach.handle) === normalizeHandle(local.coachHandle) : undefined,
      ratingChecks,
    };
  });

  const localNames = new Set(local2026.map((team) => normalizeName(team.name)));
  const rankingNames = new Set(ranking.map((team) => normalizeName(team.name)));
  const missingTeams = ranking.filter((team) => !localNames.has(normalizeName(team.name))).map((team) => team.name);
  const extraTeams = local2026.filter((team) => !rankingNames.has(normalizeName(team.name))).map((team) => team.name);
  const playerMismatches = comparisons.filter((team) => team.missingLocalPlayers.length || team.extraLocalPlayers.length);
  const rankMismatches = comparisons.filter((team) => !team.rankMatches || !team.pointsMatch);
  const coachMismatches = comparisons.filter((team) => team.coachMatches === false);
  const ratingWarnings = comparisons.flatMap((team) =>
    team.ratingChecks
      .filter((check) => typeof check.difference === "number" && Math.abs(check.difference) >= 0.08)
      .map((check) => ({ team: team.name, ...check })),
  );

  return {
    generatedAt: new Date().toISOString(),
    rankingDate: "2026-06-08",
    sources: {
      gigobyteHLTV: "https://github.com/gigobyte/HLTV",
      jparedesScraper: "https://github.com/jparedesDS/hltv-scraper",
      hltvRanking: RANKING_URL,
      renderedFallback: "https://r.jina.ai/http://r.jina.ai/http://",
    },
    notes: [
      packageRankingError
        ? `gigobyte/HLTV getTeamRanking was attempted but blocked during this run: ${packageRankingError}`
        : "Ranking position/points come from gigobyte/HLTV getTeamRanking.",
      "Lineups, coaches, and current-team-period ratings come from rendered HLTV team pages using a BeautifulSoup-style markdown parse inspired by jparedesDS/hltv-scraper.",
      "HLTV stats/player filter pages returned Cloudflare verification in direct bot requests, so this report does not claim to verify top5/top10/top20 player-filter splits.",
      "The local dataset intentionally includes Natus Vincere 2018 as a historical extra and excludes it from the 2026 top-20 comparison.",
    ],
    packageRankingError,
    summary: {
      remoteTopTeams: ranking.length,
      local2026Teams: local2026.length,
      historicalExtras: historicalExtras.map((team) => team.name),
      missingTeams,
      extraTeams,
      rankMismatchCount: rankMismatches.length,
      playerMismatchCount: playerMismatches.length,
      coachMismatchCount: coachMismatches.length,
      ratingWarningCount: ratingWarnings.length,
    },
    comparisons,
    rankMismatches,
    playerMismatches,
    coachMismatches,
    ratingWarnings,
  };
}

async function readLocalHltvTeams() {
  const source = await fs.readFile(SOURCE_FILE, "utf8");
  const file = ts.createSourceFile(SOURCE_FILE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = findHltvTeamsDeclaration(file);
  if (!declaration || !ts.isArrayLiteralExpression(declaration.initializer)) {
    throw new Error("Could not find hltvTeams array in src/hltvTop20.ts");
  }
  return declaration.initializer.elements.map((element) => objectLiteralToValue(element));
}

function findHltvTeamsDeclaration(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText() === "hltvTeams") return node;
  return ts.forEachChild(node, findHltvTeamsDeclaration);
}

function objectLiteralToValue(node) {
  if (!ts.isObjectLiteralExpression(node)) return undefined;
  const value = {};
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = property.name.getText().replace(/^["']|["']$/g, "");
    value[key] = expressionToValue(property.initializer);
  }
  return value;
}

function expressionToValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(expressionToValue);
  if (ts.isObjectLiteralExpression(node)) return objectLiteralToValue(node);
  return undefined;
}

function renderMarkdownReport(report) {
  const lines = [
    "# HLTV Top 20 Verification - 2026-06-08",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Sources",
    "",
    `- gigobyte/HLTV: ${report.sources.gigobyteHLTV}`,
    `- jparedesDS/hltv-scraper methodology reference: ${report.sources.jparedesScraper}`,
    `- HLTV ranking page: ${report.sources.hltvRanking}`,
    "",
    "## Summary",
    "",
    `- Remote top teams checked: ${report.summary.remoteTopTeams}`,
    `- Local 2026 teams checked: ${report.summary.local2026Teams}`,
    `- Historical extras excluded: ${report.summary.historicalExtras.join(", ") || "none"}`,
    `- Missing teams: ${report.summary.missingTeams.join(", ") || "none"}`,
    `- Extra local 2026 teams: ${report.summary.extraTeams.join(", ") || "none"}`,
    `- Rank/points mismatches: ${report.summary.rankMismatchCount}`,
    `- Player lineup mismatches: ${report.summary.playerMismatchCount}`,
    `- Coach mismatches: ${report.summary.coachMismatchCount}`,
    `- Rating warnings: ${report.summary.ratingWarningCount}`,
    "",
    "## Team Comparison",
    "",
    "| Rank | Team | Points | Local rank/points | Players | Coach | Rating notes |",
    "| --- | --- | ---: | --- | --- | --- | --- |",
  ];

  for (const item of report.comparisons) {
    const playerText =
      !item.localFound
        ? "missing local team"
        : item.missingLocalPlayers.length || item.extraLocalPlayers.length
          ? `missing ${item.missingLocalPlayers.join(", ") || "-"} / extra ${item.extraLocalPlayers.join(", ") || "-"}`
          : "OK";
    const coachText = item.coachMatches === undefined ? "n/a" : item.coachMatches ? "OK" : `${item.localCoach ?? "-"} vs ${item.remoteCoach ?? "-"}`;
    const ratingNotes = item.ratingChecks
      .filter((check) => typeof check.difference === "number" && Math.abs(check.difference) >= 0.08)
      .map((check) => `${check.handle} ${formatSignedNumber(check.difference)}`)
      .join(", ") || "OK";

    lines.push(
      `| ${item.rank} | ${item.name} | ${item.points} | ${item.localRank ?? "-"} / ${item.localPoints ?? "-"} | ${playerText} | ${coachText} | ${ratingNotes} |`,
    );
  }

  lines.push(
    "",
    "## Notes",
    "",
    ...report.notes.map((note) => `- ${note}`),
    "",
  );

  return `${lines.join("\n").trimEnd()}\n`;
}

function printSummary(report) {
  console.log(`Wrote ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`Wrote ${path.relative(ROOT, OUT_MD)}`);
  console.log(`Missing teams: ${report.summary.missingTeams.join(", ") || "none"}`);
  console.log(`Extra teams: ${report.summary.extraTeams.join(", ") || "none"}`);
  console.log(`Rank/points mismatches: ${report.summary.rankMismatchCount}`);
  console.log(`Player lineup mismatches: ${report.summary.playerMismatchCount}`);
  console.log(`Coach mismatches: ${report.summary.coachMismatchCount}`);
  console.log(`Rating warnings: ${report.summary.ratingWarningCount}`);
}

function mergeRanking(packageRanking, renderedRanking) {
  const renderedByRank = new Map(renderedRanking.map((team) => [team.rank, team]));
  return packageRanking.map((team) => ({ ...team, ...(renderedByRank.get(team.rank) ?? {}) }));
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeHandles(handles) {
  return handles.map(normalizeHandle).filter(Boolean);
}

function normalizeHandle(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "");
}

function cleanHandle(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/[%*,]/g, "").trim();
  if (!cleaned || cleaned === "-") return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatSignedNumber(value) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
