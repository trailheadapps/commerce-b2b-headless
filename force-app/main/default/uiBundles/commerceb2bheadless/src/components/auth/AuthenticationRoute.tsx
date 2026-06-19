import { Navigate, Outlet, useSearchParams } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { getStartUrl } from "@/lib/authHelpers";
import { CardSkeleton } from "@/components/auth/CardSkeleton";

/**
 * [Dev Note] "Public Only" Route Guard:
 * This component protects routes that should NOT be accessible if the user is already logged in
 * (e.g., Login, Register, Forgot Password).
 * If an authenticated user tries to access these pages, they are automatically redirected
 * to the default authenticated view (e.g., Home or Profile) to prevent confusion.
 */
export default function AuthenticationRoute() {
	const { isAuthenticated, loading } = useAuth();
	const [searchParams] = useSearchParams();

	if (loading) return <CardSkeleton contentMaxWidth="md" />;
	if (isAuthenticated) return <Navigate to={getStartUrl(searchParams)} replace />;

	return <Outlet />;
}
