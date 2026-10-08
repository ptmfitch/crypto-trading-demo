"use client";

import { updateUserLocale } from "@/actions/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCALE_LABELS, LOCALES, type AppLocale } from "@/lib/locale";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

export function LanguagePicker({ locale }: { locale: AppLocale }) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(value: string) {
    startTransition(async () => {
      const result = await updateUserLocale(value);
      if (!result.ok) {
        toast.error(t("languageError"));
        return;
      }
      toast.success(t("languageSaved"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("language")}</p>
      <Select value={locale} onValueChange={onChange} disabled={isPending}>
        <SelectTrigger className="w-[220px]" aria-label={t("language")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LOCALES.map((code) => (
            <SelectItem key={code} value={code}>
              {LOCALE_LABELS[code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
