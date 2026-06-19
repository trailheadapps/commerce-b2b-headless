import { Link } from "react-router";
import type { CategoryNode } from "@/api/types";
import { COMMERCE_ROUTES } from "@/config/commerce";
import { Skeleton } from "@/components/ui/skeleton";

export interface CategorySidebarProps {
	readonly items: readonly CategoryNode[];
	readonly loading?: boolean;
	readonly onNavigate?: () => void;
}

// Nested list of categories + subcategories. Designed to live in a
// left-hand column on desktop or inside a drawer on mobile.
export default function CategorySidebar({ items, loading, onNavigate }: CategorySidebarProps) {
	if (loading && items.length === 0) {
		return (
			<div className="space-y-2">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className="h-6 w-3/4" />
				))}
			</div>
		);
	}
	return (
		<nav aria-label="Categories" className="space-y-4">
			{items.map((item) => (
				<div key={item.id} className="space-y-1">
					<Link
						to={COMMERCE_ROUTES.CATEGORY(item.id)}
						onClick={onNavigate}
						className="block text-sm font-semibold hover:text-primary"
					>
						{item.name}
					</Link>
					{item.children.length > 0 && (
						<ul className="pl-3 border-l space-y-1">
							{item.children.map((child) => (
								<li key={child.id}>
									<Link
										to={COMMERCE_ROUTES.CATEGORY(child.id)}
										onClick={onNavigate}
										className="block text-sm text-muted-foreground hover:text-foreground"
									>
										{child.name}
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			))}
		</nav>
	);
}
