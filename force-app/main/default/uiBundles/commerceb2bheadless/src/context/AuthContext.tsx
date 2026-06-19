import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { getCurrentUser } from "@salesforce/ui-bundle/api";
import { createDataSDK } from "@salesforce/sdk-data";
import { API_ROUTES, ROUTES } from "@/config/auth";

interface User {
	readonly id: string;
	readonly name: string;
}

interface AuthContextType {
	user: User | null;
	isAuthenticated: boolean;
	loading: boolean;
	error: string | null;
	checkAuth: () => Promise<void>;
	logout: (retUrl?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
	children: ReactNode;
}

// Cheap session probe via cookies set by the platform on a successful login.
// `sid_Client` and `__Secure-has-sid` are both non-HttpOnly, so the browser
// exposes them to document.cookie. Their presence alone is sufficient to
// know the buyer *might* be logged in — the actual sid is HttpOnly and never
// readable from JS. If neither is present we can skip the auth probe entirely
// and treat the visitor as a guest, which avoids a 401 burst on /login,
// /register, etc.
function hasSessionCookie(): boolean {
	if (typeof document === "undefined") return false;
	return /(?:^|;\s*)(sid_Client|__Secure-has-sid)=/.test(document.cookie);
}

export function AuthProvider({ children }: AuthProviderProps) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Cached logout URL — resolved once from Apex Site.getBaseUrl(). Null until
	// the resolver returns; logout() awaits the resolver promise if a fast click
	// races mount. No hardcoded fallback because the prethis fix-less /secur/logout.jsp
	// 301-redirects to whichever Site is alphabetically first on shared orgs —
	// which can be a stranger's community.
	const logoutUrlRef = useRef<string | null>(null);
	const resolverPromiseRef = useRef<Promise<void> | null>(null);

	const checkAuth = useCallback(async () => {
		setLoading(true);
		setError(null);

		// Skip the network probe when no session cookie is present. Prevents
		// /chatter/users/me 401s on guest pages.
		if (!hasSessionCookie()) {
			setUser(null);
			setLoading(false);
			return;
		}

		try {
			const userData = await getCurrentUser();
			setUser(userData);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Authentication failed";
			setError(errorMessage);
			setUser(null);
		} finally {
			setLoading(false);
		}
	}, []);

	/**
	 * Resolve the canonical logout URL from Apex once at app boot. Throws on
	 * failure so logout() can surface a clear error rather than silently
	 * navigating to a wrong URL.
	 */
	const resolveLogoutUrl = useCallback(async () => {
		const sdk = await createDataSDK();
		const response = await sdk.fetch!(API_ROUTES.LOGOUT_URL_RESOLVER, {
			method: "GET",
			headers: { Accept: "application/json" },
		});
		if (!response.ok) {
			throw new Error(`Logout URL resolver returned ${response.status}`);
		}
		const body = (await response.json()) as { logoutUrl?: string };
		if (!body?.logoutUrl) {
			throw new Error("Logout URL resolver returned no logoutUrl");
		}
		logoutUrlRef.current = body.logoutUrl;
	}, []);

	const logout = useCallback(async (retUrl?: string) => {
		// Logout sequence:
		//   1. Clear local auth state so any pending effects don't fire
		//      against a session that's about to be invalidated.
		//   2. Wait for the boot-time resolver if it hasn't landed yet (fast-click race).
		//   3. Hard-navigate to the resolved logout URL with retUrl pointing
		//      at the SPA's /login route (prefixed with the site path so the
		//      platform redirects back into the bundle, not org root).
		setUser(null);
		setError(null);

		if (!logoutUrlRef.current && resolverPromiseRef.current) {
			try {
				await resolverPromiseRef.current;
			} catch (err) {
				console.error("Logout URL resolver failed", err);
				return;
			}
		}
		if (!logoutUrlRef.current) {
			console.error("Logout URL not resolved");
			return;
		}

		// Derive the site path prefix from the current URL. The SPA is mounted
		// under e.g. "/commerceb2bheadless", so /login alone would 404 post-logout.
		const sitePrefix = "/" + (window.location.pathname.split("/").filter(Boolean)[0] ?? "");
		const target = retUrl ?? `${sitePrefix}${ROUTES.LOGIN.PATH}`;

		const finalLogoutUrl = `${logoutUrlRef.current}?retUrl=${encodeURIComponent(target)}`;
		window.location.replace(finalLogoutUrl);
	}, []);

	useEffect(() => {
		checkAuth();
		resolverPromiseRef.current = resolveLogoutUrl();
	}, [checkAuth, resolveLogoutUrl]);

	const value: AuthContextType = {
		user,
		isAuthenticated: user !== null,
		loading,
		error,
		checkAuth,
		logout,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access the authentication context.
 * @returns {AuthContextType} Authentication state (user, isAuthenticated, loading, error, checkAuth)
 * @throws {Error} If used outside of an AuthProvider
 */
export function useAuth(): AuthContextType {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

/**
 * Returns the current authenticated user.
 * @returns {User} The authenticated user object
 * @throws {Error} If not used within AuthProvider or user is not authenticated
 */
export function useUser(): User {
	const context = useAuth();
	if (!context.user) {
		throw new Error("Authenticated context not established");
	}
	return context.user;
}
