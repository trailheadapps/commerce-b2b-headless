// Shared HTTP plumbing for all Salesforce B2B Commerce Connect API calls.
//
// Every commerce call goes through `@salesforce/sdk-data`'s `sdk.fetch`, which
// transparently attaches the buyer's session cookie and CSRF token. URLs are
// built from `/services/data/{apiVersion}/commerce/webstores/{webstoreId}/...`.
//
// `base()` builds the webstore-scoped prefix; `qs()` filters out empty params;
// `sdkFetch()` ensures Accept/Content-Type headers; `parse<T>()` wraps the
// response with consistent error formatting.

import { createDataSDK } from "@salesforce/sdk-data";
import { COMMERCE } from "@/config/commerce";

export function base(): string {
	return `/services/data/${COMMERCE.API_VERSION}/commerce/webstores/${COMMERCE.WEBSTORE_ID}`;
}

// Promotions Connect APIs are NOT webstore-scoped — they live at
// `/commerce/promotions/...` and accept `webStoreId` in the request body
// instead. This helper produces that prefix.
export function promotionsBase(): string {
	return `/services/data/${COMMERCE.API_VERSION}/commerce/promotions`;
}

export function qs(
	params: Record<string, string | number | boolean | undefined>,
): string {
	const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
	if (entries.length === 0) return "";
	const search = new URLSearchParams();
	for (const [k, v] of entries) search.set(k, String(v));
	return `?${search.toString()}`;
}

export async function sdkFetch(input: string, init?: RequestInit): Promise<Response> {
	const sdk = await createDataSDK();
	return sdk.fetch!(input, {
		...init,
		headers: {
			Accept: "application/json",
			...(init?.body ? { "Content-Type": "application/json" } : {}),
			...init?.headers,
		},
	});
}

export async function parse<T>(res: Response, errMsg: string): Promise<T> {
	if (res.status === 204) return {} as T;
	if (!res.ok) {
		let detail = "";
		try {
			const body = await res.json();
			detail = typeof body === "string" ? body : JSON.stringify(body);
		} catch {
			detail = await res.text().catch(() => "");
		}
		throw new Error(`${errMsg} (${res.status}): ${detail}`);
	}
	return (await res.json()) as T;
}
