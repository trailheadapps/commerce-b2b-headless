import { Link } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/components/catalog/PriceDisplay";
import { orderListField } from "@/api/types";
import { COMMERCE_ROUTES } from "@/config/commerce";
import { useOrders } from "@/hooks/useOrders";

// Buyer's order history. Field names vary by org (flat vs. wrapped), so
// every value comes through `orderListField` which consults both shapes.
export default function OrdersPage() {
	const { data, loading, error } = useOrders(50);
	const orders = data?.orderSummaries ?? [];

	return (
		<div className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto">
			<h1 className="text-2xl font-semibold mb-6">My orders</h1>

			{error && (
				<Alert variant="destructive">
					<AlertTitle>Could not load orders</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{loading && orders.length === 0 && (
				<div className="space-y-3">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-16 w-full" />
					))}
				</div>
			)}

			{!loading && orders.length === 0 && !error && (
				<div className="text-center py-12 space-y-4">
					<p className="text-muted-foreground">You haven't placed any orders yet.</p>
					<Button asChild>
						<Link to="/">Start shopping</Link>
					</Button>
				</div>
			)}

			<div className="space-y-3">
				{orders.map((o, idx) => {
					const orderNumber = orderListField(o, "OrderNumber");
					const orderedDate = orderListField(o, "OrderedDate");
					const status = orderListField(o, "Status");
					const total =
						orderListField(o, "GrandTotalAmount") ||
						orderListField(o, "TotalAmount");
					const currency = orderListField(o, "CurrencyIsoCode") || "USD";
					const key = o.orderSummaryId ?? o.id ?? orderNumber ?? String(idx);
					const linkKey = orderNumber || o.orderSummaryId || o.id || "";
					return (
						<Card key={key}>
							<CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
								<div className="min-w-0">
									<div className="font-medium font-mono text-sm">
										{orderNumber || key}
									</div>
									<div className="text-xs text-muted-foreground">
										{orderedDate
											? new Date(orderedDate).toLocaleDateString()
											: ""}
										{status ? ` • ${status}` : ""}
									</div>
								</div>
								<div className="text-sm font-semibold">
									{formatCurrency(total, currency)}
								</div>
								<Button variant="outline" size="sm" asChild>
									<Link to={COMMERCE_ROUTES.ORDER(linkKey)}>View</Link>
								</Button>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}
