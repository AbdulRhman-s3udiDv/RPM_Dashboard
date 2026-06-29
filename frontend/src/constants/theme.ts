/**
 * RPMCares design tokens — light-only professional palette.
 * Inspired by modern B2B SaaS (Stripe, Linear, Vercel).
 */
import { Platform } from "react-native";

const shared = {
  navy: "#0A1F3B",
  navyForeground: "#FFFFFF",
  success: "#059669",
  warning: "#D97706",
  warningForeground: "#78350F",
  critical: "#DC2626",
  info: "#0284C7",
  chart1: "#0066CC",
  chart2: "#059669",
  chart3: "#D97706",
  chart4: "#DC2626",
  chart5: "#7C3AED",
};

export const Colors = {
  light: {
    ...shared,
    text: "#0D1B2A",
    textSecondary: "#64748B",
    background: "#F7F9FC",
    surface: "#F1F5FA",
    surface2: "#E8EFF6",
    card: "#FFFFFF",
    border: "#DDE4EE",
    primary: "#0066CC",
    primaryForeground: "#FFFFFF",
    secondary: "#ECF2FA",
    secondaryForeground: "#0D1B2A",
    muted: "#EEF3F9",
    mutedForeground: "#64748B",
    accent: "#DBEAFE",
    destructive: "#DC2626",
    sidebar: "#081830",
    sidebarForeground: "#CBD5E1",
    sidebarPrimary: "#3B9EFF",
    sidebarAccent: "#112440",
    sidebarBorder: "#1C3050",
    backgroundElement: "#EEF3F9",
    backgroundSelected: "#DDE6F0",
  },
  dark: {
    ...shared,
    text: "#F1F5F9",
    textSecondary: "#94A3B8",
    background: "#020618",
    surface: "#0A1322",
    surface2: "#0F1C30",
    card: "#0F172B",
    border: "rgba(255,255,255,0.1)",
    primary: "#3B9EFF",
    primaryForeground: "#0F172B",
    secondary: "#1D293D",
    secondaryForeground: "#F1F5F9",
    muted: "#1D293D",
    mutedForeground: "#94A3B8",
    accent: "#1D293D",
    destructive: "#F87171",
    sidebar: "#0F172B",
    sidebarForeground: "#F1F5F9",
    sidebarPrimary: "#3B9EFF",
    sidebarAccent: "#1D293D",
    sidebarBorder: "rgba(255,255,255,0.1)",
    backgroundElement: "#1D293D",
    backgroundSelected: "#2A3A52",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: "system-ui", rounded: "ui-rounded", mono: "ui-monospace" },
  default: { sans: "normal", rounded: "normal", mono: "monospace" },
  web: { sans: "Inter, ui-sans-serif, system-ui, sans-serif", rounded: "normal", mono: "monospace" },
});

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 16,
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const CardShadow = {
  shadowColor: "#0A1F3B",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 3,
};

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
