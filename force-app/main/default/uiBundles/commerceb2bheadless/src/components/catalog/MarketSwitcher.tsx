// Country / currency picker for the storefront header.
//
// Commerce Markets are keyed by locale (see docs/locale-change-code-path.md):
// each market in application-context carries a `localeCurrencyMap` (e.g.
// `{ en_US: "USD" }`, `{ de: "EUR" }`). This dropdown lists one option per
// locale and, on pick, persists the choice (lib/locale `setActiveLocale`) and
// hard-reloads. After the reload every Connect call sends the new locale as its
// `language` param, which is what the server resolves the Market — hence
// currency + entitlement pricing — from.
//
// A cart holds a single (market-derived) currency, so we delete the active cart
// before switching to avoid a currency-mismatch on the next cart load.
//
// Renders nothing unless the store has 2+ market locales configured.
import { useMemo, useState } from "react";
import { Check, Globe } from "lucide-react";
import type { MarketData } from "@/api/types";
import { deleteActiveCart, getActiveCart } from "@/api/cart";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarketPicker } from "@/hooks/useMarkets";
import {
	DEFAULT_LOCALE,
	getActiveLocale,
	localeLabel,
	normalizeToBcp47,
	setActiveLocale,
} from "@/lib/locale";

interface MarketOption {
	// BCP-47 locale (the value persisted + sent as the Connect `language` param).
	readonly locale: string;
	readonly currency: string;
	readonly label: string;
}

// Flatten markets → one option per distinct locale, default locale first.
//
// application-context's `markets[]` lists only the ADDITIONAL markets — the
// store's home market (US/USD here) is NOT in it; it's carried as `country` +
// `defaultCurrency`. So we always seed a home option from the store default
// currency (keyed on DEFAULT_LOCALE), then add the configured market locales.
// Without this, a store with a single extra market yields one option and the
// picker hides itself (options.length < 2).
function buildOptions(
	markets: readonly MarketData[],
	defaultCurrency?: string,
): MarketOption[] {
	const seen = new Set<string>();
	const options: MarketOption[] = [];
	// Home / default market.
	const homeCurrency = defaultCurrency ?? "USD";
	seen.add(DEFAULT_LOCALE);
	options.push({
		locale: DEFAULT_LOCALE,
		currency: homeCurrency,
		label: localeLabel(DEFAULT_LOCALE, homeCurrency),
	});
	for (const market of markets) {
		for (const [loc, currency] of Object.entries(market.localeCurrencyMap ?? {})) {
			const locale = normalizeToBcp47(loc);
			if (seen.has(locale)) continue;
			seen.add(locale);
			options.push({ locale, currency, label: localeLabel(loc, currency) });
		}
	}
	return options.sort((a, b) => {
		const rank = (o: MarketOption) => (o.locale === DEFAULT_LOCALE ? 0 : 1);
		return rank(a) - rank(b) || a.label.localeCompare(b.label);
	});
}

export default function MarketSwitcher() {
	const { data } = useMarketPicker();
	const [switching, setSwitching] = useState(false);

	const options = useMemo(
		() => buildOptions(data?.markets ?? [], data?.defaultCurrency),
		[data],
	);
	const active = normalizeToBcp47(getActiveLocale());

	// Nothing to switch between — hide the control entirely.
	if (options.length < 2) return null;

	const current = options.find((o) => o.locale === active) ?? options[0];

	async function handleSelect(opt: MarketOption) {
		if (opt.locale === active || switching) return;
		setSwitching(true);
		try {
			// Best-effort: clear a cart in the old currency. A guest / empty-cart
			// session throws or returns nothing — proceed with the switch either way.
			try {
				const summary = await getActiveCart();
				if (Number(summary.totalProductCount ?? 0) > 0) {
					if (!window.confirm("Switching country will empty your current cart. Continue?")) {
						setSwitching(false);
						return;
					}
					await deleteActiveCart();
				}
			} catch {
				/* no cart / guest / fetch failed — nothing to clear */
			}
			setActiveLocale(opt.locale);
			// Full reload so cached contexts + every Connect call adopt the new locale.
			window.location.reload();
		} catch {
			setSwitching(false);
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="gap-2"
					disabled={switching}
					aria-label="Select country and currency"
				>
					<Globe className="size-4" />
					<span className="hidden sm:inline">{current.label}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				<DropdownMenuLabel>Country / currency</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{options.map((opt) => (
					<DropdownMenuItem
						key={opt.locale}
						className="justify-between gap-3"
						onSelect={() => {
							void handleSelect(opt);
						}}
					>
						<span>{opt.label}</span>
						{opt.locale === active && <Check className="size-4" />}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
