"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

import { LIGHT_LOSS, LIGHT_PROFIT } from "@/lib/a11y-contrast"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system", resolvedTheme } = useTheme()
  // Sonner's light rich colors are under 4.5:1. Dark toast colors already pass.
  const lightTheme = resolvedTheme !== "dark"

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-text": lightTheme ? LIGHT_PROFIT : undefined,
          "--error-text": lightTheme ? LIGHT_LOSS : undefined,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
