import { getDictionary } from "@/i18n/get-dictionary";
import { isDevLoginEnabled, listTestAccounts } from "@/lib/dev-login";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const { messages } = await getDictionary();
  const devLoginEnabled = isDevLoginEnabled();
  const testAccounts = await listTestAccounts(messages);

  return (
    <LoginForm devLoginEnabled={devLoginEnabled} testAccounts={testAccounts} />
  );
}
