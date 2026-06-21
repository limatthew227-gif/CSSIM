// Real player photos sourced from Liquipedia (CC-BY-SA), fetched by scripts/fetch-player-photos.py
// into src/assets/players/. Keyed by a slug derived from the player handle, so every roster entry
// (current or historical) that shares a handle resolves to the same photo.
const modules = (import.meta as { glob: (p: string, o: object) => Record<string, string> }).glob(
  "./assets/players/*.{jpg,jpeg,png}",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

const bySlug: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const file = path.split("/").pop() ?? "";
  bySlug[file.replace(/\.[^.]+$/, "")] = url;
}

/** Matches the slug rule in scripts/fetch-player-photos.py (lowercase, non-alnum -> dash, trimmed). */
export function photoSlug(handle: string): string {
  return handle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Photo URL for a player handle, or undefined if we don't have one. */
export function playerPhoto(handle: string): string | undefined {
  return bySlug[photoSlug(handle)];
}
