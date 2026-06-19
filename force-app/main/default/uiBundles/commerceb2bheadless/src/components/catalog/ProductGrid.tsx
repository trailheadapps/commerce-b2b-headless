import { Skeleton } from "@/components/ui/skeleton";
import type { ProductSearchItem } from "@/api/types";
import type { PromotionEvaluationMap } from "@/hooks/usePromotionEvaluation";
import ProductCard from "./ProductCard";

export interface ProductGridProps {
	readonly products: readonly ProductSearchItem[];
	readonly loading?: boolean;
	readonly emptyMessage?: string;
	// Optional map of productId → promotion evaluation result. When provided,
	// each card consults this map to show its promotional price + badge. When
	// omitted, cards render the regular price (no promo overlays).
	readonly promotions?: PromotionEvaluationMap;
}

// Responsive grid — fixed breakpoints keep the class names trivially parseable
// by Tailwind v4. Each card has `min-w-0` applied via wrapper width.
const GRID_CLASSES =
	"grid w-full gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

export default function ProductGrid({
	products,
	loading,
	emptyMessage,
	promotions,
}: ProductGridProps) {
	if (loading && products.length === 0) {
		return (
			<div className={GRID_CLASSES}>
				{Array.from({ length: 8 }).map((_, i) => (
					<div key={i} className="space-y-3 min-w-0">
						<Skeleton className="aspect-square w-full" />
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-4 w-1/3" />
					</div>
				))}
			</div>
		);
	}
	if (products.length === 0) {
		return (
			<div className="text-sm text-muted-foreground py-12 text-center">
				{emptyMessage ?? "No products found."}
			</div>
		);
	}
	return (
		<div className={GRID_CLASSES}>
			{products.map((p) => (
				<ProductCard key={p.id} product={p} promotion={promotions?.get(p.id)} />
			))}
		</div>
	);
}
