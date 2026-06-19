import { useCallback, useEffect, useState } from "react";
import {
	authorisePurchaseOrder,
	getActiveCheckout,
	placeOrder,
	setDeliveryMethod,
	startCheckout,
	updateCheckoutShippingAddress,
	type PlaceOrderResult,
} from "@/api";
import type { CheckoutAddress, CheckoutState } from "@/api/types";

export interface UseCheckoutResult {
	readonly checkout: CheckoutState | null;
	readonly loading: boolean;
	readonly busy: boolean;
	readonly error: string | null;
	start: (cartId?: string) => Promise<void>;
	setShippingAddress: (address: CheckoutAddress) => Promise<void>;
	selectDeliveryMethod: (deliveryMethodId: string) => Promise<void>;
	authorise: (poNumber: string, billingAddress: CheckoutAddress) => Promise<void>;
	submit: () => Promise<PlaceOrderResult>;
}

// A single hook drives the whole checkout flow. Pages set state by calling the
// methods in order; `busy` blocks double-clicks during network calls.
export function useCheckout(): UseCheckoutResult {
	const [checkout, setCheckout] = useState<CheckoutState | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const runBusy = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
		setBusy(true);
		setError(null);
		try {
			return await fn();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			setError(msg);
			throw err;
		} finally {
			setBusy(false);
		}
	}, []);

	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const existing = await getActiveCheckout();
				if (alive) setCheckout(existing);
			} catch (err) {
				if (alive) setError(err instanceof Error ? err.message : String(err));
			} finally {
				if (alive) setLoading(false);
			}
		})();
		return () => {
			alive = false;
		};
	}, []);

	const start = useCallback(
		(cartId?: string) =>
			runBusy(async () => {
				const next = await startCheckout(cartId);
				setCheckout(next);
			}),
		[runBusy],
	);

	const setShippingAddress = useCallback(
		(address: CheckoutAddress) =>
			runBusy(async () => {
				const next = await updateCheckoutShippingAddress(address);
				setCheckout(next);
			}),
		[runBusy],
	);

	const selectDeliveryMethod = useCallback(
		(deliveryMethodId: string) =>
			runBusy(async () => {
				const next = await setDeliveryMethod(deliveryMethodId);
				setCheckout(next);
			}),
		[runBusy],
	);

	const authorise = useCallback(
		(poNumber: string, billingAddress: CheckoutAddress) =>
			runBusy(async () => {
				await authorisePurchaseOrder(poNumber, billingAddress);
			}),
		[runBusy],
	);

	const submit = useCallback(() => runBusy(() => placeOrder()), [runBusy]);

	return { checkout, loading, busy, error, start, setShippingAddress, selectDeliveryMethod, authorise, submit };
}
