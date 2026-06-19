// Public re-exports of the commerce Connect API surface — split by domain for
// clarity but exposed flat here so callers can do `import { addToCart, getProduct }
// from "@/api"`. Auth + userProfile keep their own files since they're not
// commerce-domain calls.

export * from "./catalog";
export * from "./cart";
export * from "./checkout";
export * from "./orders";
export * from "./addresses";
export * from "./promotions";
export * from "./taxes";
