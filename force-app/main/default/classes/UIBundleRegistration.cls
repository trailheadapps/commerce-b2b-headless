/**
 * REST endpoint for Web Applications for user self-registration.
 *
 * Endpoint: POST /services/apexrest/auth/register/
 *
 * Creates a new external user account, validates credentials against org password policy,
 * and returns a login URL for automatic session creation.
 *
 * Security: Uses 'without sharing' to allow guest users to check for duplicate usernames.
 */
@RestResource(urlMapping='/auth/register')
global without sharing class UIBundleRegistration {

    // Buyer Group every newly self-registered user should join. Centralised
    // so it's easy to find and swap when migrating to another org.
    //
    // To find your buyer group:
    //   sf data query --target-org <alias> \
    //     --query "SELECT Id, Name FROM BuyerGroup"
    //
    // TODO: replace <Buyer_Group_Id_Placeholder> with your 18-char BuyerGroup
    // Id (starts with `0ZI`) before deploying.
    private static final String DEFAULT_BUYER_GROUP_ID = '<Buyer_Group_Id_Placeholder>';

    // Permission Set Group every newly self-registered buyer is granted so
    // they inherit the store's commerce entitlement (cart, checkout, order
    // placement). This must match the PSG your store assigns to buyers — find
    // it in Commerce App → your store → Buyer Access → Self-Registration.
    // Centralised so it's easy to find and swap when migrating to another org.
    //
    // To list available permission set groups:
    //   sf data query --target-org <alias> \
    //     --query "SELECT Id, DeveloperName FROM PermissionSetGroup"
    //
    // TODO: replace <Buyer_permission_set_group> with your store's buyer PSG
    // DeveloperName before deploying.
    private static final String BUYER_PERMISSION_SET_GROUP = '<Buyer_permission_set_group>';

    /**
     * Registers a new external user, enrols them in the default buyer group,
     * and logs them in.
     * @param request The registration request containing user details.
     * @return SuccessResponse or ErrorResponse.
     */
    @HttpPost
    global static RegistrationResponse registerUser(RegistrationRequest request) {
        Savepoint sp = Database.setSavepoint();
        try {
            request.validate();

            User u = new User(
                Username = request.email,
                Email = request.email,
                FirstName = request.firstName,
                LastName = request.lastName,
                // Generate unique nickname: first initial + up to 20 chars of last name + 4 random digits
                CommunityNickname = request.firstName.left(1) + request.lastName.left(20) +
                    String.valueOf(Crypto.getRandomInteger()).left(4)
            );

            validatePassword(u, request.password);
            String accountId = createBusinessAccount(request.firstName, request.lastName);
            String userId = createUser(u, request.password, accountId);
            createBuyerAccount(accountId);

            // Add the buyer's per-user Account to the default buyer group so
            // the Codecept WebStore entitlement applies. Failure is logged but
            // doesn't block login — admins can repair manually.
            enrolBuyerGroup(userId);
            assignCommercePermissionSet(userId);

            String startUrl = UIBundleAuthUtils.getSanitizedStartUrl(request.startUrl, Site.getPathPrefix());
            PageReference pageRef = Site.login(request.email, request.password, startUrl);

            return new SuccessRegistrationResponse(pageRef?.getUrl());
        } catch (UIBundleAuthUtils.AuthException ex) {
            Database.rollback(sp);
            RestContext.response.statusCode = ex.statusCode;
            return new ErrorRegistrationResponse(ex.messages);
        } catch (Exception ex) {
            Database.rollback(sp);
            RestContext.response.statusCode = 500;
            return new ErrorRegistrationResponse(ex.getMessage());
        }
    }

    /**
     * Base response class for registration.
     */
    global abstract class RegistrationResponse {
    }

    /**
     * Success response with redirect URL.
     */
    global class SuccessRegistrationResponse extends RegistrationResponse {
        global Boolean success = true;
        global String redirectUrl;

        global SuccessRegistrationResponse(String redirectUrl) {
            this.redirectUrl = redirectUrl;
        }
    }

    /**
     * Error response with error messages.
     */
    global class ErrorRegistrationResponse extends RegistrationResponse {
        global List<String> errors;

        global ErrorRegistrationResponse(List<String> errors) {
            this.errors = new List<String>(errors);
        }

        global ErrorRegistrationResponse(String error) {
            this.errors = new List<String>{ error };
        }
    }

    /**
     * Request payload for user registration.
     */
    global class RegistrationRequest {
        global String email;
        global String firstName;
        global String lastName;
        global String password;
        global String startUrl;

        /**
         * Trims fields and validates required fields and business rules.
         * @throws UIBundleAuthUtils.AuthException if validation fails.
         */
        public void validate() {
            email = email?.trim()?.toLowerCase();
            firstName = firstName?.trim();
            lastName = lastName?.trim();
            startUrl = startUrl?.trim();

            List<String> errors = new List<String>();
            if (String.isBlank(firstName)) { errors.add('First name is required.'); }
            if (String.isBlank(lastName)) { errors.add('Last name is required.'); }
            if (String.isBlank(password)) { errors.add('Password is required.'); }
            if (!Site.isValidUserName(email)) { errors.add('Email is invalid.'); }
            else if (!isUserUnique(email)) {
                errors.add('A user with this email already exists.');
            }
            if (!errors.isEmpty()) {
                throw new UIBundleAuthUtils.AuthException(400, errors);
            }
        }
    }

    /**
     * Validates password against org password policy.
     * @param user The user record.
     * @param password The password to validate.
     * @throws UIBundleAuthUtils.AuthException if password does not meet requirements.
     */
    private static void validatePassword(User user, String password) {
        try {
            Site.validatePassword(user, password, password);
        } catch (System.SecurityException ex) {
            throw new UIBundleAuthUtils.AuthException(400, ex.getMessage());
        }
    }

    /**
     * Creates the external user account.
     * @param u The user record.
     * @param password The password for the new user.
     * @return The new user's ID.
     * @throws UIBundleAuthUtils.AuthException if user creation fails.
     */
    private static String createUser(User u, String password, String accountId) {
        String userId;
        try {
            userId = Site.createExternalUser(u, accountId, password);
        } catch (Site.ExternalUserCreateException ex) {
            throw new UIBundleAuthUtils.AuthException(500, ex.getDisplayMessages());
        }
        if (userId == null) {
            throw new UIBundleAuthUtils.AuthException(500, 'Could not register new user.');
        }
        return userId;
    }

    /**
     * Checks if a username is unique (not already taken).
     * @param username The username to check.
     * @return {@code true} if unique, {@code false} if already exists.
     */
    private static Boolean isUserUnique(String username) {
        return [SELECT Id FROM User WHERE Username = :username LIMIT 1].isEmpty();
    }

    /**
     * Adds the new user's Account to the default Buyer Group so the buyer
     * inherits WebStore entitlement (products, prices, cart).
     *
     * `commerceb2bheadless` is a Site Container, not a B2B Commerce store, so
     * the platform's "Default Buyer Group on store" auto-enrolment doesn't
     * fire. We do it ourselves here. Idempotent — skips when a member
     * already exists.
     */
    private static void enrolBuyerGroup(Id userId) {
        if (userId == null) return;
        // Use Database.insert(..., false) so any failure (CRUD, sharing,
        // duplicate) is returned as a SaveResult and never propagates up. We
        // never want a buyer-group hiccup to break registration / login.
        try {
            User newUser = [
                SELECT Id, Contact.AccountId
                FROM User
                WHERE Id = :userId
                LIMIT 1
            ];
            Id buyerAccountId = newUser.Contact?.AccountId;
            if (buyerAccountId == null) {
                System.debug('Buyer-group enrolment skipped: no Account on new user ' + userId);
                return;
            }
            List<BuyerGroupMember> existing = [
                SELECT Id FROM BuyerGroupMember
                WHERE BuyerGroupId = :DEFAULT_BUYER_GROUP_ID
                  AND BuyerId = :buyerAccountId
                LIMIT 1
            ];
            if (!existing.isEmpty()) return;

            BuyerGroupMember member = new BuyerGroupMember(
                BuyerGroupId = DEFAULT_BUYER_GROUP_ID,
                BuyerId = buyerAccountId
            );
            Database.SaveResult sr = Database.insert(member, false);
            if (!sr.isSuccess()) {
                for (Database.Error err : sr.getErrors()) {
                    System.debug('Buyer-group enrolment failure: ' + err.getStatusCode() + ' ' + err.getMessage());
                }
            }
        } catch (Exception ex) {
            System.debug('Buyer-group enrolment failed for ' + userId + ': ' + ex.getMessage());
        }
    }

    // Enqueues the buyer Permission Set Group assignment.
    private static void assignCommercePermissionSet(Id userId) {
        if (userId == null) return;
        assignPermissionSetGroupAsync(userId);
    }

    @future
    private static void assignPermissionSetGroupAsync(Id userId) {
        try {
            List<PermissionSetGroup> psg = [
                SELECT Id FROM PermissionSetGroup
                WHERE DeveloperName = :BUYER_PERMISSION_SET_GROUP
                LIMIT 1
            ];
            if (psg.isEmpty()) {
                System.debug(BUYER_PERMISSION_SET_GROUP + ' permission set group not found — skipping assignment');
                return;
            }
            List<PermissionSetAssignment> existing = [
                SELECT Id FROM PermissionSetAssignment
                WHERE AssigneeId = :userId
                  AND PermissionSetGroupId = :psg[0].Id
                LIMIT 1
            ];
            if (!existing.isEmpty()) return;

            Database.SaveResult sr = Database.insert(
                new PermissionSetAssignment(AssigneeId = userId, PermissionSetGroupId = psg[0].Id),
                false
            );
            if (!sr.isSuccess()) {
                for (Database.Error err : sr.getErrors()) {
                    System.debug(BUYER_PERMISSION_SET_GROUP + ' PSG assignment failure: ' + err.getStatusCode() + ' ' + err.getMessage());
                }
            }
        } catch (Exception ex) {
            System.debug(BUYER_PERMISSION_SET_GROUP + ' PSG assignment failed for ' + userId + ': ' + ex.getMessage());
        }
    }

    private static String createBusinessAccount(String firstName, String lastName) {
        Account account = new Account();
        account.Name = firstName + ' ' + lastName;

        Id siteAdminId = Site.getAdminId();
        if (siteAdminId != null) {
            account.OwnerId = siteAdminId;
        }

        insert account;
        return account.Id;
    }

    private static void createBuyerAccount(String accountId) {
        BuyerAccount buyerAccount = new BuyerAccount(
            BuyerId = accountId,
            Name = 'Buyer-' + accountId,
            IsActive = true
        );
        insert buyerAccount;
    }
}
