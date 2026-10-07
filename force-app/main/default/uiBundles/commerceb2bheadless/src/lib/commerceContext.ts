// Commerce context singleton (module-level cache).
//
// Mirrors how `ui-commerce-components` stores application- and session-context:
// fetch each once, keep the parsed response in a module-scoped variable, and
// hand that same cached object to every caller. Any other API module can call
// `getAppContext()` / `getSessionContext()` and get the already-loaded value
// without a second network round-trip.
//
// Warming: `preloadCommerceContext()` is invoked once at app bootstrap
// (see `app.tsx`), so the fetches are in flight before the first page renders.
// A full browser reload re-runs this module, clearing the cache and refetching
// — that's the refresh mechanism (there's no time-based TTL).
//
// Note: this is a plain singleton, so it does NOT re-render React components on
// change. Read it imperatively (inside handlers / other API calls). If a
// component needs to render off it reactively, wrap it in a Context/store.
import { readAppContext, readSessionContext } from "@/api/context";
import type {
	AppContextData,
	CheckoutSettingsData,
	GiftingConfig,
	InventoryConfigurationData,
	MarketData,
	ProductConfig,
	SessionContextData,
	SessionUserProfile,
	StatusValue,
	SubscriptionConfig,
} from "@/api/types";
import { COMMERCE } from "@/config/commerce";

// ────────────────────────────────────────────────────────────────────────────
// Derived shapes — the transformed views callers actually consume.
// ────────────────────────────────────────────────────────────────────────────

export interface AppContext {
	readonly webstoreId: string;
	readonly guestBrowsingEnabled: boolean;
	readonly guestCartEnabled: boolean;
	readonly guestCheckoutEnabled: boolean;
	readonly isGuestCartCheckoutEnabled: boolean;
	readonly splitShipmentEnabled: boolean;
	readonly cartCalculateEnabled: boolean;
	readonly placeOrderV2Enabled: boolean;
	readonly commerceMultiCartEnabled: boolean;
	readonly hideShippingAddress: boolean;
	readonly shopperConsentEnabled: boolean;
	readonly skipPhoneNumberValidationEnabled: boolean;
	readonly taxType: string;
	readonly country: string;
	readonly shippingCountries: readonly string[];
	// Currency to use for pricing/display, resolved from the store config.
	readonly currencyIsoCode?: string;
	readonly defaultCurrency?: string;
	readonly supportedCurrencies: readonly string[];
	readonly sessionDrivenCurrency: boolean;
	readonly managedCheckoutVersion?: string;
	readonly markets: readonly MarketData[];
	readonly orderStatuses: readonly StatusValue[];
	readonly quoteStatuses: readonly StatusValue[];
	readonly checkoutSettings?: CheckoutSettingsData;
	readonly giftingConfig: GiftingConfig;
	readonly subscriptionConfig: SubscriptionConfig;
	readonly productConfig: ProductConfig;
	readonly inventoryConfiguration?: InventoryConfigurationData;
}

export interface SessionContext {
	readonly userId?: string;
	readonly userType?: string;
	readonly isLoggedIn: boolean;
	readonly userName?: string;
	// The buyer's effective account — used as `effectiveAccountId` on
	// account-scoped calls (pricing, tax, promotions). Null/undefined for guests.
	readonly accountId?: string | null;
	readonly accountName?: string | null;
	readonly profile?: SessionUserProfile;
	readonly buyerGroups?: ReadonlyArray<{ id: string; name: string }>;
}

// ────────────────────────────────────────────────────────────────────────────
// Transforms (raw wire shape → derived view).
// ────────────────────────────────────────────────────────────────────────────

export function toAppContext(data: AppContextData): AppContext {
	return {
		webstoreId: COMMERCE.WEBSTORE_ID,
		guestBrowsingEnabled: Boolean(data?.guestBrowsingEnabled),
		guestCartEnabled: Boolean(data?.guestCartEnabled),
		guestCheckoutEnabled: Boolean(data?.guestCheckoutEnabled),
		isGuestCartCheckoutEnabled: Boolean(data?.guestCartCheckoutEnabled),
		splitShipmentEnabled: Boolean(data?.splitShipmentEnabled),
		cartCalculateEnabled: Boolean(data?.cartCalculateEnabled),
		placeOrderV2Enabled: Boolean(data?.placeOrderV2Enabled),
		commerceMultiCartEnabled: Boolean(data?.commerceMultiCartEnabled),
		hideShippingAddress: Boolean(data?.hideShippingAddress),
		shopperConsentEnabled: Boolean(data?.shopperConsentEnabled),
		skipPhoneNumberValidationEnabled: Boolean(data?.skipPhoneNumberValidationEnabled),
		taxType: data?.taxType ?? "",
		country: data?.country ?? "",
		shippingCountries: data?.shippingCountries ?? [],
		currencyIsoCode: resolveCurrencyIsoCode(data),
		defaultCurrency: data?.defaultCurrency,
		supportedCurrencies: data?.supportedCurrencies ?? [],
		sessionDrivenCurrency: Boolean(data?.sessionDrivenCurrency),
		managedCheckoutVersion: data?.managedCheckoutVersion,
		markets: data?.markets ?? [],
		orderStatuses: data?.orderStatuses ?? [],
		quoteStatuses: data?.quoteStatuses ?? [],
		checkoutSettings: data?.checkoutSettings,
		giftingConfig:
			data?.giftingConfig ?? {
				isGiftingEnabled: false,
				isGiftMessageEnabled: false,
				isGiftWrapEnabled: false,
			},
		subscriptionConfig:
			data?.subscriptionConfig ?? {
				subscriptionPlusEnabled: false,
				rlmSubscriptionEnabled: false,
			},
		productConfig: data?.productConfig ?? {},
		inventoryConfiguration: data?.inventoryConfiguration,
	};
}

// Resolve the ISO currency code for pricing/display: a single supported
// currency wins; otherwise fall back to the store default. Locale→currency
// mapping via `markets[].localeCurrencyMap` can be layered on later.
export function resolveCurrencyIsoCode(data: AppContextData): string | undefined {
	if (data?.supportedCurrencies?.length === 1) return data.supportedCurrencies[0];
	return data?.defaultCurrency;
}

export function toSessionContext(data: SessionContextData): SessionContext {
	return {
		userId: data?.userId,
		userType: data?.userType,
		// Guests come back with `guestUser: true` (or absent); only an explicit
		// `false` means an authenticated buyer.
		isLoggedIn: data?.guestUser === false,
		userName: data?.profile?.firstName,
		accountId: data?.accountId,
		accountName: data?.accountName,
		profile: data?.profile,
		buyerGroups: data?.buyerGroups,
	};
}

// ────────────────────────────────────────────────────────────────────────────
// Module singleton cache.
//   *Data       — the parsed response, once loaded (the shared object).
//   *Promise    — the in-flight request, so concurrent callers share one fetch.
// ────────────────────────────────────────────────────────────────────────────

let appContextData: AppContextData | undefined;
let appContextPromise: Promise<AppContextData> | undefined;
let sessionContextData: SessionContextData | undefined;
let sessionContextPromise: Promise<SessionContextData> | undefined;

function loadAppContextData(): Promise<AppContextData> {
	if (appContextData) return Promise.resolve(appContextData);
	if (!appContextPromise) {
		appContextPromise = readAppContext()
			.then((data) => (appContextData = data))
			.finally(() => {
				appContextPromise = undefined;
			});
	}
	return appContextPromise;
}

function loadSessionContextData(): Promise<SessionContextData> {
	if (sessionContextData) return Promise.resolve(sessionContextData);
	if (!sessionContextPromise) {
		sessionContextPromise = readSessionContext()
			.then((data) => (sessionContextData = data))
			.finally(() => {
				sessionContextPromise = undefined;
			});
	}
	return sessionContextPromise;
}

// ────────────────────────────────────────────────────────────────────────────
// Public accessors.
// ────────────────────────────────────────────────────────────────────────────

/** Store-level application context (guest flags, currency, tax type, ...). */
export async function getAppContext(): Promise<AppContext> {
	return toAppContext(await loadAppContextData());
}

/** Raw application-context response, for callers that need un-transformed fields. */
export function getAppContextData(): Promise<AppContextData> {
	return loadAppContextData();
}

/** Buyer session context (logged-in state, profile, buyer groups). */
export async function getSessionContext(): Promise<SessionContext> {
	return toSessionContext(await loadSessionContextData());
}

/** Raw session-context response, for callers that need un-transformed fields. */
export function getSessionContextData(): Promise<SessionContextData> {
	return loadSessionContextData();
}

// Salesforce returns the "empty" 15/18-char id (all zeros) rather than null for
// a guest / account-less session. That value is NOT a usable `effectiveAccountId`
// — the platform rejects it with ILLEGAL_QUERY_PARAMETER_VALUE — so treat it as
// "no account".
function isNullSfid(id: string | null | undefined): boolean {
	return !id || /^0{15}([A-Za-z0-9]{3})?$/.test(id);
}

/**
 * The buyer's effective account id, or `undefined` for a guest / account-less
 * session.
 *
 * This is the value account-scoped Connect calls (pricing, tax, promotions)
 * must send as `effectiveAccountId` — without it the platform evaluates them in
 * a guest context and returns "not found" / 403, which is why PDP + checkout
 * pricing was failing. Reads the cached session-context (warmed at bootstrap by
 * `preloadCommerceContext`), so it adds no network round-trip in the hot path.
 */
export async function getEffectiveAccountId(): Promise<string | undefined> {
	const data = await loadSessionContextData();
	return isNullSfid(data?.accountId) ? undefined : data?.accountId ?? undefined;
}

/**
 * Warm both contexts once at app bootstrap. Fire-and-forget: failures are
 * logged, not thrown — the next `getAppContext()` / `getSessionContext()` call
 * will surface the error (and retry, since a failed load clears its cache).
 */
export function preloadCommerceContext(): void {
	void loadAppContextData().catch((err) =>
		console.warn("[commerceContext] application-context preload failed", err),
	);
	void loadSessionContextData().catch((err) =>
		console.warn("[commerceContext] session-context preload failed", err),
	);
}

/**
 * Clear the cached contexts so the next access refetches. Call after events
 * that invalidate the session (e.g. login / logout).
 */
export function resetCommerceContext(): void {
	appContextData = undefined;
	appContextPromise = undefined;
	sessionContextData = undefined;
	sessionContextPromise = undefined;
}
