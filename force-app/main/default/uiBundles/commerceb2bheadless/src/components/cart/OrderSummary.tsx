import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
	cartItemName,
	type CartItem,
	type CartPromotion,
	type CartSummary,
} from "@/api/types";
import AdjustmentRow from "@/components/cart/AdjustmentRow";
import { formatCurrency } from "@/components/catalog/PriceDisplay";

export interface OrderSummaryProps {
	readonly summary: CartSummary | null;
	readonly items?: readonly CartItem[];
	readonly title?: string;
	// Shipping fee — only passed in on the Checkout page once a delivery
	// method is selected. Cart pages should NOT show shipping; the row stays
	// hidden when this is undefined.
	readonly shippingAmount?: string | number;
	// No external taxAmount prop needed — tax is read directly from
	// summary.totalTaxAmount which the cart/checkout APIs already return.
	// Active cart-level + item-level promotions surfaced from
	// `/cart-items?includePromotions=true`. Each promo renders as its own
	// row using its `displayName`. Falls back to a single rolled-up row if
	// the list is empty but `totalPromotionalAdjustmentAmount` is non-zero.
	readonly promotions?: readonly CartPromotion[];
	readonly approachingDiscounts?: readonly string[];
	readonly children?: React.ReactNode;
}

// Sum line totals as a fallback when the cart summary doesn't return
// aggregate totals (some org configurations).
function sumLineProductAmounts(items: readonly CartItem[]): number {
	let total = 0;
	let any = false;
	for (const item of items) {
		const raw =
			item.totalLineAmount ?? item.totalPrice ?? item.salesPrice ?? item.listPrice;
		if (raw === undefined || raw === null || raw === "") continue;
		const qty = Number(item.quantity ?? 1) || 1;
		const n = Number(raw);
		if (!Number.isFinite(n)) continue;
		any = true;
		// totalLineAmount/totalPrice are already line totals; salesPrice/listPrice
		// are unit prices and need multiplying by qty.
		const isLine = item.totalLineAmount !== undefined || item.totalPrice !== undefined;
		total += isLine ? n : n * qty;
	}
	return any ? total : NaN;
}

function asNumber(v: string | number | undefined | null): number {
	if (v === undefined || v === null || v === "") return NaN;
	const n = typeof v === "string" ? Number(v) : v;
	return Number.isFinite(n) ? n : NaN;
}

// Compact card used on cart + checkout. Subtotal is products only — shipping
// is opt-in via `shippingAmount` (Checkout passes it once a delivery method
// is selected; Cart never does). Promotions roll up into one row driven by
// `totalPromotionalAdjustmentAmount` from the cart summary.
export default function OrderSummary({
	summary,
	items,
	title = "Order summary",
	shippingAmount,
	promotions,
	approachingDiscounts,
	children,
}: OrderSummaryProps) {
	const currency = summary?.currencyIsoCode ?? "USD";

	// Products subtotal (BEFORE promotions and shipping). Prefer the
	// server-computed `totalProductAmount`; fall back to summing items.
	const summarySubtotal = asNumber(summary?.totalProductAmount);
	const computedSubtotal = items ? sumLineProductAmounts(items) : NaN;
	const subtotal = Number.isFinite(summarySubtotal) ? summarySubtotal : computedSubtotal;

	// Per-promotion rows. Each entry in `promotions` is rendered with its
	// own displayName + adjustmentAmount. Auto-applied promotions (no coupon
	// chip) only surface here, so collapsing to a single row would hide them.
	const namedPromotions = (promotions ?? []).filter(
		(p) => Number.isFinite(asNumber(p.adjustmentAmount)) && asNumber(p.adjustmentAmount) !== 0,
	);
	// Aggregate fallback for orgs that return `totalPromotionalAdjustmentAmount`
	// but no per-promo list (older API shapes). Skip when we already have
	// named rows to avoid double-counting.
	const promoTotal = asNumber(summary?.totalPromotionalAdjustmentAmount);
	const hasPromoTotal = Number.isFinite(promoTotal) && promoTotal !== 0;
	const showAggregateFallback = hasPromoTotal && namedPromotions.length === 0;
	// Sum of named promo amounts — used in the local total computation below.
	const namedPromoSum = namedPromotions.reduce(
		(acc, p) => acc + asNumber(p.adjustmentAmount),
		0,
	);
	const effectivePromoTotal = namedPromotions.length > 0 ? namedPromoSum : promoTotal;
	const hasAnyPromo = namedPromotions.length > 0 || showAggregateFallback;

	// Tax is gross/inclusive — already baked into grandTotalAmount.
	// Read it from the CartSummary the checkout/cart APIs already return;
	// no extra API call needed.
	const tax = asNumber(summary?.totalTaxAmount);
	const hasTax = Number.isFinite(tax) && tax > 0;

	const shipping = asNumber(shippingAmount);
	const summaryGrand = asNumber(summary?.grandTotalAmount);
	// Local recompute is for the cart page (where shipping is unknown):
	//   subtotal + promotions(neg) = total to display
	// On checkout we trust the server's `grandTotalAmount` since it already
	// includes shipping + tax.
	const localTotal = Number.isFinite(subtotal)
		? subtotal + (hasAnyPromo ? effectivePromoTotal : 0) + (Number.isFinite(shipping) ? shipping : 0)
		: NaN;
	const grand =
		Number.isFinite(shipping) && Number.isFinite(summaryGrand)
			? summaryGrand
			: Number.isFinite(localTotal)
				? localTotal
				: summaryGrand;

	const hasApproachingDiscounts =
		approachingDiscounts && approachingDiscounts.length > 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">{title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 text-sm">
				{items && items.length > 0 && (
					<>
						<div className="space-y-1.5">
							{items.map((item) => {
								const name = cartItemName(item) || item.productId || "Item";
								const qty = Number(item.quantity ?? 1);
								const lineTotal =
									item.totalLineAmount ??
									item.totalPrice ??
									item.salesPrice ??
									item.listPrice;
								return (
									<div key={item.cartItemId} className="flex justify-between gap-3">
										<span className="flex-1 line-clamp-2">
											{name}
											<span className="text-muted-foreground"> ({qty})</span>
										</span>
										<span className="whitespace-nowrap">
											{formatCurrency(lineTotal, currency)}
										</span>
									</div>
								);
							})}
						</div>
						<Separator className="my-2" />
					</>
				)}

				<Row
					label="Subtotal"
					value={Number.isFinite(subtotal) ? formatCurrency(subtotal, currency) : "—"}
				/>
				{namedPromotions.map((p, i) => (
					<AdjustmentRow
						key={p.promotionId ?? `${p.couponCode ?? "promo"}-${i}`}
						label={p.displayName || (p.couponCode ? `Coupon ${p.couponCode}` : "Promotion")}
						amount={p.adjustmentAmount}
						currency={p.currencyIsoCode ?? currency}
					/>
				))}
				{showAggregateFallback && (
					<AdjustmentRow label="Promotions" amount={promoTotal} currency={currency} />
				)}
				{Number.isFinite(shipping) && (
					<Row label="Shipping" value={formatCurrency(shipping, currency)} />
				)}
				<Separator className="my-2" />
				<Row
					label="Total"
					value={Number.isFinite(grand) ? formatCurrency(grand, currency) : "—"}
					emphasis
				/>
				{/* Tax is inclusive — show as a sub-note under the total so the buyer
				    can see exactly how much tax is included in the price they pay. */}
				<p className="text-xs text-muted-foreground">
					{hasTax
						? `Incl. ${formatCurrency(tax, currency)} tax`
						: "Tax included"}
				</p>
				{hasApproachingDiscounts && (
					<ul className="mt-2 space-y-1">
						{approachingDiscounts!.map((msg, i) => (
							<li
								key={i}
								className="rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-900"
							>
								{msg}
							</li>
						))}
					</ul>
				)}
				{children}
			</CardContent>
		</Card>
	);
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
	return (
		<div className="flex justify-between items-baseline">
			<span className={emphasis ? "font-semibold" : "text-muted-foreground"}>{label}</span>
			<span className={emphasis ? "font-semibold text-base" : ""}>{value}</span>
		</div>
	);
}
