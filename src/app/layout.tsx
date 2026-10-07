import { LoginSuccessToast } from "@/components/LoginSuccessToast";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { getDictionary } from "@/i18n/get-dictionary";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getDictionary();
  return {
    title: messages.shell.metadataTitle,
    description: messages.shell.metadataDescription,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, messages } = await getDictionary();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <LocaleProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors position="top-right" />
            <LoginSuccessToast />
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
