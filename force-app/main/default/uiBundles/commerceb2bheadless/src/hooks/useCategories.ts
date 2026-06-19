import { getCategoryTree } from "@/api";
import type { CategoryNode } from "@/api/types";
import { useAsync, type UseAsyncResult } from "./useAsync";

export function useCategories(): UseAsyncResult<readonly CategoryNode[]> {
	return useAsync(() => getCategoryTree(), []);
}
