// RelationOptionsProvider.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";
import type { Option } from "./relationOptions";
import { Ctx } from "./RelationOptionsContext";

type CacheEntry = {
  options: Option[];
  fetchedAt: number;
};

type StateEntry = {
  loading: boolean;
  error?: unknown;
};

export type ProviderValue = {
  getOptions: (key: string) => Option[] | undefined;
  getState: (key: string) => StateEntry | undefined;
  ensureLoaded: (key: string, loader: () => Promise<Option[]>, ttlMs?: number) => Promise<void>;
  invalidate: (key: string) => void;
  invalidateAll: () => void;
};


export function RelationOptionsProvider({ children }: { children: React.ReactNode }) {
  // cache données
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  // promesses en vol (dedupe)
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map());
  // état UI (loading/error)
  const [stateByKey, setStateByKey] = useState<Record<string, StateEntry>>({});

  const getOptions = useCallback((key: string) => cacheRef.current.get(key)?.options, []);
  const getState = useCallback((key: string) => stateByKey[key], [stateByKey]);

  const invalidate = useCallback((key: string) => {
    cacheRef.current.delete(key);
    inflightRef.current.delete(key);
    setStateByKey((s) => {
      const next = { ...s };
      delete next[key];
      return next;
    });
  }, []);

  const invalidateAll = useCallback(() => {
    cacheRef.current.clear();
    inflightRef.current.clear();
    setStateByKey({});
  }, []);

  const ensureLoaded = useCallback(
    async (key: string, loader: () => Promise<Option[]>, ttlMs?: number) => {
      const now = Date.now();
      const cached = cacheRef.current.get(key);
      const isFresh =
        cached && (ttlMs == null || ttlMs <= 0 ? true : now - cached.fetchedAt < ttlMs);

      if (isFresh) return;

      // dédup: si une requête est déjà en cours, on attend
      const existing = inflightRef.current.get(key);
      if (existing) return existing;

      const p = (async () => {
        setStateByKey((s) => ({ ...s, [key]: { loading: true } }));
        try {
          const options = await loader();
          cacheRef.current.set(key, { options, fetchedAt: Date.now() });
          setStateByKey((s) => ({ ...s, [key]: { loading: false } }));
        } catch (err) {
          setStateByKey((s) => ({ ...s, [key]: { loading: false, error: err } }));
        } finally {
          inflightRef.current.delete(key);
        }
      })();

      inflightRef.current.set(key, p);
      return p;
    },
    []
  );

  const value = useMemo<ProviderValue>(
    () => ({ getOptions, getState, ensureLoaded, invalidate, invalidateAll }),
    [getOptions, getState, ensureLoaded, invalidate, invalidateAll]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}


