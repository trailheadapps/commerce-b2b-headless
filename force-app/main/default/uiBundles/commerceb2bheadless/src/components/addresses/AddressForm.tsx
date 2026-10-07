import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CheckoutAddress } from "@/api/types";
import { useActiveLocale } from "@/hooks/useActiveLocale";
import { useShippingCountries } from "@/hooks/useShippingCountries";
import {
	DEFAULT_COUNTRY,
	countryLabel,
	normalizeAddress,
	preferredCountry,
	toIsoCountry,
} from "@/lib/address";

// Curated US-states list. We deliberately ship a small subset (10) for the
// reference UI — the full picklist comes from the org's address settings
// and would normally be fetched via the AddressCountries Connect API.
// `value` is the ISO code sent on the wire; `label` is what the buyer sees.
const US_STATES: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
	{ value: "AZ", label: "Arizona" },
	{ value: "CA", label: "California" },
	{ value: "FL", label: "Florida" },
	{ value: "GA", label: "Georgia" },
	{ value: "IL", label: "Illinois" },
	{ value: "MA", label: "Massachusetts" },
	{ value: "NY", label: "New York" },
	{ value: "PA", label: "Pennsylvania" },
	{ value: "TX", label: "Texas" },
	{ value: "WA", label: "Washington" },
];

// German Bundesländer. `value` is the ISO 3166-2:DE code sent on the wire; it
// must match a StateCode configured in the org's picklist (see Settings:Address
// — these 16 were added there). Optional at checkout (German addresses commonly
// omit the state), unlike the required US state.
const DE_STATES: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
	{ value: "BW", label: "Baden-Württemberg" },
	{ value: "BY", label: "Bayern" },
	{ value: "BE", label: "Berlin" },
	{ value: "BB", label: "Brandenburg" },
	{ value: "HB", label: "Bremen" },
	{ value: "HH", label: "Hamburg" },
	{ value: "HE", label: "Hessen" },
	{ value: "MV", label: "Mecklenburg-Vorpommern" },
	{ value: "NI", label: "Niedersachsen" },
	{ value: "NW", label: "Nordrhein-Westfalen" },
	{ value: "RP", label: "Rheinland-Pfalz" },
	{ value: "SL", label: "Saarland" },
	{ value: "SN", label: "Sachsen" },
	{ value: "ST", label: "Sachsen-Anhalt" },
	{ value: "SH", label: "Schleswig-Holstein" },
	{ value: "TH", label: "Thüringen" },
];

// Countries we render a subdivision picklist for, keyed by ISO country code.
// A country here should also be in REGION_COUNTRIES (@/lib/address) so its
// region/StateCode is actually sent. Countries NOT listed render no region
// field at all — the org's picklist has no entries for them and rejects any
// StateCode (INVALID_API_INPUT); normalizeAddress drops it on the wire too.
const STATES_BY_COUNTRY: Record<string, typeof US_STATES> = {
	US: US_STATES,
	DE: DE_STATES,
};

// Countries where a state/subdivision is REQUIRED (others make it optional).
const REGION_REQUIRED: ReadonlySet<string> = new Set(["US"]);

// Shared classes for the native <select> controls (country + US state), so they
// match the Input styling.
const SELECT_CLASS =
	"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const EMPTY: CheckoutAddress = {
	firstName: "",
	lastName: "",
	street: "",
	city: "",
	region: "",
	postalCode: "",
	country: "",
	companyName: "",
};

export interface AddressFormProps {
	readonly initial?: CheckoutAddress;
	readonly submitLabel?: string;
	// Copy shown on the button while `busy` is true. Defaults to "Saving…";
	// callers handling an update flow should pass "Updating…".
	readonly busyLabel?: string;
	readonly busy?: boolean;
	onSubmit: (address: CheckoutAddress) => void | Promise<void>;
}

function Field({
	label,
	value,
	onChange,
	required,
	autoComplete,
	name,
	className,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	required?: boolean;
	autoComplete?: string;
	name: string;
	className?: string;
}) {
	return (
		<div className={`space-y-1 ${className ?? ""}`}>
			<Label htmlFor={name}>
				{label}
				{required && <span className="text-destructive"> *</span>}
			</Label>
			<Input
				id={name}
				name={name}
				value={value}
				required={required}
				autoComplete={autoComplete}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
	);
}

export default function AddressForm({
	initial,
	submitLabel = "Continue",
	busyLabel = "Saving…",
	busy,
	onSubmit,
}: AddressFormProps) {
	const { data: shipping } = useShippingCountries();
	const activeLocale = useActiveLocale();
	// Countries the store ships to (falls back to US-only until context loads).
	const countries = useMemo<readonly string[]>(
		() => (shipping?.countries?.length ? shipping.countries : [DEFAULT_COUNTRY]),
		[shipping],
	);

	const [form, setForm] = useState<CheckoutAddress>(() => ({ ...EMPTY, ...initial }));
	const set = (k: keyof CheckoutAddress, v: string) => setForm((f) => ({ ...f, [k]: v }));

	// Country the form defaults to until the shopper picks one: an existing/saved
	// value if present, else the active market's country. Derived at render (not
	// synced into state) so it settles automatically once shipping options load.
	const defaultCountry = useMemo(
		() =>
			toIsoCountry(initial?.country, countries) ??
			preferredCountry(activeLocale, countries, shipping?.homeCountry),
		[initial, countries, activeLocale, shipping],
	);
	// Empty `form.country` means "not yet picked" → fall back to the default.
	const selectedCountry = form.country || defaultCountry;

	// Only some countries have a curated subdivision picklist; the rest render
	// no region field at all (the org's picklist rejects their StateCodes).
	const states = STATES_BY_COUNTRY[selectedCountry];
	const regionRequired = REGION_REQUIRED.has(selectedCountry);
	// Germany-style optional subdivisions read as "State / Province"; the US
	// mandatory one just reads "State".
	const regionLabel = regionRequired ? "State" : "State / Province";

	return (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault();
				// normalizeAddress coerces the country to ISO and drops the
				// region/StateCode for countries the org's picklist can't accept it
				// for (everything but US here), which otherwise 400s on save/checkout.
				void onSubmit(normalizeAddress({ ...form, country: selectedCountry }, countries));
			}}
		>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<Field
					name="firstName"
					label="First name"
					autoComplete="given-name"
					required
					value={form.firstName ?? ""}
					onChange={(v) => set("firstName", v)}
				/>
				<Field
					name="lastName"
					label="Last name"
					autoComplete="family-name"
					required
					value={form.lastName ?? ""}
					onChange={(v) => set("lastName", v)}
				/>
			</div>
			<Field
				name="companyName"
				label="Company"
				autoComplete="organization"
				value={form.companyName ?? ""}
				onChange={(v) => set("companyName", v)}
			/>
			<Field
				name="street"
				label="Street"
				autoComplete="street-address"
				required
				value={form.street ?? ""}
				onChange={(v) => set("street", v)}
			/>
			<div
				className={`grid grid-cols-1 gap-3 ${states ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
			>
				<Field
					name="city"
					label="City"
					autoComplete="address-level2"
					required
					value={form.city ?? ""}
					onChange={(v) => set("city", v)}
				/>
				{/* Region only where the org accepts a StateCode (US, DE). Other
				    countries omit it entirely — a region there is rejected as an
				    invalid StateCode. Required for the US, optional elsewhere. */}
				{states && (
					<div className="space-y-1">
						<Label htmlFor="region">
							{regionLabel}
							{regionRequired && <span className="text-destructive"> *</span>}
						</Label>
						<select
							id="region"
							name="region"
							required={regionRequired}
							autoComplete="address-level1"
							value={form.region ?? ""}
							onChange={(e) => set("region", e.target.value)}
							className={SELECT_CLASS}
						>
							{/* Placeholder: disabled (forces a pick) when required, else a
							    real selectable "none" so optional regions can stay empty. */}
							<option value="" disabled={regionRequired}>
								{regionRequired ? "Select a state" : "Select a state (optional)"}
							</option>
							{states.map((s) => (
								<option key={s.value} value={s.value}>
									{s.label}
								</option>
							))}
						</select>
					</div>
				)}
				<Field
					name="postalCode"
					label="Postal code"
					autoComplete="postal-code"
					required
					value={form.postalCode ?? ""}
					onChange={(v) => set("postalCode", v)}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor="country">
					Country <span className="text-destructive">*</span>
				</Label>
				<select
					id="country"
					name="country"
					required
					autoComplete="country"
					value={selectedCountry}
					onChange={(e) =>
						// A region code is country-specific (a US state is invalid for DE),
						// so clear it whenever the country changes.
						setForm((f) => ({ ...f, country: e.target.value, region: "" }))
					}
					className={SELECT_CLASS}
				>
					{countries.map((c) => (
						<option key={c} value={c}>
							{countryLabel(c)}
						</option>
					))}
				</select>
			</div>
			<Button type="submit" disabled={busy}>
				{busy ? busyLabel : submitLabel}
			</Button>
		</form>
	);
}
