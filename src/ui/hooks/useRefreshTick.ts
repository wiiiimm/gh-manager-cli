import { useEffect, useState } from 'react';

/**
 * A whole-minute integer counter that re-renders the list ~once a minute so
 * relative "Updated …" labels stay current (SWR-377). Extracted from RepoList
 * (GMC-28).
 *
 * `formatDate` derives its relative label from the elapsed time since each
 * repo's own `updatedAt`, so a row flips (e.g. "today" → "yesterday") at
 * `updatedAt + k·24h` — its own time-of-day, not at midnight. A coarse day
 * bucket would therefore leave most rows stale for hours. Ticking once per
 * minute re-renders the (virtualised) visible rows within ~a minute of their
 * true boundary. The value never changes between keystrokes, so the
 * per-keystroke memoisation from SWR-358 is preserved.
 *
 * @returns the current whole-minute tick (pass it to memoised rows to bust
 * their memo on the minute boundary).
 */
export function useRefreshTick(): number {
  const [refreshTick, setRefreshTick] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const id = setInterval(() => {
      const next = Math.floor(Date.now() / 60_000);
      setRefreshTick(prev => (prev !== next ? next : prev));
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return refreshTick;
}
