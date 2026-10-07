"use client";

import { updateLocale } from "@/actions/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Locale } from "@/i18n/config";
import { useMessages } from "@/i18n/locale-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type LanguageSelectProps = {
  value: Locale;
};

export function LanguageSelect({ value }: LanguageSelectProps) {
  const { messages } = useMessages();
  const router = useRouter();

  async function onValueChange(nextLocale: string) {
    if (nextLocale === value) return;

    const result = await updateLocale(nextLocale as Locale);
    if (result?.error) {
      return;
    }

    toast.success(messages.locale.updated);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.locale.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger
            className="w-full rounded-lg"
            aria-label={messages.locale.label}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="en" className="rounded-lg">
              {messages.locale.english}
            </SelectItem>
            <SelectItem value="sv" className="rounded-lg">
              {messages.locale.swedish}
            </SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
