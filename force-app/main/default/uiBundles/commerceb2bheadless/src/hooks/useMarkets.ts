// Reads the store's configured Markets from application-context (via the cached
// commerce-context singleton). Returns an empty array (not an error) when
// Markets aren't configured yet, so a market switcher can render nothing rather
// than break. See useActiveLocale for the active locale and
// docs/markets-enablement-plan.md for the enablement gate.
import { getAppContext } from "@/lib/commerceContext";
import type { MarketData } from "@/api/types";
import { useAsync, type UseAsyncResult } from "./useAsync";

export function useMarkets(): UseAsyncResult<readonly MarketData[]> {
	return useAsync(async () => (await getAppContext()).markets, []);
}

// What the market switcher needs. application-context's `markets[]` lists only
// the ADDITIONAL (non-home) markets — the store's home market is carried as
// `country` + `defaultCurrency`, NOT as a `markets[]` entry. So the switcher
// must synthesize the home option from these defaults; otherwise a store with a
// single extra market (e.g. only `{de: EUR}`) yields one option and the picker
// hides itself. See MarketSwitcher.buildOptions.
export interface MarketPickerData {
	readonly markets: readonly MarketData[];
	readonly defaultCurrency?: string;
	readonly supportedCurrencies: readonly string[];
}

export function useMarketPicker(): UseAsyncResult<MarketPickerData> {
	return useAsync(async () => {
		const ctx = await getAppContext();
		return {
			markets: ctx.markets,
			defaultCurrency: ctx.defaultCurrency,
			supportedCurrencies: ctx.supportedCurrencies,
		};
	}, []);
}
