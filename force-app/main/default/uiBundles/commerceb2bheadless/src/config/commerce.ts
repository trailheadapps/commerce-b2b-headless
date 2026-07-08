// Per-org Commerce config. Replace these values when adapting the repo to
// a different org. WEBSTORE_ID is the B2B Commerce store id (18-character,
// starts with `0ZE`); API_VERSION pins the Connect API version used in every
// URL built by `shared/http.ts:base()`.
//
// To find your WEBSTORE_ID:
//   sf data query --target-org <alias> \
//     --query "SELECT Id, Name, Type FROM WebStore WHERE Type = 'B2B'"
export const COMMERCE = {
	// TODO: replace with your B2B Commerce WebStore Id (starts with 0ZE).
	WEBSTORE_ID: "<Webstore_Id_Placeholder>",
	API_VERSION: "v67.0",
} as const;

// Client-side route paths for the commerce surface. Mirrors the auth
// `ROUTES` constant in `features/authentication/authenticationConfig.ts`.
// Use these instead of hardcoding strings — typos break navigation silently.
export const COMMERCE_ROUTES = {
	STOREFRONT: "/",
	CART: "/cart",
	CHECKOUT: "/checkout",
	ORDERS: "/orders",
	SEARCH: (term: string) => `/search?q=${encodeURIComponent(term)}`,
	ORDER: (idOrRefNumber: string) => `/order/${encodeURIComponent(idOrRefNumber)}`,
	CATEGORY: (categoryId: string) => `/category/${encodeURIComponent(categoryId)}`,
	PRODUCT: (productId: string) => `/product/${encodeURIComponent(productId)}`,
} as const;

// Query-string key the search page reads its keyword from. Kept here so the
// search bar and the results page can't drift apart.
export const SEARCH_QUERY_PARAM = "q";
