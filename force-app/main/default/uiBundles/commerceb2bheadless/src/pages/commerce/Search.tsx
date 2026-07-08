import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import FacetPanel, { type Refinements } from "@/components/catalog/FacetPanel";
import ProductGrid from "@/components/catalog/ProductGrid";
import { useProductSearch } from "@/hooks/useProductSearch";
import { usePromotionEvaluation } from "@/hooks/usePromotionEvaluation";
import type { PromotionProductInput } from "@/api/types";
import { SEARCH_QUERY_PARAM } from "@/config/commerce";

const PAGE_SIZE = 12;

// Keyword search results page. Reads the term from `?q=` and scopes the
// product-search by `searchTerm`. Structurally mirrors the Category PLP —
// facet sidebar, promo overlays, pagination — but scoped by keyword instead
// of categoryId.
export default function SearchPage() {
	const [searchParams] = useSearchParams();
	const term = (searchParams.get(SEARCH_QUERY_PARAM) ?? "").trim();

	const [page, setPage] = useState(0);
	const [refinements, setRefinements] = useState<Refinements>({});

	// Reset paging + facets whenever the query changes so a new search starts
	// from page 1 with a clean facet selection. Adjusting state during render
	// (rather than in an effect) is React's recommended way to react to a
	// changed input and avoids an extra render pass.
	const [prevTerm, setPrevTerm] = useState(term);
	if (term !== prevTerm) {
		setPrevTerm(term);
		setPage(0);
		setRefinements({});
	}

	const searchParamsForApi = useMemo(
		() => ({
			searchTerm: term,
			page,
			pageSize: PAGE_SIZE,
			refinements: Object.entries(refinements).map(([nameOrId, values]) => ({
				nameOrId,
				values,
			})),
		}),
		[term, page, refinements],
	);

	const { data, loading, error } = useProductSearch(searchParamsForApi);
	// Fresh `?? []` array each render when undefined — memoize so downstream
	// useMemo deps stay stable across unrelated re-renders.
	const products = useMemo(
		() => data?.productsPage?.products ?? [],
		[data?.productsPage?.products],
	);
	const total = data?.productsPage?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const facets = data?.facets ?? [];
	// Only use the sidebar layout when the API returns facets; otherwise the
	// grid would collapse into the 220px left cell.
	const hasFacets = facets.length > 0;

	// Evaluate promotions for the visible page. Skip products without a unit
	// price — the API requires `salesPrice`. Failures are silently ignored.
	const promotionInputs = useMemo<readonly PromotionProductInput[]>(() => {
		return products
			.filter((p) => p.prices?.unitPrice)
			.map((p) => ({
				productId: p.id,
				salesPrice: p.prices!.unitPrice as string,
			}));
	}, [products]);
	const { data: promotions } = usePromotionEvaluation(promotionInputs);

	if (term === "") {
		return (
			<div className="w-full px-4 sm:px-6 lg:px-8 py-8">
				<h1 className="text-2xl font-semibold">Search</h1>
				<p className="text-sm text-muted-foreground mt-2">
					Enter a keyword above to search the catalog.
				</p>
			</div>
		);
	}

	return (
		<div className="w-full px-4 sm:px-6 lg:px-8 py-8">
			<div className={hasFacets ? "grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6" : ""}>
				{hasFacets && (
					<FacetPanel
						facets={facets}
						selected={refinements}
						onChange={(next) => {
							setRefinements(next);
							setPage(0);
						}}
					/>
				)}
				<div className="space-y-4 min-w-0">
					<div className="flex items-baseline justify-between gap-4">
						<h1 className="text-2xl font-semibold truncate">
							Results for “{term}”
						</h1>
						<div className="text-sm text-muted-foreground shrink-0">
							{total > 0 ? `${total} results` : ""}
						</div>
					</div>
					{error && (
						<Alert variant="destructive">
							<AlertTitle>Search failed</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
					<ProductGrid
						products={products}
						loading={loading}
						promotions={promotions ?? undefined}
						emptyMessage={`No products match “${term}”.`}
					/>

					{totalPages > 1 && (
						<div className="flex items-center justify-center gap-2 pt-6">
							<Button
								variant="outline"
								size="sm"
								disabled={page <= 0}
								onClick={() => setPage((p) => Math.max(0, p - 1))}
							>
								Previous
							</Button>
							<span className="text-sm">
								Page {page + 1} of {totalPages}
							</span>
							<Button
								variant="outline"
								size="sm"
								disabled={page >= totalPages - 1}
								onClick={() => setPage((p) => p + 1)}
							>
								Next
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
