import type { Messages } from "./en";

export function t(
  messages: Messages,
  key: string,
  vars?: Record<string, string | number>
): string {
  const parts = key.split(".");
  let value: unknown = messages;

  for (const part of parts) {
    if (value && typeof value === "object" && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }

  if (typeof value !== "string") {
    return key;
  }

  if (!vars) {
    return value;
  }

  return value.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (name in vars) {
      return String(vars[name]);
    }
    return match;
  });
}
