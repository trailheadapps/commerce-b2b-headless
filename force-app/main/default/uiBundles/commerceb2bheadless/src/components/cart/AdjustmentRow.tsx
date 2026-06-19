// One row in the order summary's "Promotions" section. Discounts are stored
// as negative values by the API; this component normalises the sign and
// renders the deduction with a leading minus.

import { formatCurrency } from "@/components/catalog/PriceDisplay";

export interface AdjustmentRowProps {
	readonly label: string;
	readonly amount?: string | number | null;
	readonly currency?: string | null;
	readonly description?: string;
}

function toNumber(v: string | number | null | undefined): number {
	if (v === null || v === undefined || v === "") return NaN;
	const n = typeof v === "string" ? Number(v) : v;
	return Number.isFinite(n) ? n : NaN;
}

export default function AdjustmentRow({
	label,
	amount,
	currency,
	description,
}: AdjustmentRowProps) {
	const n = toNumber(amount);
	if (!Number.isFinite(n) || n === 0) return null;
	// API gives discounts as negative numbers; render as `−$10.00` regardless.
	const magnitude = Math.abs(n);
	const formatted = formatCurrency(magnitude, currency ?? "USD");
	return (
		<div className="flex justify-between items-baseline">
			<span className="text-emerald-700">
				{label}
				{description && (
					<span className="text-muted-foreground"> · {description}</span>
				)}
			</span>
			<span className="text-emerald-700">−{formatted}</span>
		</div>
	);
}
