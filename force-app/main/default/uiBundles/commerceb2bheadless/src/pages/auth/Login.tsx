import { useState } from "react";
import { useSearchParams } from "react-router";
import { z } from "zod";
import { CenteredPageLayout } from "@/components/auth/CenteredPageLayout";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAppForm } from "@/hooks/form";
import { ROUTES } from "@/config/auth";
import { emailSchema, getStartUrl } from "@/lib/authHelpers";
import { getErrorMessage } from "@/lib/authResponseHelpers";
import { loginAndRedirect } from "@/api/auth";

// Same-site login route. Submits credentials to this org's own Apex REST
// endpoint at /services/apexrest/auth/login (UIBundleLogin.cls), which wraps
// Site.login() and returns a frontdoor.jsp URL carrying the session id. We
// then hard-navigate so the platform sets the `sid` cookie scoped to the
// container site.

const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, "Password is required"),
});

export default function LoginSite() {
	const [searchParams] = useSearchParams();
	const [submitError, setSubmitError] = useState<string | null>(null);

	const form = useAppForm({
		defaultValues: { email: "", password: "" },
		validators: { onChange: loginSchema, onSubmit: loginSchema },
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			try {
				const requested = getStartUrl(searchParams);
				const isMeaningful =
					requested && requested !== "/" && requested.trim() !== "";
				const startUrl = isMeaningful ? requested : "/";

				await loginAndRedirect({
					username: value.email.trim().toLowerCase(),
					password: value.password,
					startUrl,
				});
			} catch (err) {
				setSubmitError(getErrorMessage(err, "Login failed"));
			}
		},
		onSubmitInvalid: () => {},
	});

	return (
		<CenteredPageLayout title="Login (site native)">
			<form.AppForm>
				<AuthForm
					title="Login"
					description="Sign in with your buyer credentials."
					error={submitError}
					submit={{ text: "Login", loadingText: "Logging in…" }}
					footer={{
						text: "Don't have an account?",
						link: ROUTES.REGISTER.PATH,
						linkText: "Sign up",
					}}
				>
					<form.AppField name="email">
						{(field) => <field.EmailField label="Email" />}
					</form.AppField>
					<form.AppField name="password">
						{(field) => <field.PasswordField label="Password" />}
					</form.AppField>
				</AuthForm>
			</form.AppForm>
		</CenteredPageLayout>
	);
}
