export interface RunSummary {
  teamName: string;
  mode: string;
  runKind: string;
  phase: string;
  screen: string;
  recordLabel: string;
  matchCount: number;
  detail: string;
}

export interface SavedRunSlot<TSnapshot = unknown> {
  id: string;
  schemaVersion: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  summary: RunSummary;
  snapshot: TSnapshot;
}

const RUN_DB_KEY = "major-draft-lab-run-db-v1";
const RUN_DB_VERSION = 1;
const MAX_RUN_SLOTS = 8;

export function loadRunSlots<TSnapshot = unknown>(): SavedRunSlot<TSnapshot>[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RUN_DB_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSavedRunSlot)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) as SavedRunSlot<TSnapshot>[];
  } catch {
    return [];
  }
}

export function saveRunSlot<TSnapshot>(
  snapshot: TSnapshot,
  summary: RunSummary,
  existingId?: string,
): SavedRunSlot<TSnapshot> {
  const current = loadRunSlots<TSnapshot>();
  const now = new Date().toISOString();
  const existing = existingId ? current.find((slot) => slot.id === existingId) : undefined;
  const slot: SavedRunSlot<TSnapshot> = {
    id: existing?.id ?? makeRunId(),
    schemaVersion: RUN_DB_VERSION,
    name: summary.teamName || "Saved run",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    summary,
    snapshot,
  };
  const next = [slot, ...current.filter((item) => item.id !== slot.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_RUN_SLOTS);
  writeRunSlots(next);
  return slot;
}

export function deleteRunSlot(id: string) {
  const next = loadRunSlots().filter((slot) => slot.id !== id);
  writeRunSlots(next);
}

export function formatRunSlotTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function writeRunSlots(slots: SavedRunSlot[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RUN_DB_KEY, JSON.stringify(slots));
}

function isSavedRunSlot(value: unknown): value is SavedRunSlot {
  if (!value || typeof value !== "object") return false;
  const slot = value as Partial<SavedRunSlot>;
  return (
    typeof slot.id === "string" &&
    typeof slot.createdAt === "string" &&
    typeof slot.updatedAt === "string" &&
    Boolean(slot.summary) &&
    typeof slot.summary === "object" &&
    "snapshot" in slot
  );
}

function makeRunId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
