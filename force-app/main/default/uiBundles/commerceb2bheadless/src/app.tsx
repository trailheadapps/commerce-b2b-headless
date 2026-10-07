import { createBrowserRouter, RouterProvider } from "react-router";
import { routes } from "./routes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { preloadCommerceContext } from "@/lib/commerceContext";
import "./styles/global.css";

// Warm the commerce application- and session-context once per page load, so
// they're in flight before the first render and cached for every API call
// that follows. A full reload re-runs this module and refetches.
preloadCommerceContext();

// Normalize basename: strip trailing slash so it matches URLs like /lwr/application/ai/c-app
const rawBasePath = (globalThis as any).SFDC_ENV?.basePath;
const basename = typeof rawBasePath === "string" ? rawBasePath.replace(/\/+$/, "") : undefined;
const router = createBrowserRouter(routes, { basename });

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);
