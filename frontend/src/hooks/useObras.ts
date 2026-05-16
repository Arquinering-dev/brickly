import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { getCached, setCached, isStale } from "../lib/cache";

export interface Obra {
  id: string;
  nombre: string;
  codigo: string;
}

const CACHE_KEY = "obras";

// Fetched once on first call, subsequent calls get cached value instantly.
export function useObras() {
  const [obras, setObras] = useState<Obra[]>(getCached<Obra[]>(CACHE_KEY) ?? []);
  const [obrasLoading, setObrasLoading] = useState(obras.length === 0);

  useEffect(() => {
    if (!isStale(CACHE_KEY)) {
      setObrasLoading(false);
      return;
    }
    setObrasLoading(true);
    apiFetch("/api/obras")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((list: Obra[]) => {
        setCached(CACHE_KEY, list);
        setObras(list);
      })
      .catch(() => {})
      .finally(() => setObrasLoading(false));
  }, []);

  return { obras, obrasLoading };
}
