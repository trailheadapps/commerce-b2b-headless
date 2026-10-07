// The ISO country codes the store can ship to, plus its home country — both
// read from application-context (via the cached commerce-context singleton).
//
// `shippingCountries` is what drives the address form's Country picker: it's the
// same list the server advertises (e.g. `["US","DE"]` once a German market is
// configured). Returns sensible fallbacks (US) rather than throwing, so the
// address form can always render a usable control even before context loads or
// if Markets aren't set up yet.
import { getAppContext } from "@/lib/commerceContext";
import { useAsync, type UseAsyncResult } from "./useAsync";

export interface ShippingCountriesData {
	// ISO-3166 alpha-2 codes the store ships to.
	readonly countries: readonly string[];
	// The store's default/home country ISO code.
	readonly homeCountry: string;
}

export function useShippingCountries(): UseAsyncResult<ShippingCountriesData> {
	return useAsync(async () => {
		const ctx = await getAppContext();
		return {
			countries: ctx.shippingCountries ?? [],
			homeCountry: ctx.country || "US",
		};
	}, []);
}
