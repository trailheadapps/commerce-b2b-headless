import { getProduct, getProductPrice } from "@/api";
import type { ProductDetail, ProductPrice } from "@/api/types";
import { useAsync, type UseAsyncResult } from "./useAsync";

export function useProduct(productId: string | undefined): UseAsyncResult<ProductDetail> {
	return useAsync(async () => {
		if (!productId) throw new Error("Product id is required");
		return getProduct(productId);
	}, [productId]);
}

export function useProductPrice(productId: string | undefined): UseAsyncResult<ProductPrice> {
	return useAsync(async () => {
		if (!productId) throw new Error("Product id is required");
		return getProductPrice(productId);
	}, [productId]);
}
