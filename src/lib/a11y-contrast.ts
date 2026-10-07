/** Light-theme profit and loss text. Both clear 4.5:1 on white and on the toast fills. */
export const LIGHT_PROFIT = "#15803d";
export const LIGHT_LOSS = "#b91c1c";

/** Dark-theme values already measured above 4.5:1 on the dark card. Leave them. */
export const DARK_PROFIT = "#00c950";
export const DARK_LOSS = "#fb2c36";

/** Sonner light rich-color fills (`hsl(143 85% 96%)` and `hsl(359 100% 97%)`). */
export const LIGHT_SUCCESS_TOAST_BG = "#ecfdf3";
export const LIGHT_ERROR_TOAST_BG = "#fff0f0";

export const LIGHT_CARD = "#ffffff";
export const DARK_CARD = "#171717";

function channel(hex: string, offset: number) {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string) {
  const normalized = hex.toLowerCase();
  return (
    0.2126 * channel(normalized, 1) +
    0.7152 * channel(normalized, 3) +
    0.0722 * channel(normalized, 5)
  );
}

export function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  const darker = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  return (lighter + 0.05) / (darker + 0.05);
}
