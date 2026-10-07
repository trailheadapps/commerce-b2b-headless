// Commerce Context Connect APIs: store-level application context and the
// buyer's session context.
//
// These are the raw fetch layer only. Results are cached and reused by the
// module singleton in `@/lib/commerceContext`, which is warmed once per page
// load — see `preloadCommerceContext()`. Prefer importing `getAppContext()` /
// `getSessionContext()` from there over calling these directly.
import { base, parse, qs, sdkFetch } from "@/api/http";
import type { AppContextData, SessionContextData } from "@/api/types";

// GET /commerce/webstores/{id}/application-context
// Store-level configuration (guest flags, currencies, markets, tax type, ...).
// Fetched `asGuest` because it's store config, not buyer-specific. No `language`
// param — it doesn't localize this response; currency/locale come from the
// payload itself (`defaultCurrency`, `supportedCurrencies`, `markets`).
export async function readAppContext(): Promise<AppContextData> {
	const url = `${base()}/application-context` + qs({ asGuest: true });
	const res = await sdkFetch(url);
	return parse<AppContextData>(res, "Failed to load application context");
}

// GET /commerce/webstores/{id}/session-context
// Buyer session (logged-in state, profile, buyer groups). Effective-account
// switching is not wired yet — add an `effectiveAccountId` query param here
// when B2B account switching is introduced.
export async function readSessionContext(): Promise<SessionContextData> {
	const url = `${base()}/session-context`;
	const res = await sdkFetch(url);
	return parse<SessionContextData>(res, "Failed to load session context");
}
