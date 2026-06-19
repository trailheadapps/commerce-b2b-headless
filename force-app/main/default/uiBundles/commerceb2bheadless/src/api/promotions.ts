// Promotions Connect API: product-level promo evaluation for PLP/PDP.
//
// The promotions endpoints live at `/commerce/promotions/...` — note: NOT
// under `/webstores/{id}/...` like every other commerce call, so they go
// through `promotionsBase()` instead of `base()`. The store id is passed in
// the request body (`webStoreId`) instead.
//
// Cart-level promotion adjustments are surfaced by the cart-items GET when
// called with `includePromotions=true` (see `api/cart.ts`). We deliberately
// don't expose `/promotions/actions/evaluate` here — it's a dry-run endpoint
// that doesn't persist adjustments to the cart, and the cart-items GET
// already returns the same data once a coupon is applied via cart-coupons.

import type {
	PromotionProductEvaluationResponse,
	PromotionProductInput,
} from "@/api/types";
import { parse, promotionsBase, sdkFetch } from "@/api/http";
import { COMMERCE } from "@/config/commerce";

export interface EvaluateProductsParams {
	readonly products: readonly PromotionProductInput[];
	readonly effectiveAccountId?: string;
	// Defaults to the configured webstore. Override only for cross-store
	// evaluation (rare; not used by the storefront).
	readonly webStoreId?: string;
	readonly currencyIsoCode?: string;
}

// Compute the promotional price + applicable adjustments for a list of
// products. Used on PLP (page of search results) and PDP (single product).
// Body is flat — no wrapper key. `webStoreId` is camelCase with a capital S.
export async function evaluateProducts(
	params: EvaluateProductsParams,
): Promise<PromotionProductEvaluationResponse> {
	if (params.products.length === 0) {
		// Avoid a needless server round-trip on empty PLPs.
		return { promotionProductEvaluationResults: [] };
	}
	const url = `${promotionsBase()}/actions/evaluate-products`;
	const body = {
		products: params.products,
		webStoreId: params.webStoreId ?? COMMERCE.WEBSTORE_ID,
		...(params.effectiveAccountId
			? { effectiveAccountId: params.effectiveAccountId }
			: {}),
		...(params.currencyIsoCode ? { currencyIsoCode: params.currencyIsoCode } : {}),
	};
	const res = await sdkFetch(url, {
		method: "POST",
		body: JSON.stringify(body),
	});
	return parse<PromotionProductEvaluationResponse>(res, "Failed to evaluate promotions");
}
