// Evaluate promotions for a list of products (PLP/PDP). Returns a map keyed
// by productId so callers can look up the post-promotion price + adjustments
// inline while rendering cards/details. Promo evaluation must never block
// product rendering — page code should treat a missing entry as "no promo".

import { useMemo } from "react";
import { evaluateProducts } from "@/api";
import type {
	PromotionProductEvaluationResult,
	PromotionProductInput,
} from "@/api/types";
import { useAsync, type UseAsyncResult } from "./useAsync";

export type PromotionEvaluationMap = ReadonlyMap<
	string,
	PromotionProductEvaluationResult
>;

export type UsePromotionEvaluationResult = UseAsyncResult<PromotionEvaluationMap>;

export function usePromotionEvaluation(
	products: readonly PromotionProductInput[] | undefined,
): UsePromotionEvaluationResult {
	// Stable key — re-fire only when the set of (productId, salesPrice)
	// pairs changes. Re-rendering with the same products should not trigger
	// another evaluate call.
	const key = useMemo(() => {
		if (!products || products.length === 0) return "";
		return products
			.map((p) => `${p.productId}:${p.salesPrice}`)
			.sort()
			.join("|");
	}, [products]);

	return useAsync<PromotionEvaluationMap>(async () => {
		if (!products || products.length === 0) return new Map();
		const resp = await evaluateProducts({ products });
		const map = new Map<string, PromotionProductEvaluationResult>();
		for (const result of resp.promotionProductEvaluationResults ?? []) {
			if (result.productId) map.set(result.productId, result);
		}
		return map;
	}, [key]);
}
