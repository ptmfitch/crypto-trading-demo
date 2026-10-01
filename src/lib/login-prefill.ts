const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function loginEmailFromQuery(
  value: string | string[] | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "";
  const email = raw.trim();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return "";
  return email;
}

export function loginPathAfterRegister(email: string): string {
  const params = new URLSearchParams({ email });
  return `/login?${params.toString()}`;
}
