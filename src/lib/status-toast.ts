import { toast } from "sonner";

/** One id so a new status replaces the previous toast in the polite live region. */
export const STATUS_TOAST_ID = "app-status";

export function statusToastOptions(description?: string) {
  return {
    id: STATUS_TOAST_ID,
    // Always set, including undefined, so an update drops the previous description.
    description,
  };
}

export function showStatusSuccess(message: string, description?: string) {
  return toast.success(message, statusToastOptions(description));
}

export function showStatusError(message: string, description?: string) {
  return toast.error(message, statusToastOptions(description));
}
