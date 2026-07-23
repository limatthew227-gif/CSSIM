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
const AUTOSAVE_KEY = "major-draft-lab-autosave-v1";
const RUN_STATE_DB = "cssim-run-state";
const RUN_STATE_STORE = "state";

let runStateDbPromise: Promise<IDBDatabase> | undefined;

function openRunStateDb() {
  if (typeof indexedDB === "undefined") return undefined;
  runStateDbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(RUN_STATE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(RUN_STATE_STORE)) {
        request.result.createObjectStore(RUN_STATE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return runStateDbPromise;
}

function persistAutosaveBackup(value: string | null) {
  const db = openRunStateDb();
  if (!db) return;
  void db.then((database) => {
    const store = database.transaction(RUN_STATE_STORE, "readwrite").objectStore(RUN_STATE_STORE);
    if (value == null) store.delete(AUTOSAVE_KEY);
    else store.put(value, AUTOSAVE_KEY);
  }).catch(() => undefined);
}

export interface Autosave<TSnapshot = unknown> {
  schemaVersion: number;
  updatedAt: string;
  summary: RunSummary;
  snapshot: TSnapshot;
}

// A single rolling autosave so a reload resumes the career/run where it left off (distinct from the
// manual save slots). IndexedDB keeps the latest state durable when localStorage is full.
export function writeAutosave<TSnapshot>(snapshot: TSnapshot, summary: RunSummary): Autosave<TSnapshot> | null {
  if (typeof window === "undefined") return null;
  let payload: Autosave<TSnapshot>;
  let serialized: string;
  try {
    payload = { schemaVersion: RUN_DB_VERSION, updatedAt: new Date().toISOString(), summary, snapshot };
    serialized = JSON.stringify(payload);
  } catch {
    return null;
  }
  persistAutosaveBackup(serialized);
  try {
    window.localStorage.setItem(AUTOSAVE_KEY, serialized);
  } catch {
    // IndexedDB remains the durable copy when localStorage is full.
  }
  return payload;
}

export function readAutosave<TSnapshot>(): Autosave<TSnapshot> | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTOSAVE_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object" || !("snapshot" in parsed)) return null;
    return parsed as Autosave<TSnapshot>;
  } catch {
    return null;
  }
}

export async function readAutosaveBackup<TSnapshot>(): Promise<Autosave<TSnapshot> | null> {
  const db = openRunStateDb();
  if (!db) return null;
  try {
    const database = await db;
    const stored = await new Promise<string | undefined>((resolve, reject) => {
      const request = database.transaction(RUN_STATE_STORE, "readonly").objectStore(RUN_STATE_STORE).get(AUTOSAVE_KEY);
      request.onsuccess = () => resolve(request.result as string | undefined);
      request.onerror = () => reject(request.error);
    });
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || !("snapshot" in parsed)) return null;
    return parsed as Autosave<TSnapshot>;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTOSAVE_KEY);
  persistAutosaveBackup(null);
}

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
