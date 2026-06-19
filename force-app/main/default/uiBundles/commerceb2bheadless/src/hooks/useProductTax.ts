// PDP tax-rate hook. Fetches the buyer-applicable tax rate for a single
// product so the price block can show "+X% tax" alongside the price on
// Gross-tax stores.
//
// Returns `null` (not an error) on Net-tax stores so the caller can
// render unconditionally — no separate "+X% tax" line is appropriate
// when prices already include tax.

import { getProductTax } from "@/api";
import { useAsync, type UseAsyncResult } from "./useAsync";

export interface ProductTaxRate {
	readonly taxRatePercentage: number;
	readonly taxTreatmentName?: string;
	readonly taxLocaleType: "Gross";
}

export function useProductTax(
	productId: string | undefined,
): UseAsyncResult<ProductTaxRate | null> {
	return useAsync(async () => {
		if (!productId) return null;
		const resp = await getProductTax({ productId });
		// Net-tax stores include tax in price — don't render a separate row.
		if (resp.taxLocaleType !== "Gross") return null;
		const info = resp.taxesInfo?.[productId];
		const policy = info?.taxesInfoList?.[0];
		const rate = policy?.taxRatePercentage ? Number(policy.taxRatePercentage) : NaN;
		if (!Number.isFinite(rate)) return null;
		return {
			taxRatePercentage: rate,
			taxTreatmentName: policy?.taxTreatmentName,
			taxLocaleType: "Gross",
		};
	}, [productId]);
}
