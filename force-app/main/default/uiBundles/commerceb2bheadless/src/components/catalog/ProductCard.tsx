import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import {
	asText,
	type ProductSearchItem,
	type PromotionProductEvaluationResult,
} from "@/api/types";
import { COMMERCE_ROUTES } from "@/config/commerce";
import PriceDisplay from "@/components/catalog/PriceDisplay";
import PromotionBadge from "@/components/catalog/PromotionBadge";

export interface ProductCardProps {
	readonly product: ProductSearchItem;
	// Optional promotion evaluation result for this product. When present and
	// it brings the price below `salesPrice`, the card shows the promotional
	// price (with the original struck through) and a "Save X%" badge.
	readonly promotion?: PromotionProductEvaluationResult;
}

export default function ProductCard({ product, promotion }: ProductCardProps) {
	const name = asText(product.name) || asText(product.fields?.Name) || "Unnamed product";
	const sku = asText(product.fields?.StockKeepingUnit);
	const image = product.defaultImage?.url;
	const salesPrice = product.prices?.unitPrice;
	const promotional = promotion?.promotionalPrice;
	const hasPromo =
		promotional !== undefined &&
		promotional !== null &&
		Number(promotional) < Number(salesPrice ?? NaN);
	// When a promo applies, the displayed price is the promo price and the
	// original sales price is shown as struck-through alongside.
	const displayAmount = hasPromo ? promotional : salesPrice;
	const displayListPrice = hasPromo ? salesPrice : product.prices?.listPrice;
	return (
		<Card className="overflow-hidden hover:shadow-md transition-shadow">
			<Link to={COMMERCE_ROUTES.PRODUCT(product.id)} className="block">
				<div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
					{image ? (
						<img
							src={image}
							alt={product.defaultImage?.alternateText ?? name}
							className="w-full h-full object-cover"
							loading="lazy"
						/>
					) : (
						<div className="text-xs text-muted-foreground">No image</div>
					)}
				</div>
				<CardContent className="p-4 space-y-1">
					<div className="font-medium text-sm line-clamp-2 min-h-10">{name}</div>
					{sku && <div className="text-xs text-muted-foreground">SKU {sku}</div>}
					<div className="pt-1 flex items-center gap-2 flex-wrap">
						<PriceDisplay
							amount={displayAmount}
							listPrice={displayListPrice}
							currency={product.prices?.currencyIsoCode}
						/>
						{hasPromo && (
							<PromotionBadge
								salesPrice={salesPrice}
								promotionalPrice={promotional}
							/>
						)}
					</div>
				</CardContent>
			</Link>
		</Card>
	);
}
