"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import type { Messages } from "./en";
import { t as translate } from "./translate";

type LocaleContextValue = {
  locale: Locale;
  messages: Messages;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      locale,
      messages,
      t: (key: string, vars?: Record<string, string | number>) =>
        translate(messages, key, vars),
    }),
    [locale, messages]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useMessages() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useMessages must be used within LocaleProvider");
  }
  return context;
}
