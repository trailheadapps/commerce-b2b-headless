import { Checkbox } from "@/components/ui/checkbox";
import type { ProductSearchFacet } from "@/api/types";

// Selected refinements are stored as { [facetNameOrId]: Set<valueId> }.
// The parent page owns the state; this component is purely presentational.
export type Refinements = Readonly<Record<string, readonly string[]>>;

export interface FacetPanelProps {
	readonly facets: readonly ProductSearchFacet[];
	readonly selected: Refinements;
	onChange: (next: Refinements) => void;
}

function toggle(current: readonly string[], value: string): string[] {
	return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export default function FacetPanel({ facets, selected, onChange }: FacetPanelProps) {
	if (facets.length === 0) return null;
	return (
		<aside className="space-y-6">
			{facets.map((facet) => {
				const key = facet.nameOrId ?? facet.id ?? "";
				const current = selected[key] ?? [];
				return (
					<div key={key} className="space-y-2">
						<h3 className="text-sm font-semibold">{facet.displayName ?? key}</h3>
						<div className="space-y-1.5">
							{(facet.values ?? []).map((v) => {
								const vid = v.nameOrId ?? v.id ?? v.name ?? "";
								const checked = current.includes(vid);
								const inputId = `facet-${key}-${vid}`;
								return (
									<label
										key={vid}
										htmlFor={inputId}
										className="flex items-center gap-2 text-sm cursor-pointer"
									>
										<Checkbox
											id={inputId}
											checked={checked}
											onCheckedChange={() => {
												const nextValues = toggle(current, vid);
												const next = { ...selected, [key]: nextValues };
												if (nextValues.length === 0) delete (next as Record<string, unknown>)[key];
												onChange(next);
											}}
										/>
										<span className="flex-1">{v.displayName ?? v.name ?? vid}</span>
										{v.productCount !== undefined && (
											<span className="text-xs text-muted-foreground">({v.productCount})</span>
										)}
									</label>
								);
							})}
						</div>
					</div>
				);
			})}
		</aside>
	);
}
