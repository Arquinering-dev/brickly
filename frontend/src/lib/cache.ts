// Module-level in-memory cache with stale-while-revalidate semantics.
// Survives React component unmounts (navigation between tabs).

interface Entry<T> { data: T; ts: number }

const store = new Map<string, Entry<unknown>>();
const STALE_MS = 5 * 60 * 1000; // 5 min

export function getCached<T>(key: string): T | null {
  const e = store.get(key) as Entry<T> | undefined;
  return e ? e.data : null;
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, ts: Date.now() });
}

export function isStale(key: string): boolean {
  const e = store.get(key);
  return !e || Date.now() - e.ts > STALE_MS;
}

export function invalidate(key: string): void {
  store.delete(key);
}
