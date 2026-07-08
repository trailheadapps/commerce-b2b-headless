import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { Infinity as InfinityIcon, Menu, Package, X } from "lucide-react";
import { AuthMenu } from "@/components/auth/AuthMenu";
import { useAuth } from "@/context/AuthContext";
import { DropdownMenuItem } from "./components/ui/dropdown-menu";
import CartBadge from "@/components/cart/CartBadge";
import SearchBar from "@/components/catalog/SearchBar";
import { ROUTES } from "@/config/auth";
import { COMMERCE_ROUTES } from "@/config/commerce";
import { CartProvider } from "@/context/CartContext";
import { Button } from "./components/ui/button";
import { Toaster } from "./components/ui/sonner";
import { getAllRoutes } from "./router-utils";

// Global app chrome: sticky top nav with logo + links + cart badge + auth menu.
// Cart state lives at this level so the badge count stays in sync across pages.
export default function AppLayout() {
	const [isOpen, setIsOpen] = useState(false);
	const location = useLocation();
	const { isAuthenticated, loading } = useAuth();

	const isActive = (path: string) => location.pathname === path;

	// Auth flow pages (login, register, forgot/reset password) get a stripped
	// chrome — no announcement bar, no nav, no account controls — so the form
	// is the focus. Matches the Cirrus mockup which shows just the wordmark.
	const authPaths = [
		ROUTES.LOGIN.PATH,
		ROUTES.REGISTER.PATH,
		ROUTES.FORGOT_PASSWORD.PATH,
		ROUTES.RESET_PASSWORD.PATH,
	];
	const isAuthRoute = authPaths.some((p) => location.pathname.startsWith(p));

	// Only render cart + user menu for authenticated buyers. Guests get nothing in
	// these slots — they're nudged to /login via the page content itself.
	const showAccountControls = !loading && isAuthenticated && !isAuthRoute;

	const navigationRoutes: Array<{ path: string; label: string }> = getAllRoutes()
		.filter(
			(route) =>
				route.handle?.showInNavigation === true &&
				route.fullPath !== undefined &&
				route.handle?.label !== undefined,
		)
		.map((route) => ({
			path: route.fullPath!,
			label: route.handle?.label as string,
		}));

	return (
		<CartProvider>
			<div className="min-h-screen bg-background flex flex-col">
				<header className="sticky top-0 z-40 bg-white border-b">
					<div className="w-full px-4 sm:px-6 lg:px-8">
						<div className="flex items-center justify-between h-16 gap-4">
							<Link
								to="/"
								className="flex items-center gap-2 text-primary font-bold text-2xl tracking-tight"
								aria-label="Cirrus home"
							>
								<InfinityIcon className="h-7 w-7" strokeWidth={2.5} />
								<span>cirrus</span>
							</Link>
							{!isAuthRoute && (
								<nav className="hidden md:flex items-center gap-1">
									{navigationRoutes.map((item) => (
										<Button
											key={item.path}
											variant={isActive(item.path) ? "secondary" : "ghost"}
											size="sm"
											asChild
										>
											<Link to={item.path}>{item.label}</Link>
										</Button>
									))}
								</nav>
							)}
							<div className="flex items-center gap-2">
								{showAccountControls && (
									<>
										<SearchBar className="hidden md:block w-56 lg:w-72" />
										<CartBadge />
										<AuthMenu
											menuItems={
												<DropdownMenuItem asChild>
													<Link to={COMMERCE_ROUTES.ORDERS}>
														<Package className="size-4" />
														My orders
													</Link>
												</DropdownMenuItem>
											}
										/>
									</>
								)}
								{!isAuthRoute && (
									<Button
										variant="ghost"
										size="icon"
										className="md:hidden"
										onClick={() => setIsOpen((v) => !v)}
										aria-label="Toggle menu"
										aria-expanded={isOpen}
									>
										{isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
									</Button>
								)}
							</div>
						</div>
						{isOpen && (
							<div className="md:hidden pb-3 flex flex-col gap-1">
								{showAccountControls && (
									<SearchBar
										className="px-1 pb-2"
										onSubmit={() => setIsOpen(false)}
									/>
								)}
								{navigationRoutes.map((item) => (
									<Button
										key={item.path}
										variant={isActive(item.path) ? "secondary" : "ghost"}
										asChild
										className="justify-start"
									>
										<Link to={item.path} onClick={() => setIsOpen(false)}>
											{item.label}
										</Link>
									</Button>
								))}
							</div>
						)}
					</div>
				</header>
				<main className="flex-1">
					<Outlet />
				</main>
				<Toaster />
			</div>
		</CartProvider>
	);
}
