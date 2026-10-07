// Address normalization shared by the checkout address form and the checkout
// page (delivery + purchase-order billing). Keeps a single definition of how a
// buyer address maps onto what the Connect API expects, so every entry path
// (new form, saved-address picker, default address) produces the same payload.
import type { CheckoutAddress } from "@/api/types";
import { DEFAULT_LOCALE, normalizeToBcp47 } from "@/lib/locale";

// Fallback country when the store advertises none / context hasn't loaded.
export const DEFAULT_COUNTRY = "US";

// Countries whose subdivision codes this org's State/Country picklist accepts.
// Only these carry a region/StateCode; for every other country the region is
// dropped, because this org's picklist has no entries for it and rejects ANY
// value with INVALID_API_INPUT ("invalid value for the StateCode field").
// Mirrors the curated picklists in the address form; extend this (and
// STATES_BY_COUNTRY there) whenever the org configures more subdivisions.
// (DE's 16 Bundesländer were added to the org picklist — see Settings:Address.)
export const REGION_COUNTRIES: ReadonlySet<string> = new Set(["US", "DE"]);

// English country name for an ISO-3166 alpha-2 code ("US" → "United States").
export function countryLabel(iso: string): string {
	try {
		return new Intl.DisplayNames([DEFAULT_LOCALE], { type: "region" }).of(iso) ?? iso;
	} catch {
		return iso;
	}
}

// Resolve a free-form country value to one of the store's ISO codes. Accepts an
// ISO code ("US" / "us") or an English country name ("United States") — saved
// addresses can carry either. Returns undefined when it doesn't match a
// shippable country.
export function toIsoCountry(
	value: string | undefined,
	countries: readonly string[],
): string | undefined {
	if (!value) return undefined;
	const upper = value.trim().toUpperCase();
	if (countries.includes(upper)) return upper;
	const lower = value.trim().toLowerCase();
	for (const c of countries) {
		if (countryLabel(c).toLowerCase() === lower) return c;
	}
	return undefined;
}

// Default country for a NEW address: prefer a region encoded in the active
// locale ("en-US" → US, "de" → DE), then the store's home country, then the
// first shippable country. Keeps the form aligned with the market the shopper
// is browsing instead of always forcing US.
export function preferredCountry(
	locale: string,
	countries: readonly string[],
	homeCountry: string | undefined,
): string {
	const [lang, region] = normalizeToBcp47(locale).split("-");
	for (const candidate of [region, lang?.toUpperCase()]) {
		if (candidate && countries.includes(candidate)) return candidate;
	}
	if (homeCountry && countries.includes(homeCountry)) return homeCountry;
	return countries[0] ?? DEFAULT_COUNTRY;
}

// Normalize an address to what the Connect API expects, matching the address
// form's own handling:
//   - country coerced to an ISO code when it maps to a shippable country
//     (falls back to the original value so we never send something worse), and
//   - region/StateCode sent ONLY for countries whose subdivisions the org's
//     picklist accepts (REGION_COUNTRIES); dropped (and empty values dropped)
//     otherwise. The org's State/Country picklist rejects any StateCode it
//     doesn't know — including every value for a country with no configured
//     subdivisions (e.g. DE) — with INVALID_API_INPUT, so those must omit it.
export function normalizeAddress(
	addr: CheckoutAddress,
	countries: readonly string[],
): CheckoutAddress {
	const country = toIsoCountry(addr.country, countries) ?? addr.country;
	const region = addr.region?.trim();
	return {
		...addr,
		country,
		region: region && country && REGION_COUNTRIES.has(country) ? region : undefined,
	};
}
