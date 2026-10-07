// The active BCP-47 locale for this page load. Stable for the lifetime of the
// SPA instance — a market/locale switch is a full-page reload (see
// docs/markets-enablement-plan.md), so the value never changes mid-session.
import { useMemo } from "react";
import { getActiveLocale } from "@/lib/locale";

export function useActiveLocale(): string {
	return useMemo(() => getActiveLocale(), []);
}
