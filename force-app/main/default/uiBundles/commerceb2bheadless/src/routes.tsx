import type { RouteObject } from "react-router";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import Profile from "@/pages/auth/Profile";
import ChangePassword from "@/pages/auth/ChangePassword";
import AuthenticationRoute from "@/components/auth/AuthenticationRoute";
import PrivateRoute from "@/components/auth/PrivateRoute";
import AuthAppLayout from "@/components/auth/AuthAppLayout";
import Storefront from "@/pages/commerce/Storefront";
import Category from "@/pages/commerce/Category";
import Search from "@/pages/commerce/Search";
import Product from "@/pages/commerce/Product";
import Cart from "@/pages/commerce/Cart";
import Checkout from "@/pages/commerce/Checkout";
import OrderConfirmation from "@/pages/commerce/OrderConfirmation";
import Orders from "@/pages/commerce/Orders";
import { ROUTES } from "@/config/auth";

// Route tree overview:
//   /login, /register, ...         — Auth flow (guests only)
//   /                              — Storefront (auth required)
//   /category/:categoryId          — PLP (auth required)
//   /product/:productId            — PDP (auth required)
//   /cart, /checkout, /order/:id   — Auth required
//   /profile, /change-password     — Auth required
//
// `handle.showInNavigation: true` surfaces the path in the global nav.
export const routes: RouteObject[] = [
	{
		path: "/",
		element: <AuthAppLayout />,
		children: [
			{
				element: <AuthenticationRoute />,
				children: [
					{
						path: ROUTES.LOGIN.PATH,
						element: <Login />,
						handle: { showInNavigation: false, label: "Login", title: ROUTES.LOGIN.TITLE },
					},
					{
						path: ROUTES.REGISTER.PATH,
						element: <Register />,
						handle: { showInNavigation: false, title: ROUTES.REGISTER.TITLE },
					},
					{
						path: ROUTES.FORGOT_PASSWORD.PATH,
						element: <ForgotPassword />,
						handle: { showInNavigation: false, title: ROUTES.FORGOT_PASSWORD.TITLE },
					},
					{
						path: ROUTES.RESET_PASSWORD.PATH,
						element: <ResetPassword />,
						handle: { showInNavigation: false, title: ROUTES.RESET_PASSWORD.TITLE },
					},
				],
			},
			{
				element: <PrivateRoute showCardSkeleton />,
				children: [
					{
						index: true,
						element: <Storefront />,
						handle: { showInNavigation: true, label: "Shop" },
					},
					{
						path: "category/:categoryId",
						element: <Category />,
					},
					{
						path: "search",
						element: <Search />,
					},
					{
						path: "product/:productId",
						element: <Product />,
					},
					{
						path: "cart",
						element: <Cart />,
					},
					{
						path: "checkout",
						element: <Checkout />,
					},
					{
						path: "order/:orderId",
						element: <OrderConfirmation />,
					},
					{
						path: "orders",
						element: <Orders />,
					},
					{
						path: ROUTES.PROFILE.PATH,
						element: <Profile />,
						handle: { showInNavigation: false, label: "Profile", title: ROUTES.PROFILE.TITLE },
					},
					{
						path: ROUTES.CHANGE_PASSWORD.PATH,
						element: <ChangePassword />,
						handle: { showInNavigation: false, title: ROUTES.CHANGE_PASSWORD.TITLE },
					},
				],
			},
			{
				path: "*",
				element: <NotFound />,
			},
		],
	},
];
