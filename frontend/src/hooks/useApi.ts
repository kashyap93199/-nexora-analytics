import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { apiErrorMessage } from "../lib/utils";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch a GET endpoint with loading/error states and manual refetch.
 * Provide a `depsKey` to trigger refetch when inputs (e.g. date range) change.
 */
export function useApi<T>(path: string | null, depsKey?: string | number | null): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const depsKeyString = depsKey ?? "";
  const effectivePath = path ?? "";

  useEffect(() => {
    if (!effectivePath) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let active = true;
    setLoading(true);
    setError(null);

    api
      .get<T>(effectivePath, { signal: controller.signal })
      .then((result) => {
        if (active) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active && !controller.signal.aborted) {
          setError(apiErrorMessage(err));
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePath, depsKeyString, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refetch };
}

/** Mutation helper: runs a request function and returns success/error handling to caller. */
export function useMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (args: TArgs): Promise<TResult> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fn(args);
        return result;
      } catch (err) {
        const message = apiErrorMessage(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fn]
  );

  return { run, loading, error, clearError: () => setError(null) };
}
