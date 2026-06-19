// Tiny hook for one-shot async fetches. Returns {data, loading, error, reload}.
// Accepts a dependency list; re-runs when deps change.
//
// Intentionally minimal — we don't need caching/dedup beyond what a page lives
// for. For shared mutable state (like the cart), use CartContext instead.

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAsyncResult<T> {
	readonly data: T | null;
	readonly loading: boolean;
	readonly error: string | null;
	reload: () => void;
}

export function useAsync<T>(
	fn: () => Promise<T>,
	deps: ReadonlyArray<unknown>,
): UseAsyncResult<T> {
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [tick, setTick] = useState(0);
	// Guard against setState on unmounted component.
	const alive = useRef(true);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);

	useEffect(() => {
		setLoading(true);
		setError(null);
		fn()
			.then((result) => {
				if (alive.current) setData(result);
			})
			.catch((err: unknown) => {
				if (alive.current) setError(err instanceof Error ? err.message : String(err));
			})
			.finally(() => {
				if (alive.current) setLoading(false);
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [...deps, tick]);

	const reload = useCallback(() => setTick((n) => n + 1), []);
	return { data, loading, error, reload };
}
