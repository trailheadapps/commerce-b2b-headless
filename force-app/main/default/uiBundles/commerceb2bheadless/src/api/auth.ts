// Same-site auth client. Calls the org's own Apex REST endpoint at
// /services/apexrest/auth/login (UIBundleLogin.cls) via the Data SDK,
// instead of proxying to a Codecept storefront's webruntime apex-execute.
//
// The Apex method wraps Site.login(), which returns a frontdoor.jsp URL
// containing the freshly minted session id. The browser hard-navigates to
// that URL so the platform sets the `sid` cookie and the buyer lands on the
// requested startUrl as an authenticated user.

import { createDataSDK } from "@salesforce/sdk-data";
import { handleApiResponse } from "@/lib/authResponseHelpers";
import type { AuthResponse } from "@/lib/authHelpers";

export interface LoginInput {
	readonly username: string;
	readonly password: string;
	readonly startUrl?: string;
}

// Submits credentials to UIBundleLogin.loginUser. On success, returns the
// frontdoor.jsp redirect URL that establishes the session.
export async function login(input: LoginInput): Promise<string> {
	const sdk = await createDataSDK();
	const response = await sdk.fetch!("/services/apexrest/auth/login", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({
			request: {
				username: input.username,
				password: input.password,
				startUrl: input.startUrl ?? "",
			},
		}),
	});

	const result = await handleApiResponse<AuthResponse>(response, "Login failed");
	if (!result?.redirectUrl) {
		throw new Error("Login failed");
	}
	return result.redirectUrl;
}

// Convenience helper: log in and hard-navigate to the redirect URL so the
// `sid` cookie attaches to subsequent page loads.
export async function loginAndRedirect(input: LoginInput): Promise<void> {
	const url = await login(input);
	window.location.replace(url);
}
