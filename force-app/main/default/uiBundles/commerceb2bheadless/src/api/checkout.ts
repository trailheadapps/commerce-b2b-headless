// Checkout Connect API: start, address, delivery, payment, place order.
import type { CheckoutAddress, CheckoutState } from "@/api/types";
import { base, parse, qs, sdkFetch } from "@/api/http";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// cartSummary.asyncOperationStatus reflects the state of the checkout's async
// server work (shipping/tax/promotion integrations):
//   "Processing" — still computing; poll until it clears.
//   "Errored"    — an integration failed for this attempt (e.g. the shipping
//                  integration threw an internal error). Terminal for that
//                  attempt — a plain re-GET keeps returning "Errored"; the only
//                  recovery is to RE-TRIGGER the integration by re-issuing the
//                  mutating PATCH. On this store the failure is intermittent,
//                  so a retry usually succeeds.
const asyncStatus = (s: CheckoutState | null): string | undefined =>
	s?.cartSummary?.asyncOperationStatus;
const isProcessing = (s: CheckoutState | null): boolean => asyncStatus(s) === "Processing";
const isErrored = (s: CheckoutState | null): boolean => asyncStatus(s) === "Errored";

// Settle-poll cadence (for the transient "Processing" window).
const CHECKOUT_SETTLE_MAX_POLLS = 10;
const CHECKOUT_SETTLE_POLL_DELAY_MS = 600;

// Re-trigger cadence (for "Errored" / CHECKOUT_CONFLICT — re-issue the PATCH
// to re-run the flaky integration). ~12 attempts x 2.5s ≈ 30s total.
const CHECKOUT_RETRY_MAX_ATTEMPTS = 12;
const CHECKOUT_RETRY_DELAY_MS = 2500;

function tryParseCheckout(text: string): CheckoutState | null {
	if (!text) return null;
	try {
		return JSON.parse(text) as CheckoutState;
	} catch {
		return null;
	}
}

function describeCheckoutErrors(state: CheckoutState | null): string {
	const errs = state?.errors ?? [];
	if (errs.length === 0) return "checkout integration error";
	return errs.map((e) => e.title ?? e.detail ?? "").filter(Boolean).join("; ");
}

// GET /checkouts/active WITHOUT recovery. Returns the parsed state even on a
// 422 when the body carries a checkout (e.g. an "Errored" checkout), so callers
// can inspect/recover instead of crashing. Used internally for settle-polling.
async function fetchActiveCheckoutRaw(): Promise<CheckoutState | null> {
	const res = await sdkFetch(`${base()}/checkouts/active`);
	if (res.status === 404) return null;
	const text = await res.text();
	const state = tryParseCheckout(text);
	if (res.ok) return state;
	// Non-OK but with a usable checkout body (the 422 the platform returns for an
	// Errored checkout includes the full state) — surface it rather than throw.
	if (state?.cartSummary) return state;
	throw new Error(`Failed to load checkout (${res.status}): ${text}`);
}

// Re-fetch the active checkout until the async operation leaves "Processing"
// (or we run out of polls). Returns the latest state either way.
async function waitForCheckoutToSettle(initial: CheckoutState): Promise<CheckoutState> {
	let state = initial;
	for (let attempt = 0; attempt < CHECKOUT_SETTLE_MAX_POLLS; attempt++) {
		if (!isProcessing(state)) return state;
		await delay(CHECKOUT_SETTLE_POLL_DELAY_MS);
		const next = await fetchActiveCheckoutRaw();
		if (!next) return state;
		state = next;
	}
	return state;
}

// Re-sync the client with the server's current checkout version before a
// mutating PATCH.
//
// CHECKOUT_CONFLICT is an optimistic-concurrency rejection, NOT a timing/retry
// error: the checkout page does one GET /checkouts/active on mount, then while
// the buyer fills in the address form the checkout's async recompute advances
// its server-side version. The buyer's PATCH is then validated against the
// stale mounted snapshot and rejected. Re-issuing the PATCH alone never clears
// it (waiting doesn't help either) — the ONLY thing that does is a fresh
// GET /checkouts/active, which is exactly what a manual page reload does. So we
// issue that GET here to reconcile the snapshot, settling any in-flight
// Processing so the subsequent PATCH lands on a stable, current version.
async function refreshCheckoutSnapshot(): Promise<void> {
	const state = await fetchActiveCheckoutRaw().catch(() => null);
	if (state && isProcessing(state)) await waitForCheckoutToSettle(state);
}

// Pull a clean, PATCH-able delivery address off an existing checkout so we can
// re-apply it to re-trigger the shipping integration. Strips response-only
// fields (name, shipToPhoneNumber) the PATCH endpoint doesn't accept.
function recoverableAddress(state: CheckoutState | null): CheckoutAddress | null {
	const a = state?.deliveryGroups?.items?.[0]?.deliveryAddress;
	if (!a || (!a.street && !a.city)) return null;
	return {
		firstName: a.firstName,
		lastName: a.lastName,
		companyName: a.companyName,
		street: a.street,
		city: a.city,
		region: a.region,
		postalCode: a.postalCode,
		country: a.country,
	};
}

// PATCH /checkouts/active with recovery from the two failure modes seen on this
// store:
//   - CHECKOUT_CONFLICT (client snapshot stale vs the server's checkout
//     version), and
//   - asyncOperationStatus "Errored" (a checkout integration failed this run).
// These need DIFFERENT recovery, so we treat them differently:
//   - CHECKOUT_CONFLICT → re-sync via a fresh GET /checkouts/active (the
//     reload-equivalent) THEN re-PATCH. A bare wait+re-PATCH never clears it.
//   - "Errored" → wait, then re-issue the PATCH to re-run the flaky integration.
// To pre-empt the conflict entirely we also refresh the snapshot once before
// the first PATCH, mirroring what a page reload does. Retries up to
// CHECKOUT_RETRY_MAX_ATTEMPTS. A genuinely non-retryable error (bad field,
// auth, etc.) is surfaced immediately. The successful state is settle-polled so
// callers get populated delivery methods / totals.
async function patchActiveCheckout(
	body: Record<string, unknown>,
	errMsg: string,
): Promise<CheckoutState> {
	const url = `${base()}/checkouts/active`;
	let lastDetail = "";
	// Reconcile the client with the server's current version before the first
	// write, so the common stale-snapshot conflict never fires.
	await refreshCheckoutSnapshot();
	for (let attempt = 0; attempt < CHECKOUT_RETRY_MAX_ATTEMPTS; attempt++) {
		const res = await sdkFetch(url, { method: "PATCH", body: JSON.stringify(body) });
		const text = await res.text();
		const state = tryParseCheckout(text);

		if (res.ok) {
			const settled = isProcessing(state) ? await waitForCheckoutToSettle(state!) : state;
			// Success only when the async op has fully settled without erroring.
			if (settled && !isProcessing(settled) && !isErrored(settled)) {
				return settled;
			}
			lastDetail = describeCheckoutErrors(settled);
			await delay(CHECKOUT_RETRY_DELAY_MS); // errored / still processing → wait, re-trigger
			continue;
		}

		// Non-OK. Retry the known-transient cases; surface anything else.
		lastDetail = text;
		const isConflict = text.includes("CHECKOUT_CONFLICT");
		const isErroredBody = text.includes('"Errored"');
		if (!isConflict && !isErroredBody) {
			throw new Error(`${errMsg} (${res.status}): ${text}`);
		}
		if (isConflict) {
			// Stale snapshot: re-GET to pull the server's current version (the
			// reload-equivalent), then loop straight into the re-PATCH. No fixed
			// delay — it's the GET, not waiting, that clears the conflict.
			await refreshCheckoutSnapshot();
		} else {
			// Flaky integration errored this run: pause before re-triggering.
			await delay(CHECKOUT_RETRY_DELAY_MS);
		}
	}
	throw new Error(
		`${errMsg}: the store's checkout integration kept failing after ` +
			`${CHECKOUT_RETRY_MAX_ATTEMPTS} attempts. Last error: ${lastDetail}`,
	);
}

// GET the active checkout. If a prior attempt left it "Errored" (flaky shipping
// integration), recover by re-triggering with the address already on the
// checkout, so the page lands on a usable checkout instead of a dead one.
export async function getActiveCheckout(): Promise<CheckoutState | null> {
	let state = await fetchActiveCheckoutRaw();
	if (!state) return null;
	if (isProcessing(state)) state = await waitForCheckoutToSettle(state);
	if (isErrored(state)) {
		const addr = recoverableAddress(state);
		if (addr) {
			try {
				return await patchActiveCheckout({ deliveryAddress: addr }, "Failed to load checkout");
			} catch {
				// Re-trigger exhausted — return the errored state so the page can
				// render/report it rather than throwing on load.
				return state;
			}
		}
	}
	return state;
}

// Start (or resume) the checkout for the active cart.
//
// PUT /checkouts means "ensure a checkout exists for this cart and return its
// current state". With `shouldUseDefaultAddress` the server auto-applies the
// buyer's default shipping address and pre-selects an available delivery
// method, so the response already carries totals + shipping + line items.
export async function startCheckout(cartId?: string): Promise<CheckoutState> {
	const url =
		`${base()}/checkouts` +
		qs({ language: "en-US", asGuest: false, htmlEncode: false });
	const res = await sdkFetch(url, {
		method: "PUT",
		body: JSON.stringify({
			cartId: cartId ?? "active",
			deliveryAddressInput: { shouldUseDefaultAddress: true },
		}),
	});
	const state = await parse<CheckoutState>(res, "Failed to start checkout");
	// Creating the checkout kicks off async server setup (apply default
	// address, compute delivery methods). If we return before it settles, the
	// next mutation (e.g. the address PATCH) races that setup and the platform
	// rejects it with CHECKOUT_CONFLICT. Wait here so the checkout is in a
	// stable state before the caller mutates it.
	return waitForCheckoutToSettle(state);
}

// PATCH /checkouts/active expects the address under `deliveryAddress`. The
// legacy key `shippingAddress` is rejected with
//   JSON_PARSER_ERROR "Unrecognized field shippingAddress".
export async function updateCheckoutShippingAddress(
	address: CheckoutAddress,
): Promise<CheckoutState> {
	// patchActiveCheckout handles both failure modes seen on this call:
	//  - CHECKOUT_CONFLICT (checkout briefly out of sync) → re-fetch + replay
	//  - asyncOperationStatus "Processing" with empty availableDeliveryMethods[]
	//    → settle-poll so the populated methods come back (previously this only
	//    appeared after a manual page reload).
	return patchActiveCheckout(
		{ deliveryAddress: address },
		"Failed to save shipping address",
	);
}

export async function setDeliveryMethod(
	deliveryMethodId: string,
): Promise<CheckoutState> {
	// Selecting a delivery method recomputes totals + tax asynchronously and can
	// also hit CHECKOUT_CONFLICT; patchActiveCheckout retries-on-conflict and
	// settle-polls so the order summary reflects the final amounts before the
	// buyer proceeds to payment.
	return patchActiveCheckout(
		{ deliveryMethodId },
		"Failed to set delivery method",
	);
}

// Purchase-order payment. Verified pattern: POST /payments with
//   { paymentToken: <PO>, requestType: "SimplePurchaseOrder",
//     billingAddress: { name, street, city, region, postalCode, country } }
// `name` must be the concatenated first+last name; the split fields are not
// accepted (the legacy `purchaseOrderPaymentMethod` block is rejected).
export async function authorisePurchaseOrder(
	poNumber: string,
	billingAddress: CheckoutAddress,
): Promise<unknown> {
	const name =
		`${billingAddress.firstName ?? ""} ${billingAddress.lastName ?? ""}`.trim() ||
		undefined;
	const billing = {
		name,
		companyName: billingAddress.companyName,
		street: billingAddress.street,
		city: billingAddress.city,
		region: billingAddress.region,
		postalCode: billingAddress.postalCode,
		country: billingAddress.country,
	};
	const url = `${base()}/checkouts/active/payments`;
	const res = await sdkFetch(url, {
		method: "POST",
		body: JSON.stringify({
			paymentToken: poNumber,
			requestType: "SimplePurchaseOrder",
			billingAddress: billing,
		}),
	});
	return parse<unknown>(res, "Failed to submit purchase order");
}

export interface PlaceOrderResult {
	readonly orderReferenceNumber?: string;
	readonly orderSummaryId?: string;
	readonly salesOrderId?: string;
}

// Place the order for the active checkout.
//
//   POST /checkouts/active/orders   (empty body)
//
// This is the documented "place order" call — the same one the standard B2B
// storefront issues. It finalises the checkout and creates the order +
// OrderSummary in one step; the response carries the order reference number
// and summary id used to route to the confirmation page. (Do NOT use the
// `/orders/actions` prepare/submit variant — it is a different, access-gated
// endpoint that returns INSUFFICIENT_ACCESS for storefront buyers.)
export async function placeOrder(): Promise<PlaceOrderResult> {
	const url =
		`${base()}/checkouts/active/orders` +
		qs({ language: "en-US", asGuest: false, htmlEncode: false });
	const res = await sdkFetch(url, { method: "POST" });
	const body = await parse<{
		orderReferenceNumber?: string;
		orderSummaryId?: string;
		salesOrderId?: string;
	}>(res, "Failed to place order");
	return {
		orderReferenceNumber: body.orderReferenceNumber,
		orderSummaryId: body.orderSummaryId,
		salesOrderId: body.salesOrderId,
	};
}
