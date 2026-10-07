import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/get-dictionary";
import Link from "next/link";

export default async function LandingPage() {
  const { messages } = await getDictionary();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl">
        {messages.shell.welcomeTitle}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        {messages.shell.landingSubtitle}
      </p>
      <div className="mt-8 flex gap-4">
        <Button asChild>
          <Link href="/login">{messages.shell.login}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/register">{messages.shell.createAccount}</Link>
        </Button>
      </div>
    </div>
  );
}
