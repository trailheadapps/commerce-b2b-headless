// Coupon entry + applied-coupon chips. Pulls only the coupon-shaped slice
// of cart state via `useCoupons()`. `applyCoupon` POSTs to the cart-coupons
// endpoint, the server persists the coupon, re-runs the promotion engine,
// and the next cart-items refresh surfaces the resulting discount. The
// server enforces the per-cart coupon limit; we surface its error inline
// rather than capping client-side.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCoupons } from "@/hooks/useCoupons";

export default function CouponInput() {
	const {
		appliedCoupons,
		applyCoupon,
		removeCoupon,
		couponBusy,
		couponError,
		clearCouponError,
	} = useCoupons();
	const [code, setCode] = useState("");

	// Surface coupon failures as a toast and keep the inline state clean.
	// The hook still tracks `couponError` for retries; we just don't render
	// the raw API error in the cart UI any more.
	useEffect(() => {
		if (couponError) {
			toast.error("Invalid coupon");
			clearCouponError();
		}
	}, [couponError, clearCouponError]);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!code.trim() || couponBusy) return;
		const value = code.trim();
		await applyCoupon(value);
		// Only clear the input on success; on error the user can correct and
		// retry without retyping. Successful application is signalled by the
		// new code appearing in `appliedCoupons` after refreshItems().
		const wasApplied = appliedCoupons.some(
			(c) => c.couponCode.toLowerCase() === value.toLowerCase(),
		);
		if (!wasApplied) setCode("");
	};

	return (
		<div className="space-y-2">
			<Label htmlFor="coupon-code" className="text-sm">
				Promo code
			</Label>
			<form onSubmit={submit} className="flex gap-2">
				<Input
					id="coupon-code"
					value={code}
					onChange={(e) => {
						setCode(e.target.value);
						if (couponError) clearCouponError();
					}}
					placeholder="Enter code"
					disabled={couponBusy}
					autoComplete="off"
				/>
				<Button
					type="submit"
					variant="outline"
					disabled={couponBusy || code.trim() === ""}
				>
					{couponBusy ? "Applying…" : "Apply"}
				</Button>
			</form>
			{appliedCoupons.length > 0 && (
				<ul className="flex flex-wrap gap-2 pt-1">
					{appliedCoupons.map((c) => (
						<li
							key={c.cartCouponId}
							className="inline-flex items-center gap-1 rounded-full bg-emerald-100 pl-3 pr-1 py-0.5 text-xs font-medium text-emerald-900"
						>
							<span>{c.couponCode}</span>
							<button
								type="button"
								onClick={() => removeCoupon(c.cartCouponId)}
								disabled={couponBusy}
								className="rounded-full p-0.5 hover:bg-emerald-200 disabled:opacity-50"
								aria-label={`Remove coupon ${c.couponCode}`}
							>
								<X className="h-3 w-3" />
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
