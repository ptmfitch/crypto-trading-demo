import { auth, signOut } from "@/auth";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Button } from "./ui/button";

function SignOutButton({ label }: { label: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <Button type="submit" variant="ghost">
        {label}
      </Button>
    </form>
  );
}

export async function Header() {
  const session = await auth();
  const t = await getTranslations("Header");

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <div className="flex items-center space-x-6">
          <Link href="/dashboard" className="text-xl font-bold">
            TradeSim
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            {t("dashboard")}
          </Link>
          <Link
            href="/profile"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            {t("profile")}
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">
            {session?.user?.name || session?.user?.email}
          </span>
          <ThemeSwitcher />
          <SignOutButton label={t("logout")} />
        </div>
      </nav>
    </header>
  );
}
