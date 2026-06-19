import { searchProducts, type ProductSearchParams } from "@/api";
import type { ProductSearchResponse } from "@/api/types";
import { useAsync, type UseAsyncResult } from "./useAsync";

// Empty result returned while we're waiting for the caller to provide either
// a searchTerm or a categoryId. The search endpoint requires at least one.
const EMPTY_RESPONSE: ProductSearchResponse = {
	productsPage: { total: 0, pageSize: 0, currentPage: 0, products: [] },
	facets: [],
};

export function useProductSearch(
	params: ProductSearchParams,
): UseAsyncResult<ProductSearchResponse> {
	// Treat the literal strings "undefined"/"null" as no-scope — those only
	// appear when a route param is missing and got stringified somewhere.
	const validCategoryId =
		params.categoryId && params.categoryId !== "undefined" && params.categoryId !== "null"
			? params.categoryId
			: undefined;
	const hasScope =
		(params.searchTerm && params.searchTerm.trim() !== "") || !!validCategoryId;

	// Stable dep key — refinements are serialized so array identity doesn't
	// cause re-fetches.
	const depKey = JSON.stringify({
		hasScope,
		searchTerm: params.searchTerm ?? "",
		categoryId: validCategoryId ?? "",
		page: params.page ?? 0,
		pageSize: params.pageSize ?? 20,
		refinements: params.refinements ?? [],
	});
	return useAsync(
		() =>
			hasScope
				? searchProducts({ ...params, categoryId: validCategoryId })
				: Promise.resolve(EMPTY_RESPONSE),
		[depKey],
	);
}
