import { getOrderSummary } from "@/api";
import type { OrderSummaryDetail } from "@/api/types";
import { useAsync, type UseAsyncResult } from "./useAsync";

export function useOrder(orderId: string | undefined): UseAsyncResult<OrderSummaryDetail> {
	return useAsync(async () => {
		if (!orderId) throw new Error("Order id is required");
		return getOrderSummary(orderId);
	}, [orderId]);
}
