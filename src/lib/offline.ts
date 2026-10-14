// Offline-first queue: entries logged without connectivity are stored locally
// and flushed to Google Sheets as soon as the device comes back online.

export type QueuedEntry = {
  id: string;
  tab: string;
  dateText: string;
  values: Record<string, number>;
  queuedAt: number;
};

const KEY = "rmb-pending-entries";
const CACHE_PREFIX = "rmb-cache:";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getQueue(): QueuedEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse<QueuedEntry[]>(window.localStorage.getItem(KEY), []);
}

function setQueue(q: QueuedEntry[]) {
  window.localStorage.setItem(KEY, JSON.stringify(q));
  window.dispatchEvent(new Event("rmb-queue-change"));
}

export function enqueue(entry: Omit<QueuedEntry, "id" | "queuedAt">) {
  const q = getQueue().filter((e) => !(e.tab === entry.tab && e.dateText === entry.dateText));
  q.push({ ...entry, id: crypto.randomUUID(), queuedAt: Date.now() });
  setQueue(q);
}

export function dequeue(id: string) {
  setQueue(getQueue().filter((e) => e.id !== id));
}

export function cacheTab<T>(tab: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + tab, JSON.stringify(data));
  } catch {
    /* quota exceeded — cache is best effort */
  }
}

export function readCachedTab<T>(tab: string): T | null {
  if (typeof window === "undefined") return null;
  return safeParse<T | null>(window.localStorage.getItem(CACHE_PREFIX + tab), null);
}
