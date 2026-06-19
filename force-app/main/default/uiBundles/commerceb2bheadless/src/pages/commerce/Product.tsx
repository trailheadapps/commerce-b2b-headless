import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PriceDisplay, { formatCurrency } from "@/components/catalog/PriceDisplay";
import PromotionBadge from "@/components/catalog/PromotionBadge";
import QuantitySelector from "@/components/cart/QuantitySelector";
import { useCart } from "@/context/CartContext";
import { asText, type PromotionProductInput } from "@/api/types";
import { useProduct, useProductPrice } from "@/hooks/useProduct";
import { useProductTax } from "@/hooks/useProductTax";
import { usePromotionEvaluation } from "@/hooks/usePromotionEvaluation";

export default function ProductPage() {
	const { productId } = useParams();
	const navigate = useNavigate();
	const { data: product, loading, error } = useProduct(productId);
	const { data: priceInfo } = useProductPrice(productId);
	// Tax rate for the "+X% tax" suffix beside the price. Returns null on
	// Net-tax stores or if the rate is unavailable; the indicator just
	// doesn't render in those cases.
	const { data: taxRate } = useProductTax(productId);
	const { addItem } = useCart();
	const [qty, setQty] = useState(1);
	const [adding, setAdding] = useState(false);

	// Evaluate promotions for this single product as soon as we have a unit
	// price to feed in. The badge + promo messaging block render inline once
	// the response lands; the page never blocks on the evaluate call.
	const unitPrice = priceInfo?.unitPrice;
	const promotionInputs = useMemo<readonly PromotionProductInput[]>(() => {
		if (!productId || !unitPrice) return [];
		return [{ productId, salesPrice: unitPrice }];
	}, [productId, unitPrice]);
	const { data: promotions } = usePromotionEvaluation(promotionInputs);
	const promotion = productId ? promotions?.get(productId) : undefined;
	const adjustment = promotion?.promotionPriceAdjustmentList?.[0];
	const hasPromo =
		!!promotion?.promotionalPrice &&
		Number(promotion.promotionalPrice) < Number(priceInfo?.unitPrice ?? NaN);

	if (loading) {
		return (
			<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
				<Skeleton className="aspect-square w-full" />
				<div className="space-y-4">
					<Skeleton className="h-8 w-2/3" />
					<Skeleton className="h-5 w-1/4" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-10 w-48" />
				</div>
			</div>
		);
	}
	if (error || !product) {
		return (
			<div className="max-w-2xl mx-auto px-4 py-8">
				<Alert variant="destructive">
					<AlertTitle>Product unavailable</AlertTitle>
					<AlertDescription>{error ?? "Not found"}</AlertDescription>
				</Alert>
			</div>
		);
	}

	const name = asText(product.name) || asText(product.fields?.Name) || "Product";
	const description = asText(product.fields?.Description);
	// Only consider Image media — media groups also carry Documents (e.g. spec
	// sheets in the "attachment" group), and a flat first-with-a-url pick would
	// otherwise grab a non-image URL and render a broken image. Prefer the
	// product-detail image group, then fall back to any image, then defaultImage.
	const imageItems = (product.mediaGroups ?? [])
		.flatMap((g) => g.mediaItems ?? [])
		.filter((m) => m?.url && (m.mediaType ?? "Image") === "Image");
	const detailImages = (product.mediaGroups ?? [])
		.filter((g) => g.developerName === "productDetailImage")
		.flatMap((g) => g.mediaItems ?? [])
		.filter((m) => m?.url && (m.mediaType ?? "Image") === "Image");
	const hero = detailImages[0]?.url ?? imageItems[0]?.url ?? product.defaultImage?.url;

	const onAddToCart = async () => {
		if (!productId) return;
		setAdding(true);
		try {
			await addItem(productId, qty);
			toast.success(`Added ${qty} × ${name} to cart`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to add to cart");
		} finally {
			setAdding(false);
		}
	};

	return (
		<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
				← Back
			</Button>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
				<div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
					{hero ? (
						<img src={hero} alt={name} className="w-full h-full object-cover" />
					) : (
						<span className="text-sm text-muted-foreground">No image</span>
					)}
				</div>
				<div className="space-y-4">
					<h1 className="text-2xl font-bold">{name}</h1>
					<div className="flex items-center gap-2 flex-wrap">
						<PriceDisplay
							amount={hasPromo ? promotion?.promotionalPrice : priceInfo?.unitPrice}
							listPrice={hasPromo ? priceInfo?.unitPrice : priceInfo?.listPrice}
							currency={priceInfo?.currencyIsoCode}
							className="text-lg"
						/>
						{hasPromo && (
							<PromotionBadge
								salesPrice={priceInfo?.unitPrice}
								promotionalPrice={promotion?.promotionalPrice}
							/>
						)}
					</div>
					{taxRate && (
						<p className="text-xs text-muted-foreground">
							Inclusive of {taxRate.taxRatePercentage}% tax
						</p>
					)}
					{hasPromo && adjustment && (
						<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm space-y-1">
							<div className="font-medium text-emerald-900">
								{adjustment.displayName ?? "Promotion applied"}
							</div>
							{priceInfo?.unitPrice && promotion?.promotionalPrice && (
								<div className="text-emerald-800">
									You save{" "}
									{formatCurrency(
										Number(priceInfo.unitPrice) - Number(promotion.promotionalPrice),
										priceInfo.currencyIsoCode,
									)}
								</div>
							)}
							{adjustment.termsAndConditions && (
								<div className="text-xs text-emerald-700">
									{adjustment.termsAndConditions}
								</div>
							)}
						</div>
					)}
					{description && (
						<div
							className="prose prose-sm max-w-none text-muted-foreground"
							dangerouslySetInnerHTML={{ __html: description }}
						/>
					)}
					<div className="flex items-center gap-3 pt-4">
						<QuantitySelector value={qty} onChange={setQty} disabled={adding} />
						<Button onClick={onAddToCart} disabled={adding}>
							{adding ? "Adding…" : "Add to cart"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
