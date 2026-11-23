"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Minimal async data hook. Keeps the last good data on screen while reloading, so lists
 * don't flash empty after every action.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [key, setKey] = useState(0);
  const [state, setState] = useState<{ key: number; data?: T; error?: string }>({ key: -1 });

  useEffect(() => {
    let live = true;
    fn().then(
      (data) => live && setState({ key, data }),
      (err: unknown) =>
        live && setState((s) => ({ key, data: s.data, error: err instanceof Error ? err.message : String(err) })),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);

  const reload = useCallback(() => setKey((k) => k + 1), []);
  return { data: state.data, error: state.error, loading: state.key !== key, reload };
}
