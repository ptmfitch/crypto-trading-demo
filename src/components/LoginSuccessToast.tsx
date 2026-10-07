"use client";

import { useMessages } from "@/i18n/locale-provider";
import { useEffect } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "login-success-toast";

export function queueLoginSuccessToast() {
  sessionStorage.setItem(STORAGE_KEY, "1");
}

export function LoginSuccessToast() {
  const { messages } = useMessages();

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) !== "1") return;
    // This component is already mounted on /login. syncLocaleCookie revalidates
    // the layout there, and this effect would otherwise clear the flag and toast
    // on that document before /dashboard loads.
    if (window.location.pathname === "/login") return;
    sessionStorage.removeItem(STORAGE_KEY);
    toast.success(messages.auth.loginSuccessful);
  }, [messages.auth.loginSuccessful]);

  return null;
}
