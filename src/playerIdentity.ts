import type { Player } from "./gameData";

export interface PlayerTeamIdentity {
  id: string;
}

const GENERATED_DRAFT_PREFIX = /^user-pick-\d+-/;

export function normalizeIdentityPart(value: string | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function basePlayerId(player: Player) {
  return normalizeIdentityPart(player.id.replace(GENERATED_DRAFT_PREFIX, ""));
}

export function canonicalPlayerKey(player: Player) {
  const country = normalizeIdentityPart(player.country) || "xx";
  const handle = normalizeIdentityPart(player.handle);
  const realName = normalizeIdentityPart(player.realName);

  if (handle || realName) {
    return ["player", country, handle || "unknown", realName || "unknown"].join(":");
  }

  return ["player", "id", basePlayerId(player)].join(":");
}

export function playerVersionKey(player: Player) {
  const sourceYear = normalizeIdentityPart(player.source?.year);
  const sourceName = normalizeIdentityPart(player.source?.name);
  return [canonicalPlayerKey(player), sourceYear, sourceName].filter(Boolean).join(":");
}

export function playerInstanceKey(team: PlayerTeamIdentity, player: Player) {
  return ["instance", normalizeIdentityPart(team.id), normalizeIdentityPart(player.id)].join(":");
}
