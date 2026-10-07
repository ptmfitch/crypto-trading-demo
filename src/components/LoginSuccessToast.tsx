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
    sessionStorage.removeItem(STORAGE_KEY);
    toast.success(messages.auth.loginSuccessful);
  }, [messages.auth.loginSuccessful]);

  return null;
}
