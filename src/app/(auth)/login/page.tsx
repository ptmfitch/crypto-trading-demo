import { isDevLoginEnabled, listTestAccounts } from "@/lib/dev-login";
import { loginEmailFromQuery } from "@/lib/login-prefill";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const params = await searchParams;
  const devLoginEnabled = isDevLoginEnabled();
  const testAccounts = await listTestAccounts();

  return (
    <LoginForm
      devLoginEnabled={devLoginEnabled}
      testAccounts={testAccounts}
      initialEmail={loginEmailFromQuery(params.email)}
    />
  );
}
