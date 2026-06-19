// Coupon-only slice of the cart context. Components that only need the
// coupon API (apply / remove / inspect) import this instead of the full
// `useCart()` to keep their dependency surface narrow. Same data, smaller
// import.

import { useCart } from "@/context/CartContext";
import type { CartCoupon } from "@/api/types";

export interface UseCouponsResult {
	readonly appliedCoupons: readonly CartCoupon[];
	readonly couponBusy: boolean;
	readonly couponError: string | null;
	applyCoupon: (code: string) => Promise<void>;
	removeCoupon: (cartCouponId: string) => Promise<void>;
	clearCouponError: () => void;
}

export function useCoupons(): UseCouponsResult {
	const {
		appliedCoupons,
		couponBusy,
		couponError,
		applyCoupon,
		removeCoupon,
		clearCouponError,
	} = useCart();
	return {
		appliedCoupons,
		couponBusy,
		couponError,
		applyCoupon,
		removeCoupon,
		clearCouponError,
	};
}
