import { useCallback, useEffect, useState } from "react";
import {
	createSavedAddress,
	deleteSavedAddress,
	getSavedAddresses,
	updateSavedAddress,
} from "@/api";
import type { CheckoutAddress, SavedAddress } from "@/api/types";

export interface UseSavedAddressesResult {
	readonly addresses: readonly SavedAddress[];
	readonly defaultAddress: SavedAddress | undefined;
	readonly loading: boolean;
	// True while a save / update / delete is in flight. Callers can drive
	// per-button busy states off this flag.
	readonly saving: boolean;
	readonly error: string | null;
	refresh: () => Promise<void>;
	// Saves a new address to the buyer's address book and refreshes the list.
	// Returns the new saved record so callers can use its id.
	save: (address: CheckoutAddress, isDefault?: boolean) => Promise<SavedAddress | null>;
	update: (addressId: string, address: CheckoutAddress, isDefault?: boolean) => Promise<void>;
	remove: (addressId: string) => Promise<void>;
}

// Loads the buyer's saved shipping addresses from
// /accounts/current/addresses and exposes a `save` action that POSTs to the
// same endpoint and refreshes the list.
export function useSavedAddresses(
	addressType: "Shipping" | "Billing" = "Shipping",
): UseSavedAddressesResult {
	const [addresses, setAddresses] = useState<readonly SavedAddress[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const resp = await getSavedAddresses(addressType);
			setAddresses(resp.items ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [addressType]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const save = useCallback(
		async (address: CheckoutAddress, isDefault = false): Promise<SavedAddress | null> => {
			setSaving(true);
			try {
				const created = await createSavedAddress(address, addressType, isDefault);
				await refresh();
				return (created as SavedAddress) ?? null;
			} finally {
				setSaving(false);
			}
		},
		[addressType, refresh],
	);

	const update = useCallback(
		async (addressId: string, address: CheckoutAddress, isDefault?: boolean): Promise<void> => {
			setSaving(true);
			try {
				await updateSavedAddress(addressId, address, addressType, isDefault);
				await refresh();
			} finally {
				setSaving(false);
			}
		},
		[addressType, refresh],
	);

	const remove = useCallback(
		async (addressId: string): Promise<void> => {
			setSaving(true);
			try {
				await deleteSavedAddress(addressId);
				await refresh();
			} finally {
				setSaving(false);
			}
		},
		[refresh],
	);

	const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
	return { addresses, defaultAddress, loading, saving, error, refresh, save, update, remove };
}
