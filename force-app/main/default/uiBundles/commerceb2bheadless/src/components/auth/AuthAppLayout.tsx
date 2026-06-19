import SessionTimeoutValidator from "@/components/auth/SessionTimeoutValidator";
import { AuthProvider } from "@/context/AuthContext";
import AppLayout from "@/appLayout";

export default function AuthAppLayout() {
	return (
		<AuthProvider>
			<SessionTimeoutValidator basePath="" />
			<AppLayout />
		</AuthProvider>
	);
}
