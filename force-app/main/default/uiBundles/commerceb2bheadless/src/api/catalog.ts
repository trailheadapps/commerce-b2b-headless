// Catalog Connect API: categories, product search, product detail, pricing.
import type {
	CategoryNode,
	ProductCategoriesResponse,
	ProductCategoryPathResponse,
	ProductDetail,
	ProductPrice,
	ProductSearchResponse,
} from "@/api/types";
import { base, parse, qs, sdkFetch } from "@/api/http";

export async function getProductCategories(
	parentId?: string,
): Promise<ProductCategoriesResponse> {
	const params: Record<string, string | number | boolean> = {
		language: "en-US",
		asGuest: false,
		htmlEncode: false,
	};
	if (parentId) params.parentProductCategoryId = parentId;
	const url = `${base()}/product-categories/children` + qs(params);
	const res = await sdkFetch(url);
	return parse<ProductCategoriesResponse>(res, "Failed to load categories");
}

// `children` response has name only at fields.Name; `path` response has it top-level.
function categoryName(c: { fields?: { Name?: string | null } }): string {
	return c.fields?.Name ?? "";
}

export async function getCategoryPath(categoryId: string): Promise<ProductCategoryPathResponse> {
	const url =
		`${base()}/product-category-path/product-categories/${encodeURIComponent(categoryId)}` +
		qs({ language: "en-US", asGuest: false, htmlEncode: false });
	const res = await sdkFetch(url);
	return parse<ProductCategoryPathResponse>(res, "Failed to load category path");
}

// Fetches root categories then each root's children in parallel, producing a
// two-level tree. The current sidebar only renders two levels so this matches
// the depth that was previously rendered from `category-menu-items`.
export async function getCategoryTree(): Promise<readonly CategoryNode[]> {
	const rootResp = await getProductCategories();
	const roots = (rootResp.productCategories ?? []).filter((r) => r.id);
	const nodes = await Promise.all(
		roots.map(async (root) => {
			const childResp = await getProductCategories(root.id!);
			const children = (childResp.productCategories ?? [])
				.filter((c) => c.id)
				.map((c) => ({ id: c.id!, name: categoryName(c), children: [] }));
			return { id: root.id!, name: categoryName(root), children };
		}),
	);
	return nodes;
}

export interface ProductSearchParams {
	searchTerm?: string;
	categoryId?: string;
	page?: number;
	pageSize?: number;
	refinements?: ReadonlyArray<{ nameOrId: string; values: readonly string[] }>;
}

export async function searchProducts(
	params: ProductSearchParams,
): Promise<ProductSearchResponse> {
	// Endpoint requires at least one of searchTerm/categoryId — without it the
	// server returns INVALID_API_INPUT "Something's not right with your
	// categoryId…", which actually means "no search scope".
	const body: Record<string, unknown> = {
		page: params.page ?? 0,
		pageSize: params.pageSize ?? 20,
		includePrices: true,
		fields: ["Name", "Description", "StockKeepingUnit"],
	};
	if (params.searchTerm && params.searchTerm.trim() !== "") {
		body.searchTerm = params.searchTerm.trim();
	}
	if (params.categoryId) {
		body.categoryId = params.categoryId;
	}
	if (params.refinements && params.refinements.length > 0) {
		body.refinements = params.refinements.map((r) => ({
			nameOrId: r.nameOrId,
			values: r.values,
		}));
	}
	const url = `${base()}/search/product-search` + qs({ language: "en-US" });
	const res = await sdkFetch(url, {
		method: "POST",
		body: JSON.stringify(body),
	});
	return parse<ProductSearchResponse>(res, "Failed to search products");
}

export async function getProduct(productId: string): Promise<ProductDetail> {
	const url =
		`${base()}/products/${encodeURIComponent(productId)}` +
		qs({ language: "en-US", asGuest: false, htmlEncode: false });
	const res = await sdkFetch(url);
	return parse<ProductDetail>(res, "Failed to load product");
}

export async function getProductPrice(productId: string): Promise<ProductPrice> {
	const url = `${base()}/pricing/products/${encodeURIComponent(productId)}`;
	const res = await sdkFetch(url);
	if (res.status === 403 || res.status === 404) {
		return {
			productId,
			error: { message: "Pricing unavailable", type: String(res.status) },
		};
	}
	return parse<ProductPrice>(res, "Failed to load price");
}
