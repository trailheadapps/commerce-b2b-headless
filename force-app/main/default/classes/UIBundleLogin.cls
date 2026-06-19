/**
 * REST endpoint for Web Applications login.
 *
 * Endpoint: POST /services/apexrest/auth/login
 *
 * Wraps Site.login() so the UI Bundle can authenticate without going through
 * the Experience Cloud `webruntime/api/apex/execute` proxy. On success the
 * platform sets the sid cookie as part of the response and the redirect URL
 * is returned to the client, which hard-navigates to it.
 */
@RestResource(urlMapping='/auth/login')
global without sharing class UIBundleLogin {

    @HttpPost
    global static LoginResponse loginUser(LoginRequest request) {
        try {
            if (request == null) {
                RestContext.response.statusCode = 400;
                return new ErrorLoginResponse('Missing login payload.');
            }
            request.validate();

            String startUrl = UIBundleAuthUtils.getSanitizedStartUrl(
                request.startUrl,
                Site.getPathPrefix()
            );

            PageReference pageRef = Site.login(request.username, request.password, startUrl);
            String redirectUrl = pageRef == null ? null : pageRef.getUrl();

            if (String.isBlank(redirectUrl)) {
                RestContext.response.statusCode = 401;
                return new ErrorLoginResponse('Invalid username or password.');
            }

            return new SuccessLoginResponse(redirectUrl);
        } catch (UIBundleAuthUtils.AuthException ex) {
            RestContext.response.statusCode = ex.statusCode;
            return new ErrorLoginResponse(ex.messages);
        } catch (Site.ExternalUserCreateException ex) {
            RestContext.response.statusCode = 400;
            return new ErrorLoginResponse(ex.getDisplayMessages());
        } catch (Exception ex) {
            UIBundleAuthUtils.debugLog(ex, LoggingLevel.ERROR);
            RestContext.response.statusCode = 500;
            return new ErrorLoginResponse('Login failed.');
        }
    }

    global class LoginRequest {
        global String username;
        global String password;
        global String startUrl;

        public void validate() {
            username = username == null ? null : username.trim().toLowerCase();
            startUrl = startUrl == null ? null : startUrl.trim();

            List<String> errors = new List<String>();
            if (String.isBlank(username)) { errors.add('Username is required.'); }
            if (String.isBlank(password)) { errors.add('Password is required.'); }
            if (!errors.isEmpty()) {
                throw new UIBundleAuthUtils.AuthException(400, errors);
            }
        }
    }

    global abstract class LoginResponse {}

    global class SuccessLoginResponse extends LoginResponse {
        global Boolean success = true;
        global String redirectUrl;
        global SuccessLoginResponse(String redirectUrl) {
            this.redirectUrl = redirectUrl;
        }
    }

    global class ErrorLoginResponse extends LoginResponse {
        global Boolean success = false;
        global List<String> errors;
        global ErrorLoginResponse(String error) {
            this.errors = new List<String>{ error };
        }
        global ErrorLoginResponse(List<String> errors) {
            this.errors = new List<String>(errors);
        }
    }
}
