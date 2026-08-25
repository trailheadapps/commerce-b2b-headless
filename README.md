# Commerce B2B Headless

A reference React storefront for Salesforce B2B Commerce, built as a headless Multi-framework React UI Bundle. Authenticated buyer flows (PLP, PDP, cart, checkout, orders) backed by the standard Commerce Connect REST APIs, served from the Experience Cloud Site Container.

This repo is a **reference implementation only**. It is published so that Salesforce partners and developers can read and learn from the code. Do not clone or deploy this directly — it contains org-specific configuration and is not designed for direct use. See [What you must change before deploying](#what-you-must-change-before-deploying) if you are adapting it.

> **Status:** Beta. The Multi-framework React platform is targeting GA in ~July 2026. Expect platform-side feature gaps until then; this app is built against `262.6+`.

> ⚠️ **Before deploying to production, review every setting in this repo's metadata.**
> This is a demo/reference org's configuration. Some settings were enabled for
> convenience in a sandbox and are **not appropriate for a production B2B store** —
> for example, `<enableGuestChatter>true</enableGuestChatter>` in
> `force-app/main/default/networks/commerceb2bheadless.network-meta.xml` exposes
> Chatter to guest users, which you almost certainly do not want. Do **not** deploy
> any metadata here to a production environment until you have read each setting
> and confirmed it matches your org's security and business requirements. See
> [Review all org, site & network settings](#5-review-all-org-site--network-settings-before-production).

---

## Table of contents

1. [What this is](#what-this-is)
2. [User flow: login → checkout](#user-flow-login--checkout)
3. [Salesforce APIs called](#salesforce-apis-called)
4. [Project layout](#project-layout)
5. [What you must change before deploying](#what-you-must-change-before-deploying)
   - [⚠️ Review all org, site & network settings before production](#5-review-all-org-site--network-settings-before-production)
6. [Deploy to your org](#deploy-to-your-org)
7. [Troubleshooting](#troubleshooting)

---

## What this is

| | |
|---|---|
| **Type** | Salesforce DX project |
| **Main payload** | One `UIBundle` metadata component (`commerceb2bheadless`) — a React 19 + Vite + TypeScript app |
| **Auth** | 6 `ApexClass` REST endpoints (`UIBundleLogin`, `UIBundleRegistration`, `UIBundleLogout`, `UIBundleForgotPassword`, `UIBundleChangePassword`, `UIBundleAuthUtils`) |
| **Site** | One `Network` + `Site` + `digitalExperiences` site definition that hosts the bundle |
| **Permission set** | `UIBundleApexAccess` — grants the site's guest user access to the auth Apex classes |
| **Profile** | `B2B Buyer Profile` — applied to authenticated buyers |
| **NOT a package** | No `0Ho...` package id, no namespace. Source-format metadata you deploy directly into your org with `sf project deploy start`. |

The React app is served at `https://<your-domain>/<site-prefix>/` and calls the platform from `/sf/api/services/data/v67.0/commerce/...` URLs, which the Site Container forwards to the Commerce Connect servlets.

---

## User flow: login → checkout

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   /login    │ →  │ /            │ →  │ /category/.. │ →  │ /product/..  │ →  │  /cart       │
│ Apex login  │    │ Storefront   │    │ Search +     │    │ PDP +        │    │ Cart-items + │
│ → frontdoor │    │ Categories + │    │ Promo eval   │    │ Promo eval   │    │ Promotions + │
│             │    │ Featured     │    │ + Facets     │    │ + Add to cart│    │ Coupons      │
└─────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                                       ↓
                                                ┌──────────────────────────────┐  ┌──────────────┐
                                                │ /order/<orderId>             │ ←│ /checkout    │
                                                │ Order summary lookup +       │  │ Address +    │
                                                │ adjustments[] per promo      │  │ Shipping +   │
                                                └──────────────────────────────┘  │ Payment +    │
                                                                                  │ Submit order │
                                                                                  └──────────────┘
```

**Step-by-step:**

1. **Login** (`/login`) — Buyer submits credentials to `POST /services/apexrest/auth/login` (`UIBundleLogin.cls`). Apex calls `Site.login()`, returns a `frontdoor.jsp` URL with a fresh session id. Browser hard-navigates to that URL; the platform sets the `sid` cookie.
2. **Storefront** (`/`) — Loads category menu via `/category-menu-items`, hydrates the cart badge from `/carts/compact-summary`.
3. **Category / search** (`/category/:id`) — Calls `/search/product-search` with the category id and refinements; calls `/promotions/actions/evaluate-products` in parallel to overlay promo prices on cards.
4. **Product detail** (`/product/:id`) — `/products/{id}` for content, `/pricing/products/{id}` for the buyer-specific price, `/promotions/actions/evaluate-products` for the promotional price + Save X% badge. "Add to cart" hits `/carts/current/cart-items`.
5. **Cart** (`/cart`) — Reads `/carts/current/cart-items?includePromotions=true&includeCoupons=true`. Displays line items, per-promotion rows (one row per active promo), applied coupon chips, approaching-discount hints. Coupons apply via `/carts/current/cart-coupons`.
6. **Checkout** (`/checkout`) — Three-step stepper (address, shipping, payment) backed by `/checkouts/active`. Order placement hits `/checkouts/active/orders/actions`.
7. **Order confirmation** (`/order/:id`) — `/order-summaries/actions/lookup` returns the placed order with its `adjustments[]` array, rendered as one named row per promotion.

---

## Salesforce APIs called

All requests go through `@salesforce/sdk-data`'s `sdk.fetch`, which attaches the buyer's session cookie + CSRF token automatically. URLs are `/services/data/v67.0/commerce/...` for everything except auth.

### Auth (Apex REST, same-site)

| Method | Path | Apex |
|---|---|---|
| POST | `/services/apexrest/auth/login` | `UIBundleLogin.cls` |
| POST | `/services/apexrest/auth/register` | `UIBundleRegistration.cls` |
| POST | `/services/apexrest/auth/logout` | `UIBundleLogout.cls` |
| POST | `/services/apexrest/auth/forgot-password` | `UIBundleForgotPassword.cls` |
| POST | `/services/apexrest/auth/change-password` | `UIBundleChangePassword.cls` |

### Catalog

| Method | Path | Where |
|---|---|---|
| GET | `/category-menu-items` | Storefront, header nav |
| POST | `/search/product-search` | Category page |
| GET | `/products/{id}` | PDP |
| GET | `/pricing/products/{id}` | PDP price |

### Cart

| Method | Path | Where |
|---|---|---|
| GET | `/carts/compact-summary` | Header badge |
| GET | `/carts/current` | Header badge fallback |
| GET | `/carts/current/cart-items?includePromotions=true&includeCoupons=true` | Cart page |
| POST | `/carts/current/cart-items` | "Add to cart" |
| PATCH | `/carts/current/cart-items/{id}` | Quantity change |
| DELETE | `/carts/current/cart-items/{id}` | Remove line |
| POST | `/carts/current/cart-coupons` | Apply coupon |
| DELETE | `/carts/current/cart-coupons/{cartCouponId}` | Remove coupon |

### Promotions

| Method | Path | Where |
|---|---|---|
| POST | `/commerce/promotions/actions/evaluate-products` | PLP cards + PDP price block |

> ℹ️ The dry-run `/commerce/promotions/actions/evaluate` endpoint is **not** used. Coupon persistence goes through `/cart-coupons`; the cart-items GET surfaces the resulting promotion list.

### Checkout

| Method | Path |
|---|---|
| GET | `/checkouts/active` |
| POST | `/checkouts/active` |
| PATCH | `/checkouts/active` |
| POST | `/checkouts/active/payments` |
| POST | `/checkouts/active/orders/actions` (place order) |

### Orders

| Method | Path | Where |
|---|---|---|
| GET | `/order-summaries` | Order history |
| POST | `/order-summaries/actions/lookup` | Order confirmation, order detail |

### Addresses & profile

| Method | Path |
|---|---|
| GET / POST / DELETE | `/accounts/{accountId}/addresses` |
| GET | User profile via Apex |

---

## Project layout

```
commerce-b2b-headless/
├── README.md
├── sfdx-project.json
├── package.json                          # root scripts: sf-project-setup, setup
├── scripts/
│   ├── org-setup.mjs                     # one-command deploy + permset assign + dev
│   └── sf-project-setup.mjs
└── force-app/main/default/
    ├── classes/                          # 6 Apex REST classes (UIBundleLogin, etc.)
    ├── permissionsets/
    │   └── UIBundleApexAccess.permissionset-meta.xml
    ├── profiles/
    │   └── B2B Buyer Profile.profile-meta.xml
    ├── networks/                         # Experience Cloud network definition
    ├── sites/                            # Salesforce Site metadata
    ├── digitalExperiences/               # Site branding & config
    └── uiBundles/
        └── commerceb2bheadless/          # The React app
            ├── package.json              # Vite + React 19 + Tailwind + shadcn
            ├── vite.config.ts
            └── src/
                ├── api/                  # 1 file per Connect API resource
                │   ├── http.ts           # base() / promotionsBase() / sdkFetch()
                │   ├── auth.ts           # /services/apexrest/auth/*
                │   ├── catalog.ts        # search, products, pricing, categories
                │   ├── cart.ts           # cart-items, cart-coupons
                │   ├── promotions.ts     # evaluate-products
                │   ├── checkout.ts       # /checkouts/active/*
                │   ├── orders.ts         # /order-summaries/*
                │   ├── addresses.ts      # /accounts/{id}/addresses
                │   └── types.ts          # all wire-shape types + normalisers
                ├── config/
                │   ├── commerce.ts       # ⚠ WEBSTORE_ID + API_VERSION (see below)
                │   └── auth.ts           # route paths
                ├── context/              # AuthContext, CartContext
                ├── hooks/                # useProduct, useCart, useCoupons, etc.
                ├── components/           # cart/, catalog/, checkout/, auth/, ui/
                └── pages/                # auth/, commerce/
```

---

## What you must change before deploying

There are **four values** in the repo that are environment-specific and must be set to point at *your* org's data. They ship as `<…_Placeholder>` strings — the app will throw at runtime if you don't replace them. Beyond those, item **5** is a mandatory review step: the site, network, and profile metadata captured here reflect a *demo* org and must be vetted against your own org's policies before any production deploy.

### 1. Webstore id — `src/config/commerce.ts`

```ts
export const COMMERCE = {
  // TODO: replace with your B2B Commerce WebStore Id (starts with 0ZE).
  WEBSTORE_ID: "<Webstore_Id_Placeholder>",
  API_VERSION: "v67.0",                // change only if your org runs a different API version
} as const;
```

Find your webstore id in the target org:

```bash
sf data query --target-org <alias> --query "SELECT Id, Name, Type FROM WebStore WHERE Type = 'B2B'"
```

Copy the 18-character `Id` (starts with `0ZE`) into `WEBSTORE_ID`.

### 2. Default buyer group id — `force-app/main/default/classes/UIBundleRegistration.cls`

`UIBundleRegistration.cls` enrolls every newly self-registered buyer into one BuyerGroup so the WebStore entitlement applies. Replace the placeholder before deploying:

```apex
// TODO: replace <Buyer_Group_Id_Placeholder> with your 18-char BuyerGroup
// Id (starts with `0ZI`) before deploying.
private static final String DEFAULT_BUYER_GROUP_ID = '<Buyer_Group_Id_Placeholder>';
```

Find the BuyerGroup id that owns your storefront's buyers:

```bash
sf data query --target-org <alias> --query "SELECT Id, Name FROM BuyerGroup"
```

If you don't replace this, registration succeeds but the new buyer is left without store access, and their first commerce API call returns `INSUFFICIENT_ACCESS`.

### 3. Buyer permission set group — `force-app/main/default/classes/UIBundleRegistration.cls`

`UIBundleRegistration.cls` grants every newly self-registered buyer a Permission Set Group so they inherit the store's commerce entitlement (cart, checkout, order placement). This must match the PSG your store assigns to buyers. Replace the placeholder before deploying:

```apex
// TODO: replace <Buyer_permission_set_group> with your store's buyer PSG
// DeveloperName before deploying.
private static final String BUYER_PERMISSION_SET_GROUP = '<Buyer_permission_set_group>';
```

Find the right name in the Commerce App: open your store → **Buyer Access** → **Self-Registration**, and copy the permission set group configured there. To list available groups in the org:

```bash
sf data query --target-org <alias> --query "SELECT Id, DeveloperName, MasterLabel FROM PermissionSetGroup"
```

If you don't replace this (or the named group doesn't exist), registration still succeeds, but the new buyer lacks full commerce entitlement: their cart may wedge in `Processing`, `compact-summary` can 500, and **order placement fails with `INSUFFICIENT_ACCESS`** ("We cannot complete this request due to an administration issue").

### 4. Vite plugin org alias — `vite.config.ts` (optional)

The `@salesforce/vite-plugin-ui-bundle` reads your org's API version at build time to keep the SDK's CSRF endpoint in sync with the org. By default it uses your `sf` default-org. If you have multiple orgs configured, pass an explicit alias:

```ts
salesforce({ orgAlias: 'my-demo-org' }),
```

If you skip this and the plugin can't resolve an org, it falls back to `65.0`, which mismatches a 264 org and causes CSRF calls to hit `v65.0/ui-api/session/csrf`. Symptom: every authenticated request 401s.

### 5. Review all org, site & network settings before production

> ⚠️ **This is a hard requirement, not a suggestion.** The metadata in this repo was captured from a *demo / sandbox* org. Several Experience Cloud, network, site, profile, and permission settings were turned on for demo convenience and **may not be appropriate — or safe — for a production B2B storefront.** Treat every setting as something to verify, not inherit.

The most important one to check, and the reason this section exists:

```xml
<!-- force-app/main/default/networks/commerceb2bheadless.network-meta.xml -->
<enableGuestChatter>true</enableGuestChatter>
```

In a B2B context this is almost always **unintentional** — it exposes Chatter to unauthenticated guest users. Set it to `false` unless you have a deliberate reason to allow it.

Before deploying to any production org, open each of these files and confirm **every** flag matches your org's security and business requirements:

| File | What to scrutinise |
|---|---|
| `networks/commerceb2bheadless.network-meta.xml` | `enableGuestChatter`, `enableGuestFileAccess`, `enableGuestMemberVisibility`, `enableDirectMessages`, `selfRegistration`, `selfRegProfile`, and the other `enable*` community flags |
| `sites/commerceb2bheadless.site-meta.xml` | Guest user access, active status, clickjack/redirect protection, URL prefix |
| `profiles/B2B Buyer Profile.profile-meta.xml` | Object/field permissions, tab visibility, and any broad access granted to buyers |
| `permissionsets/UIBundleApexAccess.permissionset-meta.xml` | Which Apex classes the **guest** user can execute |
| `digitalExperiences/` & `digitalExperienceConfigs/` | Site branding, public/private page exposure, and any embedded credentials or endpoints |

Salesforce ships secure-by-default settings for new orgs; this repo intentionally carries a working demo configuration so the storefront runs end-to-end out of the box. That trade-off means **you own the review**. When in doubt, compare against a freshly provisioned org and only deploy the settings you understand and need.

### Things you do NOT need to change

- **API version** is shared between the app's `COMMERCE.API_VERSION` and the SDK's CSRF endpoint. Both default to `v67.0` (works against `262.6+`).
- **Site URL prefix** (`commerceb2bheadlessvforcesite`) is set in `force-app/main/default/sites/commerceb2bheadless.site-meta.xml` and works as-is. Rename only if you want a custom URL.
- **Apex class names** are referenced by both the React app and the permission set; renaming requires updating both, so leave them.

---

## Deploy to your org

Prereqs: Node 22+, `sf` CLI 2.130+, an org with B2B Commerce + Multi-framework React enabled (262.6+). You will need your org's My Domain login URL (e.g. `https://mycompany.my.salesforce.com`) to authenticate.

```bash
git clone https://github.com/salesforce-misc/commerce-b2b-headless.git
cd commerce-b2b-headless

# 1. Authenticate (skip if you already have a default org)
#    Use your org's My Domain login URL as the instance URL
sf org login web --alias my-demo-org --set-default --instance-url https://<my-domain>.my.salesforce.com

# 2. Update the webstore id
#    Edit force-app/main/default/uiBundles/commerceb2bheadless/src/config/commerce.ts

# 3. Install dependencies (root + UI bundle)
npm install
cd force-app/main/default/uiBundles/commerceb2bheadless && npm install && cd -

# 4. Build the React app (produces dist/ that gets deployed)
npm run build

# 5. Deploy everything (Apex + UIBundle + Site + Network + permset + profile)
cd -
sf project deploy start --source-dir force-app --target-org my-demo-org

# 6. Find the site's guest user
sf data query --target-org my-demo-org \
  --query "SELECT Id, Name, GuestUserId FROM Site WHERE Name = 'commerceb2bheadless'"

# 7. Assign UIBundleApexAccess to the guest user (so unauthenticated /login works)
sf data create record --target-org my-demo-org \
  --sobject PermissionSetAssignment \
  --values "AssigneeId=<GuestUserId> PermissionSetId=<PermissionSetId>"

# (PermissionSetId: SELECT Id FROM PermissionSet WHERE Name = 'UIBundleApexAccess')
```

### Deploy a subset

```bash
# UI bundle only (after a code change)
sf project deploy start --source-dir force-app/main/default/uiBundles --target-org <alias>

# Apex auth classes only
sf project deploy start --source-dir force-app/main/default/classes --target-org <alias>

# Experience site only
sf project deploy start \
  --source-dir force-app/main/default/digitalExperienceConfigs \
  --source-dir force-app/main/default/digitalExperiences \
  --source-dir force-app/main/default/networks \
  --source-dir force-app/main/default/sites \
  --target-org <alias>
```

---

## Troubleshooting

**Login returns 403 "You do not have access to the Apex class named: UIBundleLogin"**
The site's guest user is missing the `UIBundleApexAccess` permission set. Run:
```bash
sf data create record --target-org <alias> --sobject PermissionSetAssignment \
  --values "AssigneeId=<GuestUserId> PermissionSetId=<UIBundleApexAccessId>"
```

**`/commerce/...` requests return 404 from the Site Container**
You're on a Core version older than 262.6, before the Site Container started forwarding `/commerce` paths. Upgrade the org, or wait for the GA release.

**Webstore returns no products to the buyer**
The buyer's account isn't entitled to a price book. Confirm the buyer's Account is in a Buyer Group with active price book entries for products in the catalog.

---

## Limitations

- **Hardcoded org-specific values** — The WebStore ID (`commerce.ts`) and Buyer Group ID (`UIBundleRegistration.cls`) must be manually configured by an admin before deployment. There is no auto-discovery at this time.
- **Dual-network requirement** — The React storefront should be the only active store running on a single Network. Currently it requires its own Network separate from the legacy LWR Commerce store Network, so both coexist in the org. This will be consolidated in a future release.
