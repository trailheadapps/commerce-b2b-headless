import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import FacetPanel, { type Refinements } from "@/components/catalog/FacetPanel";
import ProductGrid from "@/components/catalog/ProductGrid";
import { useProductSearch } from "@/hooks/useProductSearch";
import { usePromotionEvaluation } from "@/hooks/usePromotionEvaluation";
import type { PromotionProductInput } from "@/api/types";

const PAGE_SIZE = 12;

// Category PLP with facet sidebar + pagination.
export default function CategoryPage() {
	const { categoryId } = useParams();
	const [page, setPage] = useState(0);
	const [refinements, setRefinements] = useState<Refinements>({});

	const searchParams = useMemo(() => ({
		categoryId,
		page,
		pageSize: PAGE_SIZE,
		refinements: Object.entries(refinements).map(([nameOrId, values]) => ({
			nameOrId,
			values,
		})),
	}), [categoryId, page, refinements]);

	const { data, loading, error } = useProductSearch(searchParams);
	// `data?.productsPage?.products` returns a fresh array each render when
	// undefined (the `?? []` fallback) — memoize so downstream useMemo deps
	// stay stable across re-renders that don't change the search result.
	const products = useMemo(
		() => data?.productsPage?.products ?? [],
		[data?.productsPage?.products],
	);
	const total = data?.productsPage?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const facets = data?.facets ?? [];
	// Only use the sidebar layout when the API actually returns facets. Otherwise
	// FacetPanel renders null and a 2-column grid collapses the product grid
	// into the left 220px cell.
	const hasFacets = facets.length > 0;

	// Evaluate promotions for the currently visible page of products. Skip
	// products without a unit price — the API requires `salesPrice` as input.
	// Failures here are silently ignored: the product grid still renders, just
	// without promo overlays.
	const promotionInputs = useMemo<readonly PromotionProductInput[]>(() => {
		return products
			.filter((p) => p.prices?.unitPrice)
			.map((p) => ({
				productId: p.id,
				salesPrice: p.prices!.unitPrice as string,
			}));
	}, [products]);
	const { data: promotions } = usePromotionEvaluation(promotionInputs);

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
					<div className="flex items-baseline justify-between">
						<h1 className="text-2xl font-semibold">Products</h1>
						<div className="text-sm text-muted-foreground">
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
