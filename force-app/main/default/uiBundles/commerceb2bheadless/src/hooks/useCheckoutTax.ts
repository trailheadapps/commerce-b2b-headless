// Hook that calculates real-time tax for the active checkout.
//
// Call this after the buyer confirms their shipping address. It builds the
// calculate-taxes request from the checkout state (line items + confirmed
// delivery address) and returns the total tax amount as a formatted string.
//
// Returns `null` while loading or if the endpoint is unavailable — the
// caller should fall back to the static "Tax included" footnote in that case.

import { useCallback, useEffect, useRef, useState } from "react";
import { calculateTaxes } from "@/api";
import type { CalculateTaxesRequest, CartItem, CheckoutAddress } from "@/api/types";

export interface UseCheckoutTaxResult {
	// Total tax amount as a raw numeric string (e.g. "12.50"), or null when
	// unavailable (still loading, error, or address not yet confirmed).
	readonly taxAmount: string | null;
	readonly loading: boolean;
	readonly error: string | null;
}

// Build the calculate-taxes request body from cart items and a confirmed
// shipping address. Each cart item becomes one TaxLineItem in a single
// address group. Items missing a productId or price are skipped.
function buildTaxRequest(
	items: readonly CartItem[],
	address: CheckoutAddress,
	currencyIsoCode?: string,
): CalculateTaxesRequest | null {
	if (!address.country) return null;

	const lineItems = items
		.filter((item) => item.productId && (item.salesPrice ?? item.listPrice))
		.map((item) => ({
			lineId: item.cartItemId,
			productId: item.productId!,
			quantity: Number(item.quantity ?? 1) || 1,
			unitPrice: item.salesPrice ?? item.listPrice ?? "0",
			currencyIsoCode,
		}));

	if (lineItems.length === 0) return null;

	return {
		cartItems: [
			{
				deliveryAddress: {
					countryCode: address.country,
					stateCode: address.region,
					postalCode: address.postalCode,
					city: address.city,
					street: address.street,
				},
				lineItems,
			},
		],
		currencyIsoCode,
	};
}

export function useCheckoutTax(
	// Pass the confirmed shipping address once the buyer has selected one.
	// Passing undefined (address step not yet complete) skips the fetch.
	shippingAddress: CheckoutAddress | undefined,
	items: readonly CartItem[],
	currencyIsoCode?: string,
): UseCheckoutTaxResult {
	const [taxAmount, setTaxAmount] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const alive = useRef(true);

	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);

	const addressKey = shippingAddress
		? [
				shippingAddress.country,
				shippingAddress.region,
				shippingAddress.postalCode,
				shippingAddress.city,
			].join("|")
		: null;

	// Re-run whenever the address or item list changes. We use a stable
	// address key rather than the whole object to avoid re-fetching on
	// unrelated re-renders.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const itemIds = items.map((i) => i.cartItemId).join(",");

	useEffect(() => {
		if (!shippingAddress) return;

		const req = buildTaxRequest(items, shippingAddress, currencyIsoCode);
		if (!req) return;

		setLoading(true);
		setError(null);

		calculateTaxes(req)
			.then((resp) => {
				if (!alive.current) return;
				setTaxAmount(resp.totalTaxAmount ?? null);
			})
			.catch((err: unknown) => {
				if (!alive.current) return;
				// Tax calculation failure is non-fatal: the order summary falls
				// back to "Tax included" footnote. Log for debugging but don't
				// surface an error banner.
				console.warn("[useCheckoutTax] Tax calculation failed:", err);
				setError(err instanceof Error ? err.message : String(err));
				setTaxAmount(null);
			})
			.finally(() => {
				if (alive.current) setLoading(false);
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [addressKey, itemIds, currencyIsoCode]);

	return { taxAmount, loading, error };
}

// Convenience: re-trigger tax calculation imperatively (e.g. after a coupon
// is applied). Returns the same state shape as the hook.
export function useCheckoutTaxRefreshable(
	shippingAddress: CheckoutAddress | undefined,
	items: readonly CartItem[],
	currencyIsoCode?: string,
): UseCheckoutTaxResult & { refresh: () => void } {
	const [tick, setTick] = useState(0);
	const refresh = useCallback(() => setTick((n) => n + 1), []);

	const [taxAmount, setTaxAmount] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const alive = useRef(true);

	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);

	const addressKey = shippingAddress
		? [
				shippingAddress.country,
				shippingAddress.region,
				shippingAddress.postalCode,
				shippingAddress.city,
			].join("|")
		: null;

	const itemIds = items.map((i) => i.cartItemId).join(",");

	useEffect(() => {
		if (!shippingAddress) return;

		const req = buildTaxRequest(items, shippingAddress, currencyIsoCode);
		if (!req) return;

		setLoading(true);
		setError(null);

		calculateTaxes(req)
			.then((resp) => {
				if (!alive.current) return;
				setTaxAmount(resp.totalTaxAmount ?? null);
			})
			.catch((err: unknown) => {
				if (!alive.current) return;
				console.warn("[useCheckoutTax] Tax calculation failed:", err);
				setError(err instanceof Error ? err.message : String(err));
				setTaxAmount(null);
			})
			.finally(() => {
				if (alive.current) setLoading(false);
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [addressKey, itemIds, currencyIsoCode, tick]);

	return { taxAmount, loading, error, refresh };
}
