"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

export interface Query<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  /** Re-runs the fetcher, keeping the current data on screen while it loads. */
  refresh: () => Promise<void>;
  /** Replaces the cached value without a round trip (used after a mutation returns one). */
  set: (value: T) => void;
}

/**
 * Minimal data hook: runs `fetcher` on mount and whenever `deps` change, and ignores
 * responses that arrive after a newer request has started.
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []): Query<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const generation = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    setLoading(true);
    try {
      const value = await fetcherRef.current();
      if (!alive.current || mine !== generation.current) return;
      setData(value);
      setError(undefined);
    } catch (e) {
      if (!alive.current || mine !== generation.current) return;
      setError(e instanceof ApiError ? e.message : (e as Error)?.message ?? "Something went wrong");
    } finally {
      if (alive.current && mine === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refresh: load, set: setData };
}

/** Wraps an async action with pending state and a readable error. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setPending(true);
    setError(undefined);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error)?.message ?? "Something went wrong");
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending, error, clearError: () => setError(undefined) };
}

/** Polls while `enabled` is true - used for live run logs and the recipients table. */
export function useInterval(fn: () => void, ms: number, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}
