import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DeliveryMethod } from "@/api/types";
import { formatCurrency } from "@/components/catalog/PriceDisplay";

export interface ShippingMethodsProps {
	readonly methods: readonly DeliveryMethod[];
	readonly selectedId?: string;
	readonly busy?: boolean;
	onSelect: (deliveryMethodId: string) => void | Promise<void>;
}

export default function ShippingMethods({
	methods,
	selectedId,
	busy,
	onSelect,
}: ShippingMethodsProps) {
	const [pendingId, setPendingId] = useState<string | undefined>(selectedId);

	if (methods.length === 0) {
		return (
			<div className="text-sm text-muted-foreground">
				No delivery methods available yet — save a shipping address first.
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="space-y-2">
				{methods.map((m) => {
					const checked = pendingId === m.id;
					return (
						<label
							key={m.id}
							className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer ${
								checked ? "border-primary bg-primary/5" : "border-border"
							}`}
						>
							<input
								type="radio"
								name="deliveryMethod"
								value={m.id}
								checked={checked}
								onChange={() => setPendingId(m.id)}
							/>
							<div className="flex-1">
								<div className="font-medium text-sm">{m.name ?? m.carrier ?? "Delivery"}</div>
								{m.classOfService && (
									<div className="text-xs text-muted-foreground">{m.classOfService}</div>
								)}
							</div>
							<div className="text-sm font-semibold">
								{formatCurrency(m.shippingFee, m.currencyIsoCode) || "—"}
							</div>
						</label>
					);
				})}
			</div>
			<Button
				disabled={!pendingId || busy}
				onClick={() => pendingId && onSelect(pendingId)}
			>
				{busy ? "Saving…" : "Continue"}
			</Button>
		</div>
	);
}
