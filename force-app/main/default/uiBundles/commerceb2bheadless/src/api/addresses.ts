// Address book Connect API: saved addresses on the buyer's account.
import type { CheckoutAddress, SavedAddressesResponse } from "@/api/types";
import { base, parse, qs, sdkFetch } from "@/api/http";

// Returns the buyer's saved addresses via /accounts/current/addresses, which
// avoids resolving the buyer's account id separately. The default address
// (if any) has `isDefault: true`.
export async function getSavedAddresses(
	addressType: "Shipping" | "Billing" = "Shipping",
): Promise<SavedAddressesResponse> {
	const url =
		`${base()}/accounts/current/addresses` +
		qs({
			addressType,
			excludeUnsupportedCountries: true,
			pageSize: 20,
			shouldShowDefaultAddrFirst: true,
			sortOrder: "CreatedDateDesc",
			language: "en-US",
			asGuest: false,
			htmlEncode: false,
		});
	const res = await sdkFetch(url);
	if (res.status === 404 || res.status === 403) {
		return { count: 0, items: [] };
	}
	return parse<SavedAddressesResponse>(res, "Failed to load saved addresses");
}

// Persists a new address to the buyer's address book. Returns the saved
// record (including its addressId).
export async function createSavedAddress(
	address: CheckoutAddress,
	addressType: "Shipping" | "Billing" = "Shipping",
	isDefault = false,
): Promise<{ addressId?: string } & Record<string, unknown>> {
	const url =
		`${base()}/accounts/current/addresses` +
		qs({ language: "en-US", asGuest: false, htmlEncode: false });
	const res = await sdkFetch(url, {
		method: "POST",
		body: JSON.stringify({
			firstName: address.firstName,
			lastName: address.lastName,
			companyName: address.companyName,
			street: address.street,
			city: address.city,
			region: address.region,
			postalCode: address.postalCode,
			country: address.country,
			isDefault,
			addressType,
		}),
	});
	return parse<{ addressId?: string } & Record<string, unknown>>(
		res,
		"Failed to save address",
	);
}

// Updates an existing saved address.
//   PATCH /commerce/webstores/{id}/accounts/current/addresses/{addressId}
// The body is the same shape as POST; `addressId` and `name` must NOT be in
// the body (server rejects with JSON_PARSER_ERROR / synthesises name from
// firstName+lastName).
export async function updateSavedAddress(
	addressId: string,
	address: CheckoutAddress,
	addressType: "Shipping" | "Billing" = "Shipping",
	isDefault?: boolean,
): Promise<void> {
	const url =
		`${base()}/accounts/current/addresses/${encodeURIComponent(addressId)}` +
		qs({ language: "en-US", asGuest: false, htmlEncode: false });
	const res = await sdkFetch(url, {
		method: "PATCH",
		body: JSON.stringify({
			firstName: address.firstName,
			lastName: address.lastName,
			companyName: address.companyName,
			street: address.street,
			city: address.city,
			region: address.region,
			postalCode: address.postalCode,
			country: address.country,
			isDefault: isDefault ?? false,
			addressType,
		}),
	});
	if (!res.ok && res.status !== 204) {
		await parse<unknown>(res, "Failed to update address");
	}
}

// Removes a saved address.
//   DELETE /commerce/webstores/{id}/accounts/current/addresses/{addressId}
export async function deleteSavedAddress(addressId: string): Promise<void> {
	const url = `${base()}/accounts/current/addresses/${encodeURIComponent(addressId)}`;
	const res = await sdkFetch(url, { method: "DELETE" });
	if (!res.ok && res.status !== 204) {
		await parse<unknown>(res, "Failed to delete address");
	}
}
