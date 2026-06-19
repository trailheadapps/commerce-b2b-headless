// Shared cart state for the storefront.
//
// What lives here:
//   - Cart summary (id, totals, currency, product count) — drives the nav badge.
//   - Full line items — used by CartPage.
//   - Cart-level promotions + approaching discounts — surfaced from
//     `/cart-items?includePromotions=true` so cart and checkout can render
//     adjustments without a separate evaluate call.
//   - Applied coupons — persisted to the cart via the dedicated cart-coupons
//     endpoint (NOT /promotions/actions/evaluate, which only computes
//     adjustments without writing them to the cart).
//   - Action methods that mutate server-side then refresh local state.
//
// Why Context (not Zustand/Redux): keeps the dependency surface minimal, the
// cart is a single source of truth, and every page that needs it already sits
// under the provider.

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import {
	addToCart as apiAddToCart,
	applyCartCoupon,
	getCartItems,
	getCartSummary,
	removeCartCoupon,
	removeCartItem as apiRemoveCartItem,
	updateCartItem as apiUpdateCartItem,
} from "@/api";
import {
	normaliseCartCoupons,
	normaliseCartItems,
	normaliseCartPromotions,
	type CartCoupon,
	type CartItem,
	type CartPromotion,
	type CartSummary,
} from "@/api/types";
import { useAuth } from "@/context/AuthContext";

export interface CartContextValue {
	readonly summary: CartSummary | null;
	readonly items: readonly CartItem[];
	readonly count: number;
	readonly loading: boolean;
	readonly error: string | null;
	// Cart-level promotions returned alongside the cart-items GET. One row
	// per active auto-applied or coupon-driven promotion.
	readonly cartPromotions: readonly CartPromotion[];
	readonly approachingDiscounts: readonly string[];
	// Coupons currently persisted on the cart. `cartCouponId` (not the code)
	// is what the DELETE endpoint expects.
	readonly appliedCoupons: readonly CartCoupon[];
	readonly couponError: string | null;
	readonly couponBusy: boolean;
	refreshSummary: () => Promise<void>;
	refreshItems: () => Promise<void>;
	addItem: (productId: string, quantity?: number) => Promise<void>;
	updateItem: (cartItemId: string, quantity: number) => Promise<void>;
	removeItem: (cartItemId: string) => Promise<void>;
	applyCoupon: (code: string) => Promise<void>;
	removeCoupon: (cartCouponId: string) => Promise<void>;
	clearCouponError: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
	const { isAuthenticated, loading: authLoading } = useAuth();
	const [summary, setSummary] = useState<CartSummary | null>(null);
	const [items, setItems] = useState<readonly CartItem[]>([]);
	const [cartPromotions, setCartPromotions] = useState<readonly CartPromotion[]>([]);
	const [approachingDiscounts, setApproachingDiscounts] = useState<readonly string[]>(
		[],
	);
	const [appliedCoupons, setAppliedCoupons] = useState<readonly CartCoupon[]>([]);
	const [couponError, setCouponError] = useState<string | null>(null);
	const [couponBusy, setCouponBusy] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refreshSummary = useCallback(async () => {
		try {
			const s = await getCartSummary();
			setSummary(s);
		} catch (err) {
			// Guests / unauthenticated users can 401/403 here — treat as empty cart.
			setSummary(null);
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	const refreshItems = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const resp = await getCartItems();
			setSummary(resp.cartSummary ?? null);
			setItems(normaliseCartItems(resp));
			setCartPromotions(normaliseCartPromotions(resp));
			setAppliedCoupons(normaliseCartCoupons(resp));
			setApproachingDiscounts(resp.approachingDiscounts ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	const addItem = useCallback(
		async (productId: string, quantity = 1) => {
			await apiAddToCart(productId, quantity);
			await refreshSummary();
		},
		[refreshSummary],
	);

	const updateItem = useCallback(
		async (cartItemId: string, quantity: number) => {
			await apiUpdateCartItem(cartItemId, quantity);
			await refreshItems();
		},
		[refreshItems],
	);

	const removeItem = useCallback(
		async (cartItemId: string) => {
			await apiRemoveCartItem(cartItemId);
			await refreshItems();
		},
		[refreshItems],
	);

	// Apply a coupon by POSTing to /carts/current/cart-coupons. The server
	// writes a WebCartAdjustmentBasis, re-runs the promotion engine, and the
	// result flows back through the next /cart-items GET (totals, applied
	// promotions, coupon list). We do NOT call /promotions/actions/evaluate
	// here — that endpoint only computes adjustments, it does not persist
	// them, so the cart would still look untouched on the next fetch.
	const applyCoupon = useCallback(
		async (rawCode: string) => {
			const code = rawCode.trim();
			if (!code) {
				setCouponError("Enter a coupon code");
				return;
			}
			if (
				appliedCoupons.some(
					(c) => c.couponCode.toLowerCase() === code.toLowerCase(),
				)
			) {
				setCouponError("That coupon is already applied.");
				return;
			}
			setCouponBusy(true);
			setCouponError(null);
			try {
				await applyCartCoupon(code);
				await refreshItems();
			} catch (err) {
				// The server returns a 4xx with a useful message for invalid /
				// expired / ineligible codes. Surface it inline.
				setCouponError(err instanceof Error ? err.message : String(err));
			} finally {
				setCouponBusy(false);
			}
		},
		[appliedCoupons, refreshItems],
	);

	// Remove a coupon by its cartCouponId (the WebCartAdjustmentBasis Id —
	// NOT the coupon code). The DELETE endpoint reverts the persisted
	// adjustment server-side, then we refresh.
	const removeCoupon = useCallback(
		async (cartCouponId: string) => {
			setCouponBusy(true);
			setCouponError(null);
			try {
				await removeCartCoupon(cartCouponId);
				await refreshItems();
			} catch (err) {
				setCouponError(err instanceof Error ? err.message : String(err));
			} finally {
				setCouponBusy(false);
			}
		},
		[refreshItems],
	);

	const clearCouponError = useCallback(() => setCouponError(null), []);

	// Hydrate the badge once the buyer is authenticated. Skip for guests so the
	// /carts/compact-summary endpoint is not hit on the login page (it would
	// 401 anyway). Reset cart state on logout so a stale badge does not leak
	// across sessions.
	useEffect(() => {
		if (authLoading) return;
		if (isAuthenticated) {
			refreshSummary();
		} else {
			setSummary(null);
			setItems([]);
			setCartPromotions([]);
			setApproachingDiscounts([]);
			setAppliedCoupons([]);
			setCouponError(null);
			setError(null);
		}
	}, [authLoading, isAuthenticated, refreshSummary]);

	const count = useMemo(() => {
		const n = summary?.totalProductCount;
		if (!n) return 0;
		const parsed = Number(n);
		return Number.isFinite(parsed) ? parsed : 0;
	}, [summary?.totalProductCount]);

	// Memoized so consumers (CartBadge, header, cart pages) don't re-render
	// every time the provider re-renders for unrelated reasons.
	const value = useMemo<CartContextValue>(
		() => ({
			summary,
			items,
			count,
			loading,
			error,
			cartPromotions,
			approachingDiscounts,
			appliedCoupons,
			couponError,
			couponBusy,
			refreshSummary,
			refreshItems,
			addItem,
			updateItem,
			removeItem,
			applyCoupon,
			removeCoupon,
			clearCouponError,
		}),
		[
			summary,
			items,
			count,
			loading,
			error,
			cartPromotions,
			approachingDiscounts,
			appliedCoupons,
			couponError,
			couponBusy,
			refreshSummary,
			refreshItems,
			addItem,
			updateItem,
			removeItem,
			applyCoupon,
			removeCoupon,
			clearCouponError,
		],
	);

	return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
	const ctx = useContext(CartContext);
	if (!ctx) throw new Error("useCart must be used within <CartProvider>");
	return ctx;
}
