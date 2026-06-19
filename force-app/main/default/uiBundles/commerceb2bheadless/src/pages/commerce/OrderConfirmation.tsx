import { Link, useParams } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/components/catalog/PriceDisplay";
import AdjustmentRow from "@/components/cart/AdjustmentRow";
import { fieldText, type OrderLineItem } from "@/api/types";
import { useOrder } from "@/hooks/useOrder";

// Pull the best display name for a line item.
//   - Products: `lineItem.product.fields.Name.text` (wrapped shape).
//   - Order line itself doesn't carry a Name field, so we fall back to the
//     `type` (e.g. "Delivery Charge") and finally a generic "Item".
function renderLineName(item: OrderLineItem): string {
	const productName = fieldText(item.product?.fields as never, "Name");
	if (productName) return productName;
	const lineName = fieldText(item.fields, "Name");
	if (lineName) return lineName;
	if (item.type) return String(item.type);
	return "Item";
}

export default function OrderConfirmationPage() {
	const { orderId } = useParams();
	const { data, loading, error } = useOrder(orderId);

	if (loading) {
		return (
			<div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
				<Skeleton className="h-12 w-64" />
				<Skeleton className="h-40 w-full" />
			</div>
		);
	}

	const firstGroup = data?.deliveryGroups?.[0];
	const lineItems = firstGroup?.lineItems ?? [];
	const currency = data?.currencyIsoCode ?? firstGroup?.currencyIsoCode;
	const grandTotal = fieldText(data?.fields, "GrandTotalAmount");
	// Tax-inclusive subtotal so subtotal + shipping = grand total, matching
	// the Cart/Checkout pattern. Prefer the post-promotion with-tax field;
	// fall back to gross with-tax, then pre-tax variants for orgs that
	// don't surface the WithTax projections.
	const subtotal =
		fieldText(data?.fields, "TotalAdjProductAmtWithTax") ||
		fieldText(data?.fields, "TotalProductAmountWithTax") ||
		fieldText(data?.fields, "TotalProductAmount") ||
		fieldText(data?.fields, "TotalAdjustedProductAmount");
	// Per-promotion list. Prefer the top-level `adjustments[]` array (one
	// entry per promo with a name) over the rolled-up `fields.Total*Adj*`
	// scalars. Fall back to the scalar only when adjustments[] is missing.
	const orderAdjustments = data?.adjustments ?? [];
	const fallbackPromoAdjustment =
		orderAdjustments.length === 0
			? fieldText(data?.fields, "TotalCartLevelAdjAmount") ||
				fieldText(data?.fields, "TotalProductAdjustmentAmount") ||
				fieldText(data?.fields, "TotalAdjustmentAmount")
			: "";
	const shipping =
		fieldText(data?.fields, "TotalAdjDeliveryAmtWithTax") ||
		fieldText(data?.fields, "TotalAdjustedDeliveryAmount");
	const tax = fieldText(data?.fields, "TotalTaxAmount");
	const po = fieldText(data?.payments?.[0]?.paymentMethod?.fields, "PoNumber");
	const shipTo = {
		name: fieldText(firstGroup?.fields, "DeliverToName"),
		street: fieldText(firstGroup?.fields, "DeliverToStreet"),
		city: fieldText(firstGroup?.fields, "DeliverToCity"),
		state: fieldText(firstGroup?.fields, "DeliverToState"),
		postal: fieldText(firstGroup?.fields, "DeliverToPostalCode"),
		country: fieldText(firstGroup?.fields, "DeliverToCountry"),
	};

	return (
		<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
			<div className="text-center space-y-2">
				<CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
				<h1 className="text-2xl font-bold">Thank you for your order</h1>
				{data?.orderNumber ? (
					<p className="text-muted-foreground">
						Order <span className="font-mono">{data.orderNumber}</span> was placed.
					</p>
				) : (
					<p className="text-muted-foreground">Your order has been placed.</p>
				)}
			</div>

			{error && (
				<Alert variant="destructive">
					<AlertTitle>Could not load order</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{data && (
				<>
					{lineItems.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Items</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3 text-sm">
								{lineItems.map((item, idx) => {
									const qty = fieldText(item.fields, "Quantity");
									const total =
										fieldText(item.fields, "TotalPrice") ||
										fieldText(item.fields, "TotalLineAmount");
									const isCharge = (item.type ?? "").toLowerCase().includes("charge");
									return (
										<div key={idx} className="flex justify-between gap-4">
											<span className="flex-1">
												{renderLineName(item)}
												{qty && !isCharge ? ` × ${Number(qty)}` : ""}
												{isCharge && (
													<span className="text-muted-foreground"> (shipping)</span>
												)}
											</span>
											<span>{formatCurrency(total, currency)}</span>
										</div>
									);
								})}
							</CardContent>
						</Card>
					)}

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Totals</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							{subtotal && (
								<Row label="Subtotal" value={formatCurrency(subtotal, currency)} />
							)}
							{orderAdjustments.map((adj, i) => (
								<AdjustmentRow
									key={`${adj.basisReferenceDisplayName ?? "promo"}-${i}`}
									label={
										adj.displayName ||
										(adj.basisReferenceDisplayName
											? `Coupon ${adj.basisReferenceDisplayName}`
											: "Promotion")
									}
									amount={adj.amount}
									currency={adj.currencyIsoCode ?? currency}
								/>
							))}
							{fallbackPromoAdjustment && (
								<AdjustmentRow
									label="Promotions"
									amount={fallbackPromoAdjustment}
									currency={currency}
								/>
							)}
							{shipping && (
								<Row label="Shipping" value={formatCurrency(shipping, currency)} />
							)}
							<Separator className="my-2" />
							<Row label="Total" value={formatCurrency(grandTotal, currency)} emphasis />
							{/* Tax is inclusive — matches the Cart / Checkout summary. */}
							<p className="text-xs text-muted-foreground">
								{tax
									? `Incl. ${formatCurrency(tax, currency)} tax`
									: "Tax included"}
							</p>
						</CardContent>
					</Card>

					{(shipTo.street || shipTo.city) && (
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Shipping to</CardTitle>
							</CardHeader>
							<CardContent className="text-sm space-y-0.5">
								{shipTo.name && <div className="font-medium">{shipTo.name}</div>}
								{shipTo.street && (
									<div className="whitespace-pre-line text-muted-foreground">
										{shipTo.street}
									</div>
								)}
								<div className="text-muted-foreground">
									{[shipTo.city, shipTo.state, shipTo.postal, shipTo.country]
										.filter(Boolean)
										.join(", ")}
								</div>
							</CardContent>
						</Card>
					)}

					{po && (
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Payment</CardTitle>
							</CardHeader>
							<CardContent className="text-sm">
								Purchase order <span className="font-mono">{po}</span>
							</CardContent>
						</Card>
					)}
				</>
			)}

			<div className="flex justify-center">
				<Button asChild>
					<Link to="/">Continue shopping</Link>
				</Button>
			</div>
		</div>
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
