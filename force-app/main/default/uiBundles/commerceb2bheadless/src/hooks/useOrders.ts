import { listOrderSummaries } from "@/api";
import type { OrderSummaryListResponse } from "@/api/types";
import { useAsync, type UseAsyncResult } from "./useAsync";

export function useOrders(pageSize = 20): UseAsyncResult<OrderSummaryListResponse> {
	return useAsync(() => listOrderSummaries(pageSize), [pageSize]);
}
