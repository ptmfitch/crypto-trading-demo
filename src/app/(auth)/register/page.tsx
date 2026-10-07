"use client";

import { registerUser, type RegisterErrorCode } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Messages } from "@/i18n/en";
import { useMessages } from "@/i18n/locale-provider";
import { createRegisterSchema } from "@/i18n/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

function registerErrorMessage(
  code: RegisterErrorCode,
  messages: Messages
): string {
  const map: Record<RegisterErrorCode, string> = {
    invalidFields: messages.auth.invalidFields,
    emailTaken: messages.auth.emailTaken,
    somethingWentWrong: messages.auth.somethingWentWrong,
  };
  return map[code];
}

export default function RegisterPage() {
  const router = useRouter();
  const { messages } = useMessages();
  const formSchema = useMemo(() => createRegisterSchema(messages), [messages]);
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      const result = await registerUser(values);
      if (result.success) {
        toast.success(messages.auth.accountCreated, {
          description: messages.auth.accountCreatedDescription,
        });
        router.push("/login");
      } else if (result.error) {
        toast.error(messages.auth.registrationFailed, {
          description: registerErrorMessage(result.error, messages),
        });
      }
    });
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>{messages.auth.createAccountTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{messages.auth.name}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={messages.auth.namePlaceholder}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{messages.auth.email}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{messages.auth.password}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending
                  ? messages.auth.registering
                  : messages.shell.createAccount}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-gray-600">
            {messages.auth.alreadyHaveAccount}{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline"
            >
              {messages.shell.login}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
