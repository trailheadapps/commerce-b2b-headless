import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COMMERCE_ROUTES, SEARCH_QUERY_PARAM } from "@/config/commerce";

export interface SearchBarProps {
	// Extra classes for the wrapping <form> so the header can size it per breakpoint.
	readonly className?: string;
	// Called after a submit navigates — used by the mobile menu to close itself.
	readonly onSubmit?: () => void;
}

// Keyword search input. Submitting navigates to /search?q=<term>; the Search
// page owns the actual product-search call. Seeds itself from the current
// `?q=` so the term stays visible while browsing results.
export default function SearchBar({ className, onSubmit }: SearchBarProps) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const urlTerm = searchParams.get(SEARCH_QUERY_PARAM) ?? "";
	const [term, setTerm] = useState(urlTerm);

	// Keep the field in sync when the URL's q changes (back/forward, or a search
	// triggered from elsewhere). Adjusting state during render — React's
	// recommended pattern for reacting to a changed prop/input — instead of an
	// effect, so the input reflects the new URL without an extra render.
	const [prevUrlTerm, setPrevUrlTerm] = useState(urlTerm);
	if (urlTerm !== prevUrlTerm) {
		setPrevUrlTerm(urlTerm);
		setTerm(urlTerm);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = term.trim();
		if (trimmed === "") return;
		navigate(COMMERCE_ROUTES.SEARCH(trimmed));
		onSubmit?.();
	}

	return (
		<form role="search" onSubmit={handleSubmit} className={className}>
			<div className="relative">
				<Search
					className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					type="search"
					name={SEARCH_QUERY_PARAM}
					value={term}
					onChange={(e) => setTerm(e.target.value)}
					placeholder="Search products"
					aria-label="Search products"
					className="pl-8"
				/>
			</div>
		</form>
	);
}
