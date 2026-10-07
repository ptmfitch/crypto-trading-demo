import { auth, signOut } from "@/auth";
import Link from "next/link";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Button } from "./ui/button";

function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <Button type="submit" variant="ghost">
        Logout
      </Button>
    </form>
  );
}

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto flex min-h-16 w-full min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1">
          <Link href="/dashboard" className="text-xl font-bold">
            TradeSim
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Dashboard
          </Link>
          <Link
            href="/profile"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Profile
          </Link>
        </div>
        <div className="ml-auto flex min-w-0 max-w-full items-center gap-4">
          <span className="min-w-0 truncate text-sm text-muted-foreground">
            {session?.user?.name || session?.user?.email}
          </span>
          <ThemeSwitcher />
          <SignOutButton />
        </div>
      </nav>
    </header>
  );
}
