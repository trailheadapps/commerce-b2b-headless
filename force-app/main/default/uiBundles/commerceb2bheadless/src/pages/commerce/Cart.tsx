import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CartLineItem from "@/components/cart/CartLineItem";
import CouponInput from "@/components/cart/CouponInput";
import OrderSummary from "@/components/cart/OrderSummary";
import { COMMERCE_ROUTES } from "@/config/commerce";
import { useCart } from "@/context/CartContext";

export default function CartPage() {
	const {
		items,
		summary,
		loading,
		error,
		cartPromotions,
		approachingDiscounts,
		refreshItems,
		updateItem,
		removeItem,
	} = useCart();

	// CartContext caches items across navigations, so re-entering /cart shows
	// the previous cart's rows + coupons until the new fetch lands. Track
	// whether *this* page mount has finished its refresh and hold the
	// skeleton until then so the buyer never sees stale state.
	const [hasFreshData, setHasFreshData] = useState(false);

	useEffect(() => {
		setHasFreshData(false);
		let cancelled = false;
		refreshItems().finally(() => {
			if (!cancelled) setHasFreshData(true);
		});
		return () => {
			cancelled = true;
		};
	}, [refreshItems]);

	if (!hasFreshData || (loading && items.length === 0)) {
		return (
			<div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
				<div className="space-y-4">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-24 w-full" />
					))}
				</div>
				<Skeleton className="h-48 w-full" />
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
				<EmptyCartIllustration />
				<h1 className="text-2xl font-semibold">Your cart is empty</h1>
				<p className="text-muted-foreground">Browse the catalogue and add items to get started.</p>
				<Button asChild>
					<Link to="/">Continue shopping</Link>
				</Button>
				{error && (
					<Alert variant="destructive" className="text-left">
						<AlertTitle>Couldn't load cart</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
			</div>
		);
	}

	const onUpdate = async (id: string, qty: number) => {
		try {
			await updateItem(id, qty);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update quantity");
		}
	};
	const onRemove = async (id: string) => {
		try {
			await removeItem(id);
			toast.success("Item removed");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to remove item");
		}
	};

	return (
		<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<h1 className="text-2xl font-semibold mb-6">Cart</h1>
			<div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
				<div className="bg-card rounded-lg border divide-y">
					{items.map((item) => (
						<div key={item.cartItemId} className="px-4 sm:px-6">
							<CartLineItem item={item} onUpdate={onUpdate} onRemove={onRemove} />
						</div>
					))}
				</div>
				<div className="space-y-3">
					<OrderSummary
						summary={summary}
						items={items}
						promotions={cartPromotions}
						approachingDiscounts={approachingDiscounts}
					>
						<div className="pt-4 border-t mt-4">
							<CouponInput />
						</div>
						<Button className="w-full mt-4" asChild>
							<Link to={COMMERCE_ROUTES.CHECKOUT}>Proceed to checkout</Link>
						</Button>
					</OrderSummary>
					<Button variant="outline" className="w-full" asChild>
						<Link to="/">Continue shopping</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}

// Empty-cart hero illustration. Inline SVG so we don't ship another asset
// through the bundle pipeline. Matches the Cirrus mockup: a sad-faced cart
// sitting on a horizon line, with a soft circle "stage" and small sparkles.
function EmptyCartIllustration() {
	return (
		<svg
			viewBox="0 0 240 200"
			role="img"
			aria-label="Empty cart"
			className="mx-auto w-48 h-40"
		>
			{/* Soft background disc */}
			<circle cx="120" cy="100" r="78" fill="hsl(0 0% 95%)" />
			{/* Sparkles around the disc */}
			<g fill="none" stroke="hsl(0 0% 75%)" strokeWidth="1.5" strokeLinecap="round">
				<path d="M58 60 v6 M55 63 h6" />
				<path d="M180 50 v5 M177.5 52.5 h5" />
				<circle cx="190" cy="90" r="2" fill="hsl(0 0% 75%)" stroke="none" />
				<circle cx="60" cy="120" r="2" fill="hsl(0 0% 75%)" stroke="none" />
				<path d="M170 130 l3 3 M173 130 l-3 3" />
			</g>
			{/* Horizon line */}
			<line x1="20" y1="150" x2="220" y2="150" stroke="hsl(0 0% 35%)" strokeWidth="2" strokeLinecap="round" />
			{/* Cart body — outlined trapezoid */}
			<path
				d="M82 100 h84 l-10 50 h-64 z"
				fill="white"
				stroke="hsl(0 0% 25%)"
				strokeWidth="3"
				strokeLinejoin="round"
			/>
			{/* Cart handle */}
			<path
				d="M64 90 h20 l4 14"
				fill="none"
				stroke="hsl(0 0% 25%)"
				strokeWidth="3"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{/* Wheels */}
			<circle cx="98" cy="160" r="6" fill="white" stroke="hsl(0 0% 25%)" strokeWidth="3" />
			<circle cx="148" cy="160" r="6" fill="white" stroke="hsl(0 0% 25%)" strokeWidth="3" />
			{/* Sad face */}
			<g fill="hsl(0 0% 25%)">
				<circle cx="108" cy="120" r="2.5" />
				<circle cx="138" cy="120" r="2.5" />
			</g>
			<path
				d="M110 138 q14 -10 28 0"
				fill="none"
				stroke="hsl(0 0% 25%)"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}
