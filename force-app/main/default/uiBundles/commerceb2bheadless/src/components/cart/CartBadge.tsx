import { Link } from "react-router";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMMERCE_ROUTES } from "@/config/commerce";
import { useCart } from "@/context/CartContext";

// Nav-bar cart badge. Renders only when CartProvider is mounted.
export default function CartBadge() {
	const { count } = useCart();
	return (
		<Button variant="ghost" size="icon" asChild aria-label="Cart">
			<Link to={COMMERCE_ROUTES.CART} className="relative">
				<ShoppingCart className="h-5 w-5" />
				{count > 0 && (
					<span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
						{count > 99 ? "99+" : count}
					</span>
				)}
			</Link>
		</Button>
	);
}
