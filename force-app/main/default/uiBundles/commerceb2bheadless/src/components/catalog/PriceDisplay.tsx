// Renders a single price with its currency.
// When price is missing (e.g. pricing endpoint 403/404), we fall back to
// "Request quote" — matches B2B expectations where not every buyer sees prices.

import { useActiveLocale } from "@/hooks/useActiveLocale";
import { getActiveLocale } from "@/lib/locale";

export interface PriceDisplayProps {
	readonly amount?: string | number | null;
	readonly currency?: string | null;
	readonly listPrice?: string | number | null;
	readonly className?: string;
}

// `locale` (BCP-47) controls number/grouping/symbol formatting. Defaults to the
// active locale so every caller formats for the resolved market's region (e.g.
// German grouping `1.234,56 €`) without having to thread it through; callers
// may still pass an explicit locale to override.
export function formatCurrency(
	amount: string | number | null | undefined,
	currency: string | null | undefined,
	locale: string = getActiveLocale(),
): string {
	if (amount === null || amount === undefined || amount === "") return "";
	const num = typeof amount === "string" ? Number(amount) : amount;
	if (!Number.isFinite(num)) return "";
	const iso = currency || "USD";
	try {
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currency: iso,
		}).format(num);
	} catch {
		return `${iso} ${num.toFixed(2)}`;
	}
}

export default function PriceDisplay({
	amount,
	currency,
	listPrice,
	className,
}: PriceDisplayProps) {
	const locale = useActiveLocale();
	const formatted = formatCurrency(amount, currency, locale);
	if (!formatted) {
		return (
			<span className={`text-sm text-muted-foreground italic ${className ?? ""}`}>
				Request quote
			</span>
		);
	}
	const listNum = listPrice !== undefined && listPrice !== null ? Number(listPrice) : null;
	const unitNum = Number(amount);
	const showStrike = listNum !== null && Number.isFinite(listNum) && listNum > unitNum;
	return (
		<span className={`inline-flex items-baseline gap-2 ${className ?? ""}`}>
			<span className="font-semibold text-foreground">{formatted}</span>
			{showStrike && (
				<span className="text-xs text-muted-foreground line-through">
					{formatCurrency(listNum, currency, locale)}
				</span>
			)}
		</span>
	);
}
