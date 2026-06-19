// Small "Save X%" badge shown on PLP cards and PDP price blocks when a
// promotion brings the price below the sales price. Returns null when there
// is no promo to advertise so callers can render it unconditionally.

export interface PromotionBadgeProps {
	readonly salesPrice?: string | number | null;
	readonly promotionalPrice?: string | number | null;
	readonly label?: string;
	readonly className?: string;
}

function toNumber(v: string | number | null | undefined): number {
	if (v === null || v === undefined || v === "") return NaN;
	const n = typeof v === "string" ? Number(v) : v;
	return Number.isFinite(n) ? n : NaN;
}

export default function PromotionBadge({
	salesPrice,
	promotionalPrice,
	label,
	className,
}: PromotionBadgeProps) {
	const sales = toNumber(salesPrice);
	const promo = toNumber(promotionalPrice);
	if (!Number.isFinite(sales) || !Number.isFinite(promo) || promo >= sales) {
		return null;
	}
	const percent = Math.round(((sales - promo) / sales) * 100);
	const text = label ?? (percent > 0 ? `Save ${percent}%` : "On promotion");
	return (
		<span
			className={`inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 ${className ?? ""}`}
		>
			{text}
		</span>
	);
}
