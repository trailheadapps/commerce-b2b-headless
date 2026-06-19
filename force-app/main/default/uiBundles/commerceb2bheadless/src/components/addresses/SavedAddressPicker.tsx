import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckoutAddress, SavedAddress } from "@/api/types";

export interface SavedAddressPickerProps {
	readonly addresses: readonly SavedAddress[];
	readonly defaultId?: string;
	readonly busyAddressId?: string;
	// True while the parent is applying the chosen address to the checkout.
	// Disables the "Use this address" button so the buyer can't double-click.
	readonly applying?: boolean;
	onSelect: (address: CheckoutAddress, id: string) => void;
	onAddNew: () => void;
	onEdit?: (address: SavedAddress) => void;
	onDelete?: (addressId: string) => void | Promise<void>;
}

// Formats a saved address into a single-line preview for the picker card.
function summarise(a: SavedAddress): string {
	const parts = [a.city, a.region, a.postalCode, a.country].filter(Boolean);
	return parts.join(", ");
}

// Projects a SavedAddress onto the CheckoutAddress shape expected by PATCH
// /checkouts/active. Multi-line streets come through as "\n"-separated text;
// B2B Commerce accepts that verbatim.
export function toCheckoutAddress(a: SavedAddress): CheckoutAddress {
	return {
		firstName: a.firstName,
		lastName: a.lastName,
		companyName: a.companyName,
		street: a.street,
		city: a.city,
		region: a.region,
		postalCode: a.postalCode,
		country: a.country,
	};
}

// Radio-card picker for saved addresses with an "Add a new address" escape
// hatch that falls back to the manual form.
export default function SavedAddressPicker({
	addresses,
	defaultId,
	busyAddressId,
	applying,
	onSelect,
	onAddNew,
	onEdit,
	onDelete,
}: SavedAddressPickerProps) {
	const [selectedId, setSelectedId] = useState<string | undefined>(
		defaultId ?? addresses.find((a) => a.isDefault)?.addressId ?? addresses[0]?.addressId,
	);

	if (addresses.length === 0) return null;

	const handleContinue = () => {
		const chosen = addresses.find((a) => a.addressId === selectedId);
		if (chosen) onSelect(toCheckoutAddress(chosen), chosen.addressId);
	};

	return (
		<div className="space-y-3">
			<div className="space-y-2">
				{addresses.map((a) => {
					const checked = a.addressId === selectedId;
					return (
						<label
							key={a.addressId}
							className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer ${
								checked ? "border-primary bg-primary/5" : "border-border"
							}`}
						>
							<input
								type="radio"
								name="savedAddress"
								className="mt-1"
								checked={checked}
								onChange={() => setSelectedId(a.addressId)}
							/>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="font-medium text-sm">
										{a.name ||
											`${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() ||
											"Saved address"}
									</span>
									{a.isDefault && (
										<span className="text-[10px] uppercase font-semibold bg-muted px-1.5 py-0.5 rounded">
											Default
										</span>
									)}
								</div>
								{a.street && (
									<div className="text-xs text-muted-foreground whitespace-pre-line">
										{a.street}
									</div>
								)}
								<div className="text-xs text-muted-foreground">{summarise(a)}</div>
							</div>
							{(onEdit || onDelete) && (
								<div className="flex items-center gap-1">
									{onEdit && (
										<button
											type="button"
											aria-label="Edit address"
											disabled={busyAddressId === a.addressId}
											onClick={(e) => {
												e.preventDefault();
												onEdit(a);
											}}
											className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
										>
											<Pencil className="w-3.5 h-3.5" />
										</button>
									)}
									{onDelete && (
										<button
											type="button"
											aria-label="Delete address"
											disabled={busyAddressId === a.addressId}
											onClick={(e) => {
												e.preventDefault();
												void onDelete(a.addressId);
											}}
											className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50"
										>
											<Trash2 className="w-3.5 h-3.5" />
										</button>
									)}
								</div>
							)}
						</label>
					);
				})}
			</div>
			<div className="flex gap-2">
				<Button onClick={handleContinue} disabled={!selectedId || applying}>
					{applying ? "Applying…" : "Use this address"}
				</Button>
				<Button variant="outline" onClick={onAddNew} disabled={applying}>
					Add a new address
				</Button>
			</div>
		</div>
	);
}
