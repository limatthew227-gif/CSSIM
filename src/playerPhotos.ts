// Front-facing, transparent bodyshots keyed by a slug derived from the player handle. Every roster
// entry (current or historical) that shares a handle therefore resolves to the same portrait.
const bodyshotModules = (import.meta as { glob: (p: string, o: object) => Record<string, string> }).glob(
  "./assets/player-bodyshots/*.{webp,png}",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

const bodyshotsBySlug: Record<string, string> = {};
for (const [path, url] of Object.entries(bodyshotModules)) {
  const file = path.split("/").pop() ?? "";
  bodyshotsBySlug[file.replace(/\.[^.]+$/, "")] = url;
}

/** Matches the slug rule in scripts/fetch-player-photos.py (lowercase, non-alnum -> dash, trimmed). */
export function photoSlug(handle: string): string {
  return handle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Photo URL for a player handle, or undefined if we don't have one. */
export function playerPhoto(handle: string): string | undefined {
  return bodyshotsBySlug[photoSlug(handle)];
}
