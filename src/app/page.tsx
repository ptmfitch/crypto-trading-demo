import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function LandingPage() {
  const t = await getTranslations("Landing");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        {t("subtitle")}
      </p>
      <div className="mt-8 flex gap-4">
        <Button asChild>
          <Link href="/login">{t("login")}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/register">{t("createAccount")}</Link>
        </Button>
      </div>
    </div>
  );
}
