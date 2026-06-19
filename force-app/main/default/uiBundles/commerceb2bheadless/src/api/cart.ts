// Cart Connect API: summary, items CRUD, coupon apply/remove.
import type {
	CartCouponCollectionResponse,
	CartItem,
	CartItemResponse,
	CartItemsResponse,
	CartSummary,
} from "@/api/types";
import { base, parse, qs, sdkFetch } from "@/api/http";

export async function getCartSummary(): Promise<CartSummary> {
	// `/carts/compact-summary` is the lightweight endpoint for the nav badge,
	// but it can 500 on some org configurations (e.g. v67 + fast cart
	// processing). `/carts/current` returns the same CartSummary shape and is
	// the documented fallback, so degrade to it rather than failing the badge.
	const url = `${base()}/carts/compact-summary` + qs({ language: "en-US" });
	const res = await sdkFetch(url);
	if (!res.ok) return getActiveCart();
	return parse<CartSummary>(res, "Failed to load cart summary");
}

export async function getActiveCart(): Promise<CartSummary> {
	const url = `${base()}/carts/current` + qs({ language: "en-US" });
	const res = await sdkFetch(url);
	return parse<CartSummary>(res, "Failed to load cart");
}

// Max polls and delay between them while the cart recalculates. Adding /
// updating an item triggers an async pricing + promotion recalculation; until
// it settles the cart-items GET either 422s or returns an empty cartItems[]
// with cartSummary.asyncOperationStatus = "Processing". ~10 polls × 600ms
// (~6s) comfortably covers the recalc on a catalog with active promotions.
const CART_RECALC_MAX_POLLS = 10;
const CART_RECALC_POLL_DELAY_MS = 600;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// True while the server is still recalculating the cart. We treat anything
// that isn't an explicit terminal state as "still settling" only when the cart
// also reports items pending (totalProductCount > 0 but no line items yet), so
// a genuinely empty cart returns immediately.
function isCartRecalculating(resp: CartItemsResponse): boolean {
	const status = resp.cartSummary?.asyncOperationStatus;
	if (!status) return false;
	const settled = status === "Completed" || status === "Failed" || status === "NotStarted";
	if (settled) return false;
	// status is "Processing" (or similar). Only keep polling if the summary
	// says there should be items we haven't received yet — avoids a needless
	// wait on a truly empty cart.
	const expected = Number(resp.cartSummary?.totalProductCount ?? 0);
	const received = (resp.cartItems ?? resp.items ?? []).length;
	return expected > 0 && received === 0;
}

export async function getCartItems(): Promise<CartItemsResponse> {
	// `productFields=*` hydrates productDetails (name, SKU, images) on each
	// item — without it the response only carries ids/prices and the cart UI
	// renders bare product ids.
	const url =
		`${base()}/carts/current/cart-items` +
		qs({
			includePromotions: true,
			includeCoupons: true,
			sort: "CreatedDateDesc",
			productFields: "*",
			pageNumber: 1,
			pageSize: 50,
			language: "en-US",
			asGuest: false,
			htmlEncode: false,
		});

	// Poll while the cart is mid-recalculation. The server returns 422
	// Unprocessable Content if hit before the async pricing/promotion job
	// finishes, and a 200 with an empty cartItems[] + asyncOperationStatus
	// "Processing" if hit during it. Both mean "retry shortly".
	let last: CartItemsResponse | null = null;
	for (let attempt = 0; attempt < CART_RECALC_MAX_POLLS; attempt++) {
		const res = await sdkFetch(url);

		// 422 == cart still recalculating; back off and retry rather than surface
		// it as a hard error.
		if (res.status === 422) {
			await delay(CART_RECALC_POLL_DELAY_MS);
			continue;
		}

		last = await parse<CartItemsResponse>(res, "Failed to load cart items");
		if (!isCartRecalculating(last)) return last;
		await delay(CART_RECALC_POLL_DELAY_MS);
	}

	// Polling exhausted. Return the most recent payload if we got one so the UI
	// shows the latest known totals; otherwise the recalc never settled.
	if (last) return last;
	throw new Error(
		"Failed to load cart items (still recalculating): the cart did not finish updating in time. Please try again.",
	);
}

export async function addToCart(
	productId: string,
	quantity = 1,
): Promise<CartItemResponse> {
	const url =
		`${base()}/carts/current/cart-items` +
		qs({ includeCartData: true, language: "en-US" });
	const res = await sdkFetch(url, {
		method: "POST",
		body: JSON.stringify({ productId, quantity, type: "Product" }),
	});
	return parse<CartItemResponse>(res, "Failed to add item to cart");
}

export async function updateCartItem(
	cartItemId: string,
	quantity: number,
): Promise<CartItem> {
	const url =
		`${base()}/carts/current/cart-items/${encodeURIComponent(cartItemId)}` +
		qs({ language: "en-US" });
	const res = await sdkFetch(url, {
		method: "PATCH",
		body: JSON.stringify({ quantity }),
	});
	return parse<CartItem>(res, "Failed to update cart item");
}

export async function removeCartItem(cartItemId: string): Promise<void> {
	const url = `${base()}/carts/current/cart-items/${encodeURIComponent(cartItemId)}`;
	const res = await sdkFetch(url, { method: "DELETE" });
	if (!res.ok && res.status !== 204) {
		await parse<unknown>(res, "Failed to remove cart item");
	}
}

// Persist a coupon to the active cart. This writes a
// `WebCartAdjustmentBasis` record server-side and triggers re-evaluation, so
// the next `/cart-items?includePromotions=true` GET reflects the discount in
// `cartPromotions` and `totalPromotionalAdjustmentAmount`. (The
// `/promotions/actions/evaluate` endpoint is dry-run only and does NOT
// persist; never use it for coupon apply.)
//
//   POST /commerce/webstores/{id}/carts/current/cart-coupons
//     body: { couponCode: "FLAT10" }
//
// The response carries the `cartCouponId` (a `WebCartAdjustmentBasis` Id)
// needed to DELETE the coupon later.
export async function applyCartCoupon(
	couponCode: string,
): Promise<CartCouponCollectionResponse> {
	const url = `${base()}/carts/current/cart-coupons`;
	const res = await sdkFetch(url, {
		method: "POST",
		body: JSON.stringify({ couponCode }),
	});
	return parse<CartCouponCollectionResponse>(res, "Failed to apply coupon");
}

// Remove a coupon from the active cart. The path requires the
// `cartCouponId` (NOT the coupon code) — get it from the prior POST response
// or from `normaliseCartCoupons()` on a cart-items GET.
//
//   DELETE /commerce/webstores/{id}/carts/current/cart-coupons/{cartCouponId}
export async function removeCartCoupon(cartCouponId: string): Promise<void> {
	const url = `${base()}/carts/current/cart-coupons/${encodeURIComponent(cartCouponId)}`;
	const res = await sdkFetch(url, { method: "DELETE" });
	if (!res.ok && res.status !== 204) {
		await parse<unknown>(res, "Failed to remove coupon");
	}
}
