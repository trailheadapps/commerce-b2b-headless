import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CheckoutAddress } from "@/api/types";

export interface AddressFormProps {
	readonly initial?: CheckoutAddress;
	readonly submitLabel?: string;
	// Copy shown on the button while `busy` is true. Defaults to "Saving…";
	// callers handling an update flow should pass "Updating…".
	readonly busyLabel?: string;
	readonly busy?: boolean;
	onSubmit: (address: CheckoutAddress) => void | Promise<void>;
}

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

const DEFAULT_COUNTRY = "US";

const EMPTY: CheckoutAddress = {
	firstName: "",
	lastName: "",
	street: "",
	city: "",
	region: "",
	postalCode: "",
	country: DEFAULT_COUNTRY,
	companyName: "",
};

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
	const [form, setForm] = useState<CheckoutAddress>({
		...EMPTY,
		...initial,
		// Always send US — see DEFAULT_COUNTRY above. Initial values from saved
		// addresses might carry "United States"; we override to the ISO code.
		country: DEFAULT_COUNTRY,
	});
	const set = (k: keyof CheckoutAddress, v: string) => setForm((f) => ({ ...f, [k]: v }));

	return (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault();
				void onSubmit(form);
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
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<Field
					name="city"
					label="City"
					autoComplete="address-level2"
					required
					value={form.city ?? ""}
					onChange={(v) => set("city", v)}
				/>
				<div className="space-y-1">
					<Label htmlFor="region">
						State <span className="text-destructive">*</span>
					</Label>
					<select
						id="region"
						name="region"
						required
						autoComplete="address-level1"
						value={form.region ?? ""}
						onChange={(e) => set("region", e.target.value)}
						className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
					>
						<option value="" disabled>
							Select a state
						</option>
						{US_STATES.map((s) => (
							<option key={s.value} value={s.value}>
								{s.label}
							</option>
						))}
					</select>
				</div>
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
				<Label htmlFor="country">Country</Label>
				<Input id="country" name="country" value="United States" disabled />
				{/* Form sends ISO "US" — see DEFAULT_COUNTRY. */}
			</div>
			<Button type="submit" disabled={busy}>
				{busy ? busyLabel : submitLabel}
			</Button>
		</form>
	);
}
