import { useState } from "react";
import { Trash2, Gift } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cartItemImage, cartItemName, type CartItem } from "@/api/types";
import PriceDisplay, { formatCurrency } from "@/components/catalog/PriceDisplay";
import QuantitySelector from "./QuantitySelector";

function asNumber(v: string | number | undefined | null): number {
	if (v === undefined || v === null || v === "") return NaN;
	const n = typeof v === "string" ? Number(v) : v;
	return Number.isFinite(n) ? n : NaN;
}

export interface CartLineItemProps {
	readonly item: CartItem;
	onUpdate: (cartItemId: string, quantity: number) => Promise<void>;
	onRemove: (cartItemId: string) => Promise<void>;
}

export default function CartLineItem({ item, onUpdate, onRemove }: CartLineItemProps) {
	const [busy, setBusy] = useState(false);
	const qty = Number(item.quantity ?? 1);
	const name = cartItemName(item) || item.productId || "Product";
	const image = cartItemImage(item);

	// Bonus / free-gift detection. The promotion engine populates
	// `promotionDisplayName` on lines added by a "buy X get Y free" promo;
	// that's the only authoritative signal. A zero `totalLineAmount` alone
	// is not enough — a 100%-off coupon would also drive that to zero on a
	// regular line, and we don't want to mis-tag those as gifts.
	const isFreeGift = !!item.promotionDisplayName;

	// Per-line adjustment indicator. Item-level promos surface here so the
	// buyer sees "saved $X" on the line that was discounted, separate from
	// any cart-level promo row in the order summary.
	const lineAdjustment = asNumber(item.totalAdjustmentAmount);
	const hasLineAdjustment =
		Number.isFinite(lineAdjustment) && lineAdjustment !== 0 && !isFreeGift;

	const run = async (fn: () => Promise<void>) => {
		setBusy(true);
		try {
			await fn();
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex gap-4 py-5">
			<Link
				to={item.productId ? `/product/${item.productId}` : "#"}
				className="w-20 h-20 bg-muted rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center"
			>
				{image ? (
					<img src={image} alt={name} className="w-full h-full object-cover" />
				) : (
					<span className="text-xs text-muted-foreground">No image</span>
				)}
			</Link>
			<div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
				<div className="min-w-0 space-y-1.5">
					<Link
						to={item.productId ? `/product/${item.productId}` : "#"}
						className="font-medium hover:underline line-clamp-2 block"
					>
						{name}
					</Link>
					{isFreeGift && (
						<span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
							<Gift className="h-3 w-3" />
							{item.promotionDisplayName ?? "Gift with purchase"}
						</span>
					)}
					<div className="space-y-0.5">
						{isFreeGift ? (
							<div className="flex items-baseline gap-2">
								<span className="text-sm font-semibold text-emerald-700">Free</span>
								{item.salesPrice && (
									<span className="text-xs text-muted-foreground line-through">
										{formatCurrency(item.salesPrice, item.currencyIsoCode)}
									</span>
								)}
							</div>
						) : (
							<PriceDisplay
								amount={item.salesPrice ?? item.listPrice}
								currency={item.currencyIsoCode}
							/>
						)}
						{item.totalLineAmount && !isFreeGift && (
							<div className="text-xs text-muted-foreground">
								Line total {formatCurrency(item.totalLineAmount, item.currencyIsoCode)}
							</div>
						)}
						{hasLineAdjustment && (
							<div className="text-xs text-emerald-700">
								Saved {formatCurrency(Math.abs(lineAdjustment), item.currencyIsoCode)}
							</div>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-2 flex-shrink-0">
					<QuantitySelector
						value={qty}
						disabled={busy}
						onChange={(n) => run(() => onUpdate(item.cartItemId, n))}
					/>
					<Button
						variant="ghost"
						size="sm"
						disabled={busy}
						onClick={() => run(() => onRemove(item.cartItemId))}
						aria-label="Remove item"
						className="text-muted-foreground"
					>
						<Trash2 className="h-4 w-4 mr-1" /> Remove
					</Button>
				</div>
			</div>
		</div>
	);
}
