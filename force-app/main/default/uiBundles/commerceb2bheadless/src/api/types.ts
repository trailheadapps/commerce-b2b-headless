// Shared response types for the Salesforce B2B Commerce Connect APIs.
// Types are intentionally loose (most fields optional) because responses vary
// by org configuration, entitlement, and API version.

// Some commerce endpoints wrap field values as `{ value: "..." }` (legacy
// GraphQL-style); others return plain strings. This helper collapses both to
// a plain string so render code can stay simple. Unknown shapes → "".
export function asText(v: unknown): string {
	if (v === null || v === undefined) return "";
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	if (typeof v === "object" && v !== null && "value" in v) {
		const inner = (v as { value: unknown }).value;
		return inner === null || inner === undefined ? "" : String(inner);
	}
	return "";
}

// Shape returned by /product-categories/children. `id` is first-class —
// no URL parsing needed. `children` holds the next level of the hierarchy.
export interface CategoryNode {
	readonly id: string;
	readonly name: string;
	readonly children: readonly CategoryNode[];
}

// Raw wire shape from GET /product-categories/children.
// `name` is not projected at the top level — it lives at `fields.Name`.
// `id` is the 18-char ProductCategory ID.
export interface ProductCategoriesResponse {
	readonly productCategories?: ReadonlyArray<{
		readonly id?: string;
		readonly urlName?: string | null;
		readonly fields?: {
			readonly Name?: string | null;
			readonly Description?: string | null;
			readonly NumberOfProducts?: string | null;
			readonly IsNavigational?: string | null;
			readonly ParentCategoryId?: string | null;
			readonly [key: string]: unknown;
		};
	}>;
}

// Raw wire shape from GET /product-category-path/product-categories/{id}.
// Returns ancestry from root → leaf. `name` IS a top-level field here.
export interface ProductCategoryPathResponse {
	readonly path?: ReadonlyArray<{
		readonly id?: string;
		readonly name?: string | null;
		readonly description?: string | null;
		readonly urlName?: string | null;
	}>;
}

export interface ProductSearchFacetValue {
	readonly id?: string;
	readonly name?: string;
	readonly displayName?: string;
	readonly productCount?: number;
	readonly nameOrId?: string;
}

export interface ProductSearchFacet {
	readonly id?: string;
	readonly nameOrId?: string;
	readonly displayName?: string;
	readonly displayType?: string;
	readonly values?: readonly ProductSearchFacetValue[];
}

export interface ProductSearchItem {
	readonly id: string;
	readonly name?: string;
	readonly fields?: Record<string, unknown>;
	readonly defaultImage?: { url?: string; alternateText?: string | null };
	readonly prices?: {
		listPrice?: string;
		unitPrice?: string;
		currencyIsoCode?: string;
	};
}

export interface ProductSearchResponse {
	readonly productsPage?: {
		total?: number;
		pageSize?: number;
		currentPage?: number;
		products?: readonly ProductSearchItem[];
	};
	readonly facets?: readonly ProductSearchFacet[];
	readonly categories?: unknown;
}

export interface ProductDetail {
	readonly id: string;
	readonly name?: string;
	readonly fields?: Record<string, unknown>;
	readonly defaultImage?: { url?: string; alternateText?: string | null };
	readonly mediaGroups?: ReadonlyArray<{
		developerName?: string;
		usageType?: string;
		mediaItems?: ReadonlyArray<{
			url?: string;
			alternateText?: string | null;
			mediaType?: string;
			sortOrder?: number;
		}>;
	}>;
	readonly productClass?: string;
}

export interface ProductPrice {
	readonly productId?: string;
	readonly listPrice?: string;
	readonly unitPrice?: string;
	readonly currencyIsoCode?: string;
	readonly pricebookEntryId?: string;
	readonly error?: { message?: string; type?: string };
}

export interface CartItem {
	readonly cartItemId: string;
	readonly productId?: string;
	readonly quantity?: string;
	readonly listPrice?: string;
	readonly salesPrice?: string;
	readonly totalListPrice?: string;
	readonly totalPrice?: string;
	readonly totalLineAmount?: string;
	readonly currencyIsoCode?: string;
	readonly name?: string;
	// Promotion adjustment summaries surfaced when /cart-items is called with
	// `includePromotions=true`. Negative values; `totalAdjustmentAmount` is the
	// total discount applied to this line.
	readonly totalAdjustmentAmount?: string;
	readonly unitAdjustmentAmount?: string;
	readonly unitAdjustedPrice?: string;
	readonly unitItemAdjustmentAmount?: string;
	readonly unitAdjustedPriceWithItemAdj?: string;
	// Populated for bonus-product line items.
	readonly promotionDisplayName?: string;
	// Some orgs return product details under `productDetails`, others under
	// `product`, and some nest fields under a `fields` map. Consumers should
	// use `cartItemName()` / `cartItemImage()` to handle the variants.
	readonly productDetails?: {
		name?: unknown;
		fields?: Record<string, unknown>;
		thumbnailImage?: { url?: string; alternateText?: string | null };
	};
	readonly product?: {
		id?: string;
		fields?: Record<string, unknown>;
		media?: { url?: string; alternateText?: string | null };
	};
}

// Extract the best display name for a cart line item, checking the
// productDetails.name, productDetails.fields.Name (plain or wrapped), and the
// richer `product.fields.Name` shape from other API variants.
export function cartItemName(item: CartItem): string {
	const pd = item.productDetails;
	if (pd?.name) {
		const asString = asText(pd.name);
		if (asString) return asString;
	}
	const pdName = pd?.fields?.Name;
	const pdText = asText(pdName);
	if (pdText) return pdText;
	const prodName = item.product?.fields?.Name;
	const prodText = asText(prodName);
	if (prodText) return prodText;
	if (item.name) return asText(item.name);
	return "";
}

// Best-effort thumbnail URL for the line item.
export function cartItemImage(item: CartItem): string | undefined {
	return (
		item.productDetails?.thumbnailImage?.url ??
		item.product?.media?.url ??
		undefined
	);
}

export interface CartItemsResponse {
	readonly cartSummary?: CartSummary;
	// Multiple wrapper shapes exist depending on API version and org config:
	//   [{ cartItem: CartItem }]  — nested wrapper (older Connect API)
	//   [ CartItem ]              — flat items
	// Consumers use `normaliseCartItems()` below.
	readonly cartItems?: ReadonlyArray<CartItem | { cartItem: CartItem }>;
	readonly items?: ReadonlyArray<CartItem | { cartItem: CartItem }>;
	// Populated when /cart-items is called with `includePromotions=true`.
	// The wire shape is double-wrapped: `cartPromotions.promotions.promotions[]`.
	// Use `normaliseCartPromotions()` below to extract the inner list.
	readonly cartPromotions?: {
		readonly promotions?:
			| readonly CartPromotion[]
			| { readonly promotions?: readonly CartPromotion[] };
	};
	// Coupons currently persisted on the cart, populated when /cart-items is
	// called with `includeCoupons=true`. Wire shape is also double-wrapped:
	// `cartCoupons.cartCoupons.coupons[]`. Use `normaliseCartCoupons()`.
	readonly cartCoupons?: {
		readonly cartCoupons?: {
			readonly coupons?: readonly CartCoupon[];
		};
		readonly cartId?: string;
		readonly ownerId?: string;
	};
	// "Spend $X more to save $Y" hints, populated alongside `cartPromotions`.
	readonly approachingDiscounts?: readonly string[];
}

// One row in the cart-level promotions list, returned by the cart-items GET
// when `includePromotions=true`. Auto-applied promotions have `couponCode`
// undefined; manual ones echo back the redeemed code.
export interface CartPromotion {
	readonly promotionId?: string;
	readonly displayName?: string;
	readonly termsAndConditions?: string;
	readonly adjustmentAmount?: string;
	readonly couponCode?: string;
	readonly targetType?: string;
	readonly currencyIsoCode?: string;
}

// One redeemed coupon on the cart. `cartCouponId` is the WebCartAdjustmentBasis
// record id — it's what DELETE expects, not the coupon code itself.
export interface CartCoupon {
	readonly cartCouponId: string;
	readonly couponCode: string;
}

// Both `cartPromotions.promotions` and `cartCoupons.cartCoupons.coupons` come
// back double-wrapped. These helpers flatten the shape for consumers.
export function normaliseCartPromotions(
	resp: CartItemsResponse | null | undefined,
): readonly CartPromotion[] {
	const inner = resp?.cartPromotions?.promotions;
	if (!inner) return [];
	if (Array.isArray(inner)) return inner as readonly CartPromotion[];
	const wrapped = (inner as { promotions?: readonly CartPromotion[] }).promotions;
	return wrapped ?? [];
}

export function normaliseCartCoupons(
	resp: CartItemsResponse | null | undefined,
): readonly CartCoupon[] {
	return resp?.cartCoupons?.cartCoupons?.coupons ?? [];
}

// Response of POST /carts/{id}/cart-coupons. `cartCouponId` from each entry is
// the id needed to DELETE the coupon.
export interface CartCouponCollectionResponse {
	readonly cartId?: string;
	readonly ownerId?: string;
	readonly cartStatus?: string;
	readonly cartCoupons?: {
		readonly coupons?: readonly CartCoupon[];
	};
}

export function normaliseCartItems(
	resp: CartItemsResponse | null | undefined,
): readonly CartItem[] {
	const raw = resp?.cartItems ?? resp?.items ?? [];
	return raw.map((entry) => {
		if (entry && typeof entry === "object" && "cartItem" in entry) {
			return (entry as { cartItem: CartItem }).cartItem;
		}
		return entry as CartItem;
	});
}

export interface CartSummary {
	readonly cartId?: string;
	readonly totalProductCount?: string;
	readonly uniqueProductCount?: string | number;
	readonly grandTotalAmount?: string;
	// Sum of cart items at sales price BEFORE any promotions or shipping.
	// This is the right "subtotal" to display in cart/checkout summaries.
	readonly totalProductAmount?: string;
	// Same products, but minus item-level adjustments. Useful when promos
	// target individual lines rather than the cart total.
	readonly totalProductAmountAfterAdjustments?: string;
	// Cart-level promotion adjustment (negative number). Use this for the
	// single "Promotions" row in the order summary.
	readonly totalCartLevelAdjustmentAmount?: string;
	// Sum of all promotional adjustments (cart + item level). Negative.
	readonly totalPromotionalAdjustmentAmount?: string;
	// Shipping + other non-product charges. NOT a product subtotal.
	readonly totalChargeAmount?: string;
	readonly totalTaxAmount?: string;
	readonly currencyIsoCode?: string;
	readonly status?: string;
	// "Processing" while the server is asynchronously recalculating pricing +
	// promotions after a cart mutation. During this window the cart-items GET
	// 422s or returns an empty cartItems[]; callers must poll until it settles
	// (e.g. "Completed"). See getCartItems() in api/cart.ts.
	readonly asyncOperationStatus?: string;
}

export interface CartItemResponse {
	readonly cartItem?: CartItem;
	readonly cartSummary?: CartSummary;
}

export interface CheckoutAddress {
	readonly firstName?: string;
	readonly lastName?: string;
	readonly street?: string;
	readonly city?: string;
	readonly region?: string;
	readonly postalCode?: string;
	readonly country?: string;
	readonly companyName?: string;
}

// Address book record returned by
// /commerce/webstores/{id}/accounts/{accountId}/addresses.
// `street` can contain newlines (multi-line address lines from the UI).
export interface SavedAddress {
	readonly addressId: string;
	readonly addressType?: "Shipping" | "Billing" | string;
	readonly name?: string;
	readonly firstName?: string;
	readonly lastName?: string;
	readonly companyName?: string;
	readonly street?: string;
	readonly city?: string;
	readonly region?: string;
	readonly postalCode?: string;
	readonly country?: string;
	readonly isDefault?: boolean;
}

export interface SavedAddressesResponse {
	readonly count?: number;
	readonly items?: readonly SavedAddress[];
	readonly currentPageUrl?: string;
	readonly sortOrder?: string;
}

export interface DeliveryMethod {
	readonly id: string;
	readonly name?: string;
	readonly carrier?: string;
	readonly classOfService?: string;
	readonly shippingFee?: string;
	readonly adjustedShippingFee?: string;
	readonly totalAdjustmentAmount?: string;
	readonly currencyIsoCode?: string;
}

// Mirrors the LWR `PUT /checkouts` response. `cartSummary` carries all the
// totals; `deliveryGroups.items[]` contain the resolved address, the
// available delivery methods and a pre-selected one.
export interface CheckoutState {
	readonly checkoutId?: string;
	readonly orderReferenceNumber?: string;
	readonly cartSummary?: CartSummary;
	readonly deliveryAddress?: CheckoutAddress;
	readonly shippingAddress?: CheckoutAddress; // legacy echo, some orgs still emit this
	readonly billingAddress?: CheckoutAddress;
	readonly deliveryGroups?: {
		count?: number;
		items?: ReadonlyArray<{
			id?: string;
			deliveryAddress?: CheckoutAddress & { name?: string };
			availableDeliveryMethods?: readonly DeliveryMethod[];
			selectedDeliveryMethod?: DeliveryMethod;
			isDefault?: boolean;
			isGift?: boolean;
			name?: string;
			totalCartItemCount?: number;
			totalCartItemQuantity?: number;
		}>;
	};
	readonly errors?: ReadonlyArray<{ detail?: string; title?: string }>;
}

// The /order-summaries/actions/lookup endpoint returns fields wrapped as
//   { dataName, dataType, label, text, type }
// rather than plain strings. Use `fieldText()` to unwrap into a primitive.
export interface OrderFieldValue {
	readonly dataName?: string;
	readonly dataType?: string;
	readonly label?: string;
	readonly text?: string;
	readonly type?: string;
}

export type OrderFields = Readonly<Record<string, OrderFieldValue>>;

// Returns the `.text` value of a wrapped order field, or "" when missing.
export function fieldText(
	fields: OrderFields | undefined,
	key: string,
): string {
	const v = fields?.[key];
	return v?.text ?? "";
}

export interface OrderLineItem {
	readonly id?: string | null;
	readonly type?: string; // "Product" | "Charge"
	readonly itemClass?: string;
	readonly currencyIsoCode?: string;
	readonly fields?: OrderFields;
	readonly product?: {
		id?: string;
		fields?: OrderFields;
		media?: {
			url?: string;
			alternateText?: string;
		};
	} | null;
}

export interface OrderDeliveryGroup {
	readonly id?: string | null;
	readonly currencyIsoCode?: string;
	readonly fields?: OrderFields;
	readonly deliveryMethod?: {
		id?: string | null;
		fields?: OrderFields;
	};
	readonly lineItems?: readonly OrderLineItem[];
}

export interface OrderPayment {
	readonly fields?: OrderFields;
	readonly paymentMethod?: {
		id?: string | null;
		fields?: OrderFields;
	};
}

// Lightweight entry in the buyer's orders list. Some orgs return flat fields
// (`orderNumber`), others wrap them in a `fields` map with either the
// `{text,label,...}` shape or a plain-string map. Readers should consult
// both shapes via `orderListField()` below.
export interface OrderSummaryListItem {
	readonly orderSummaryId?: string;
	readonly id?: string;
	readonly orderNumber?: string;
	readonly orderedDate?: string;
	readonly status?: string;
	readonly currencyIsoCode?: string;
	readonly grandTotalAmount?: string | number;
	readonly totalAmount?: string | number;
	readonly totalProductCount?: number | string;
	readonly fields?: Record<string, unknown>;
}

// Reads a logical field off an order list item regardless of whether the org
// returns it flat (`orderNumber`) or wrapped inside `fields.OrderNumber`
// (as a plain string or `{text: ...}`).
export function orderListField(
	item: OrderSummaryListItem,
	key:
		| "OrderNumber"
		| "OrderedDate"
		| "Status"
		| "GrandTotalAmount"
		| "TotalAmount"
		| "CurrencyIsoCode",
): string {
	const flatKey = (
		{
			OrderNumber: "orderNumber",
			OrderedDate: "orderedDate",
			Status: "status",
			GrandTotalAmount: "grandTotalAmount",
			TotalAmount: "totalAmount",
			CurrencyIsoCode: "currencyIsoCode",
		} as const
	)[key];
	const flat = (item as Record<string, unknown>)[flatKey];
	if (flat !== undefined && flat !== null && flat !== "") return String(flat);
	const wrapped = item.fields?.[key];
	if (wrapped === undefined || wrapped === null) return "";
	if (typeof wrapped === "string" || typeof wrapped === "number") return String(wrapped);
	if (typeof wrapped === "object" && "text" in (wrapped as Record<string, unknown>)) {
		const text = (wrapped as { text?: unknown }).text;
		return text === undefined || text === null ? "" : String(text);
	}
	return "";
}

export interface OrderSummaryListResponse {
	readonly orderSummaries?: readonly OrderSummaryListItem[];
	readonly currentPageUrl?: string;
	readonly nextPageUrl?: string | null;
	readonly count?: number;
}

// One promotion / coupon adjustment on a placed order. The order-summary
// lookup returns these as a flat list at the top level (not under `fields`).
// Negative `amount`; `basisReferenceDisplayName` echoes the coupon code used.
export interface OrderAdjustment {
	readonly amount?: string;
	readonly currencyIsoCode?: string;
	readonly displayName?: string;
	readonly basisReferenceDisplayName?: string;
	readonly targetType?: string;
	readonly type?: string;
}

export interface OrderSummaryDetail {
	readonly id?: string | null;
	readonly orderNumber?: string;
	readonly status?: string | null;
	readonly currencyIsoCode?: string;
	readonly fields?: OrderFields;
	readonly deliveryGroups?: readonly OrderDeliveryGroup[];
	readonly payments?: readonly OrderPayment[];
	// Promotions applied to the order. Each entry corresponds to one
	// PriceAdjustmentCause (auto-applied promo or redeemed coupon).
	readonly adjustments?: readonly OrderAdjustment[];
	readonly owner?: {
		email?: string;
		firstName?: string;
		lastName?: string;
		userName?: string;
		phoneNumber?: string;
	};
}

// ────────────────────────────────────────────────────────────────────────────
// Taxes — response shape for
//   GET /commerce/webstores/{id}/taxes/products/{productId}
// Only used on PDP for the "+X% tax" display on Gross-tax stores.
// ────────────────────────────────────────────────────────────────────────────

// One applicable tax policy for a product. For most regions the list has a
// single entry; multi-rate jurisdictions (e.g. Japan's JCT) can return more.
export interface ProductTaxInfo {
	readonly taxRatePercentage?: string;
	readonly taxTreatmentName?: string;
	readonly taxTreatmentDescription?: string;
}

export interface ProductTaxesContainer {
	readonly taxesInfoList?: readonly ProductTaxInfo[];
	readonly success?: boolean;
	readonly error?: { errorCode?: string; message?: string } | null;
}

export interface ProductTaxResponse {
	// "Gross" — prices include tax (display "+X% tax" alongside)
	// "Net"   — prices do not include tax (PDP should NOT show this row;
	//           the cart/checkout responses already break out tax)
	readonly taxLocaleType?: "Gross" | "Net";
	// Map of productId → tax container. The endpoint always returns a
	// single product, but the response is shaped as a map for consistency
	// with the (collection-style) calculate-taxes response.
	readonly taxesInfo?: Record<string, ProductTaxesContainer>;
}

// ────────────────────────────────────────────────────────────────────────────
// Calculate-taxes — request and response shapes for
//   POST /commerce/webstores/{id}/taxes/actions/calculate-taxes
//
// Used in checkout after a shipping address is confirmed to show the buyer
// the real-time tax amount before they complete the purchase.
// ────────────────────────────────────────────────────────────────────────────

// One line item sent to the calculate-taxes endpoint. `lineId` is an
// arbitrary caller-assigned key (e.g. cartItemId) used to correlate the
// response back to the request.
export interface TaxLineItem {
	readonly lineId: string;
	readonly productId: string;
	readonly quantity: number;
	// Unit price as a string (Commerce APIs carry currency values as strings).
	readonly unitPrice: string;
	readonly currencyIsoCode?: string;
}

// A group of line items sharing the same ship-to address. Most B2B checkouts
// have a single group; split shipments would have multiple.
export interface TaxAddressGroup {
	readonly deliveryAddress: {
		readonly countryCode: string;
		readonly stateCode?: string;
		readonly postalCode?: string;
		readonly city?: string;
		readonly street?: string;
	};
	readonly lineItems: readonly TaxLineItem[];
}

export interface CalculateTaxesRequest {
	readonly cartItems: readonly TaxAddressGroup[];
	readonly effectiveAccountId?: string;
	readonly currencyIsoCode?: string;
}

// Per-line-item tax details returned by the endpoint.
export interface TaxLineItemResult {
	readonly lineId?: string;
	readonly taxAmount?: string;
	readonly adjustmentTaxAmount?: string;
	readonly taxRate?: string;
	readonly message?: string;
}

// Top-level response from POST /taxes/actions/calculate-taxes.
export interface CalculateTaxesResponse {
	// "Gross" — tax is included in price; "Net" — tax is on top.
	readonly taxLocaleType?: "Gross" | "Net";
	// Total tax across all line items in the request.
	readonly totalTaxAmount?: string;
	readonly currencyIsoCode?: string;
	// Per-line breakdown. Keyed by `lineId` from the request.
	readonly lineItemTaxes?: Record<string, TaxLineItemResult>;
	// Whether the server-side calculation succeeded.
	readonly success?: boolean;
	readonly errorMessage?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Promotions — request and response shapes for
//   POST /commerce/promotions/actions/evaluate
//   POST /commerce/promotions/actions/evaluate-products
// All bodies are flat (no wrapper key); fields match the connect API
// representations exactly. See `api/promotions.ts` for usage.
// ────────────────────────────────────────────────────────────────────────────

// Per-product input for /evaluate-products. `productId` is the Product2 id;
// `salesPrice` is sent as a string to mirror the API (which carries currency
// values as strings throughout to avoid float drift).
export interface PromotionProductInput {
	readonly productId: string;
	readonly salesPrice: string;
	readonly sku?: string;
}

// One per-promotion adjustment that applies to a product on PLP/PDP.
export interface PromotionPriceAdjustment {
	readonly promotionId?: string;
	readonly displayName?: string;
	readonly termsAndConditions?: string;
	readonly adjustmentType?: string;
	readonly adjustmentValue?: string;
	readonly adjustmentAmount?: string;
}

export interface PromotionProductEvaluationResult {
	readonly productId?: string;
	readonly sku?: string;
	readonly salesPrice?: string;
	// The post-promotion price the buyer pays. When no promotions apply,
	// `promotionalPrice` equals `salesPrice` and `promotionPriceAdjustmentList`
	// is empty.
	readonly promotionalPrice?: string;
	readonly promotionPriceAdjustmentList?: readonly PromotionPriceAdjustment[];
	readonly currencyIsoCode?: string;
	readonly isSuccess?: boolean;
	readonly errorMessage?: string;
}

export interface PromotionProductEvaluationResponse {
	readonly promotionProductEvaluationResults?: readonly PromotionProductEvaluationResult[];
}

