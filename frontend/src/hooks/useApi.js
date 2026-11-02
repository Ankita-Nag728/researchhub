import { useCallback, useEffect, useRef, useState } from "react";
import { toApiError } from "../services/apiClient";

// Runs an async service call and tracks loading / error / data.
//   const { data, loading, error, retry } = useApi(() => projectService.list(params), [key]);
// - Ignores results from outdated calls (e.g. the user changed a filter quickly).
// - `retry()` re-runs the call, which powers the "Try again" buttons.
export default function useApi(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcherRef
      .current()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((err) => !cancelled && setState({ data: null, loading: false, error: toApiError(err) }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
