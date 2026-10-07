// Taxes Connect API:
//
//   GET /commerce/webstores/{id}/taxes/products/{productId}
//     Per-product tax rate for PDP display on Gross-tax stores.
//
//   POST /commerce/webstores/{id}/taxes/actions/calculate-taxes
//     Real-time tax calculation for a set of line items + shipping address.
//     Called in checkout after the buyer confirms their shipping address so
//     they see a real tax amount before placing the order.

import type { CalculateTaxesRequest, CalculateTaxesResponse, ProductTaxResponse } from "@/api/types";
import { base, parse, qs, sdkFetch } from "@/api/http";
import { getEffectiveAccountId } from "@/lib/commerceContext";

export interface ProductTaxParams {
	readonly productId: string;
	// Optional address override — if omitted, the platform uses the buyer's
	// default shipping country / the webstore's default country.
	readonly countryIsoCode?: string;
	readonly stateIsoCode?: string;
	readonly effectiveAccountId?: string;
}

export async function getProductTax(
	params: ProductTaxParams,
): Promise<ProductTaxResponse> {
	// Tax is account-scoped like pricing — default to the buyer's account so the
	// PDP "+X% tax" line resolves for logged-in shoppers. Guests resolve to
	// `undefined` (dropped by `qs`) and fall back to the store default country.
	const effectiveAccountId =
		params.effectiveAccountId ?? (await getEffectiveAccountId());
	const url =
		`${base()}/taxes/products/${encodeURIComponent(params.productId)}` +
		qs({
			countryIsoCode: params.countryIsoCode,
			stateIsoCode: params.stateIsoCode,
			effectiveAccountId,
		});
	const res = await sdkFetch(url);
	return parse<ProductTaxResponse>(res, "Failed to load product tax");
}

// Calculate taxes for a set of line items at a specific shipping address.
// Called after the buyer confirms their shipping address in checkout so the
// order summary can show a real-time tax breakdown before they place the order.
//
//   POST /commerce/webstores/{id}/taxes/actions/calculate-taxes
//
// The `cartItems` array groups line items by delivery address — most checkouts
// have a single group. Each line item needs productId, quantity, and unitPrice.
export async function calculateTaxes(
	req: CalculateTaxesRequest,
): Promise<CalculateTaxesResponse> {
	const url = `${base()}/taxes/actions/calculate-taxes`;
	const res = await sdkFetch(url, {
		method: "POST",
		body: JSON.stringify(req),
	});
	return parse<CalculateTaxesResponse>(res, "Failed to calculate taxes");
}
