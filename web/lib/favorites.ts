"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Favourites belong to a person, not to the record, and this build has no accounts -
 * so they live in the browser. When sign-in lands they move to a table keyed by user,
 * which is where Attio keeps them, and this hook is the only thing that changes.
 */
const storageKey = (scope: string) => `hyring.favorites.${scope}`;

function read(scope: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function useFavorites(scope: string) {
  const [ids, setIds] = useState<string[]>([]);
  /** False until storage has been read, so callers can avoid rendering an empty state
   *  for a frame and then replacing it with the saved favourites. */
  const [ready, setReady] = useState(false);

  // Read after mount. localStorage does not exist while the page renders on the server,
  // and reading it during render would make the markup disagree on hydration.
  useEffect(() => {
    setIds(read(scope));
    setReady(true);
  }, [scope]);

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        const next = prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id];
        try {
          localStorage.setItem(storageKey(scope), JSON.stringify(next));
        } catch {
          // Private windows and blocked site data. The star still works for this session.
        }
        return next;
      });
    },
    [scope],
  );

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, ready, isFavorite, toggle };
}
