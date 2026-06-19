/**
 * REST endpoint for Web Applications logout-URL resolution.
 *
 * Endpoint: GET /services/apexrest/auth/logout-url
 */
@RestResource(urlMapping='/auth/logout-url')
global without sharing class UIBundleLogout {

    private static final String LOGOUT_PATH = '/secur/logout.jsp';

    /**
     * Returns the canonical logout URL for this Experience Site.
     */
    @HttpGet
    global static LogoutUrlResponse getLogoutUrl() {
        try {
            String baseUrl = Site.getBaseUrl();
            String logoutUrl = (String.isBlank(baseUrl) ? '' : baseUrl) + LOGOUT_PATH;
            return new LogoutUrlResponse(logoutUrl);
        } catch (Exception ex) {
            UIBundleAuthUtils.debugLog(ex, LoggingLevel.ERROR);
            // Return the relative path as a safe fallback — the browser will
            // resolve it against the current origin, which is the same site.
            return new LogoutUrlResponse(LOGOUT_PATH);
        }
    }

    /**
     * Response shape — mirrors the success response shape used by
     * UIBundleLogin / UIBundleRegistration so the client can treat all
     * auth endpoints uniformly.
     */
    global class LogoutUrlResponse {
        global String logoutUrl;

        global LogoutUrlResponse(String logoutUrl) {
            this.logoutUrl = logoutUrl;
        }
    }
}
