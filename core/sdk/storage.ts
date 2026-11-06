/** Namespaced localStorage-Wrapper. Fällt auf Speicher im RAM zurück, wenn localStorage fehlt. */
export interface GameStorage {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

const memory = new Map<string, string>();

function backend(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Zugriff blockiert (z. B. privater Modus): RAM-Fallback
  }
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
    removeItem: (k) => void memory.delete(k),
  };
}

export function createStorage(namespace: string): GameStorage {
  const prefix = `vibegames:${namespace}:`;
  return {
    get(key, fallback) {
      try {
        const raw = backend().getItem(prefix + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        backend().setItem(prefix + key, JSON.stringify(value));
      } catch {
        // Speicher voll oder blockiert: still ignorieren
      }
    },
    remove(key) {
      try {
        backend().removeItem(prefix + key);
      } catch {
        // ignorieren
      }
    },
  };
}
