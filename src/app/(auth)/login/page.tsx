import {
  formatTestAccountSummary,
  isDevLoginEnabled,
  listTestAccounts,
} from "@/lib/dev-login";
import { getTranslations } from "next-intl/server";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const devLoginEnabled = isDevLoginEnabled();
  const t = await getTranslations("Login");
  const testAccounts = (await listTestAccounts()).map((account) => ({
    email: account.email,
    name: account.name?.trim() || t("unnamed"),
    summary: formatTestAccountSummary(account, {
      cash: t("cash"),
      trades:
        account.trades === 1
          ? t("tradeOne")
          : t("tradeMany", { count: account.trades }),
    }),
  }));

  return (
    <LoginForm devLoginEnabled={devLoginEnabled} testAccounts={testAccounts} />
  );
}
