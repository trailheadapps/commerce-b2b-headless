// Active-locale resolution for the headless storefront.
//
// Commerce Markets resolve entirely from the SESSION locale server-side; the
// client's only jobs are (a) to know which locale is active so response
// *content* (the Connect `language` param) and currency formatting track it,
// and (b) to switch markets by navigating to a locale-scoped URL. This module
// is the single source of truth for "what locale is active right now" so the
// rest of the app never re-derives it inconsistently.
//
// Signal precedence (first hit wins):
//   0. An explicit shopper pick from the market switcher, persisted in
//      localStorage. This is a headless storefront: we drive the market by
//      sending the active locale as the Connect `language` param, so the
//      shopper's choice must win over the ambient site locale and survive the
//      full-page reload the switch performs.
//   1. SFDC_ENV locale/lang fields, if the LWR runtime exposes them.
//   2. A `xx-YY` / `xx_YY` locale segment in the URL path (LWR Experience sites
//      carry the active site language as a path segment, e.g. /de-DE/…).
//   3. navigator.language.
//   4. DEFAULT_LOCALE.
//
// NOTE (Part 1 dependency — see docs/markets-enablement-plan.md): where the
// active locale actually surfaces for THIS bundle is only confirmable once the
// Experience site is multi-language. Until then this resolves to en-US. The
// server market matcher is EXACT string equality on the session locale, so the
// value a Market's `Locale` BuyerCriteria carries must match what the session
// produces (`en_US` vs BCP-47 `en-US`) — this module cannot paper over that.

import type { MarketData } from "@/api/types";

export const DEFAULT_LOCALE = "en-US";

// Matches a locale that includes a region: `de-DE`, `de_DE`, `pt-BR`. Region is
// required so bare path words (`cart`, `store`) and lone language codes can't
// false-positive as a locale segment.
const LOCALE_WITH_REGION = /^([a-z]{2})[-_]([A-Za-z]{2})$/;

// Normalize any locale-ish string to BCP-47 form: lowercase language, uppercase
// region, hyphen separator. `en_US` → `en-US`, `DE` → `de`, `pt_br` → `pt-BR`.
export function normalizeToBcp47(locale: string): string {
	const parts = locale.trim().split(/[-_]/);
	if (parts.length === 0 || parts[0] === "") return locale;
	const lang = parts[0].toLowerCase();
	if (parts.length === 1) return lang;
	const region = parts[1].toUpperCase();
	return `${lang}-${region}`;
}

// Convert a locale to the underscore form used as `localeCurrencyMap` keys in
// the Connect `market` representation (`de-DE` → `de_DE`).
export function toUnderscoreLocale(locale: string): string {
	return normalizeToBcp47(locale).replace("-", "_");
}

// localStorage key holding the shopper's explicitly-picked locale (BCP-47).
const LOCALE_STORAGE_KEY = "cirrus.activeLocale";

function safeStorage(): Storage | undefined {
	try {
		return typeof localStorage !== "undefined" ? localStorage : undefined;
	} catch {
		// Storage can throw (privacy mode, disabled cookies) — treat as absent.
		return undefined;
	}
}

function fromStorage(): string | undefined {
	const raw = safeStorage()?.getItem(LOCALE_STORAGE_KEY);
	return raw && raw.trim() !== "" ? normalizeToBcp47(raw) : undefined;
}

/**
 * Persist the shopper's chosen locale and make it the active one. The market
 * switcher calls this, then triggers a full-page reload so every cached context
 * + Connect call picks the new locale up. Pass a market's `localeCurrencyMap`
 * key (e.g. `en_US`, `de`); it's normalized to BCP-47 before storage.
 */
export function setActiveLocale(locale: string): void {
	safeStorage()?.setItem(LOCALE_STORAGE_KEY, normalizeToBcp47(locale));
}

/** Clear a persisted locale pick, reverting to the ambient/default locale. */
export function clearActiveLocale(): void {
	safeStorage()?.removeItem(LOCALE_STORAGE_KEY);
}

function fromSfdcEnv(): string | undefined {
	const env = (globalThis as { SFDC_ENV?: Record<string, unknown> }).SFDC_ENV;
	if (!env) return undefined;
	for (const key of ["locale", "lang", "language", "localeString"]) {
		const v = env[key];
		if (typeof v === "string" && v.trim() !== "") return normalizeToBcp47(v);
	}
	return undefined;
}

function fromUrlPath(): string | undefined {
	if (typeof globalThis.location === "undefined") return undefined;
	const segments = globalThis.location.pathname.split("/").filter(Boolean);
	for (const seg of segments) {
		if (LOCALE_WITH_REGION.test(seg)) return normalizeToBcp47(seg);
	}
	return undefined;
}

function fromNavigator(): string | undefined {
	const lang = typeof navigator !== "undefined" ? navigator.language : undefined;
	return lang && lang.trim() !== "" ? normalizeToBcp47(lang) : undefined;
}

// Resolve the active locale (BCP-47). Pure read — safe to call anywhere.
export function getActiveLocale(): string {
	return (
		fromStorage() ?? fromSfdcEnv() ?? fromUrlPath() ?? fromNavigator() ?? DEFAULT_LOCALE
	);
}

// The value to send as the Connect `language` query param. On this headless
// storefront the request language is what the server resolves the Commerce
// Market (hence currency + entitlement pricing) from, so it must track the
// active locale rather than being hardcoded.
export function activeLanguage(): string {
	return getActiveLocale();
}

// Human-friendly label for a market option: the country/region name when the
// locale carries a region (`en-US` → "United States"), else the language name
// (`de` → "German"), with the currency appended (`United States · USD`).
// Rendered in English (DEFAULT_LOCALE) so labels stay stable across switches.
export function localeLabel(locale: string, currency?: string): string {
	const bcp = normalizeToBcp47(locale);
	const [lang, region] = bcp.split("-");
	let name = bcp;
	try {
		const dn = new Intl.DisplayNames([DEFAULT_LOCALE], {
			type: region ? "region" : "language",
		});
		name = dn.of(region ?? lang) ?? bcp;
	} catch {
		name = bcp;
	}
	return currency ? `${name} · ${currency}` : name;
}

// The currency a given locale resolves to, per the markets' localeCurrencyMap
// (from application-context, see @/lib/commerceContext getAppContext().markets).
// Returns undefined when no configured market serves that locale (markets not
// set up yet) — callers fall back to a response `currencyIsoCode`.
//
// localeCurrencyMap keys mirror each market's Locale BuyerCriteria value, which
// may be a full locale (`en_US`) OR a bare language (`de`) — verified live: the
// German market keys on `de`, not `de_DE`. So try the full underscore form
// first, then the bare language, matching the server's own tolerance.
export function currencyForLocale(
	markets: readonly MarketData[],
	locale: string,
): string | undefined {
	const full = toUnderscoreLocale(locale);
	const lang = full.split("_")[0];
	for (const candidate of full === lang ? [full] : [full, lang]) {
		for (const m of markets) {
			const cur = m.localeCurrencyMap?.[candidate];
			if (cur) return cur;
		}
	}
	return undefined;
}
