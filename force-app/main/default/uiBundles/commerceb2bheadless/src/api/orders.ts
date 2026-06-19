// Orders Connect API: order summaries list + lookup.
import type { OrderSummaryDetail, OrderSummaryListResponse } from "@/api/types";
import { base, parse, qs, sdkFetch } from "@/api/http";

// List the buyer's order summaries, newest first.
//   GET /commerce/webstores/{id}/order-summaries
// Field names vary by org — pass an explicit `fields` query param to force
// the server to include OrderNumber/OrderedDate/Status/totals regardless of
// the default projection.
export async function listOrderSummaries(
	pageSize = 20,
): Promise<OrderSummaryListResponse> {
	const url =
		`${base()}/order-summaries` +
		qs({
			ownerScope: "My",
			pageSize,
			fields:
				"OrderNumber,OrderedDate,Status,TotalAmount,GrandTotalAmount,CurrencyIsoCode",
			language: "en-US",
			asGuest: false,
			htmlEncode: false,
		});
	const res = await sdkFetch(url);
	if (res.status === 404 || res.status === 403) {
		return { orderSummaries: [] };
	}
	return parse<OrderSummaryListResponse>(res, "Failed to load orders");
}

// Look up an order by summary id or reference number.
//   POST /commerce/webstores/{id}/order-summaries/actions/lookup
//     body: { orderSummaryIdOrRefNumber, fields?, (guest-only: email, phone) }
export async function getOrderSummary(
	orderSummaryIdOrRefNumber: string,
): Promise<OrderSummaryDetail> {
	const url =
		`${base()}/order-summaries/actions/lookup` +
		qs({ language: "en-US", asGuest: false, htmlEncode: false });
	const res = await sdkFetch(url, {
		method: "POST",
		body: JSON.stringify({ orderSummaryIdOrRefNumber }),
	});
	return parse<OrderSummaryDetail>(res, "Failed to load order");
}
