/**
 * RPMCares design tokens — clean white-base palette.
 * Primary: #19D400. White backgrounds, neutral grays, green used as accent only.
 */
import { Platform } from "react-native";

const shared = {
  navy: "#0D2009",               // deep forest green — Tenovi ops card
  navyForeground: "#FFFFFF",
  success: "#059669",            // emerald — clearly distinct from primary green
  warning: "#D97706",
  warningForeground: "#78350F",
  critical: "#DC2626",
  info: "#0284C7",
  chart1: "#19D400",
  chart2: "#0284C7",
  chart3: "#D97706",
  chart4: "#DC2626",
  chart5: "#7C3AED",
};

export const Colors = {
  light: {
    ...shared,

    // Text — neutral dark, easy to read
    text: "#111827",
    textSecondary: "#6B7280",

    // Backgrounds — white base, very light surfaces
    background: "#FFFFFF",
    surface: "#F8FAF8",          // barely-there green tint, almost white
    surface2: "#F2F4F2",
    card: "#FFFFFF",
    border: "#E4E9E3",           // soft warm-gray border

    // Brand — vivid green used sparingly on interactive elements only
    primary: "#19D400",
    primaryForeground: "#052B00", // dark green — 9:1 contrast on #19D400

    // Secondary — pale green chip / badge backgrounds
    secondary: "#F0FBEe",
    secondaryForeground: "#1A4314",

    // Muted — neutral light gray
    muted: "#F3F4F6",
    mutedForeground: "#6B7280",

    // Accent — very pale green highlight
    accent: "#E6F9E2",

    // Destructive
    destructive: "#DC2626",

    // Sidebar — deep forest green (stays dark for contrast)
    sidebar: "#0D2009",
    sidebarForeground: "#C8DFC4",
    sidebarPrimary: "#19D400",
    sidebarAccent: "#182E14",
    sidebarBorder: "#1E3A1A",

    // Misc
    backgroundElement: "#F3F7F2",
    backgroundSelected: "#E6F5E2",
  },

  dark: {
    ...shared,

    // Text
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",

    // Backgrounds — standard dark gray, not green-heavy
    background: "#111827",
    surface: "#1A2320",
    surface2: "#1F2D28",
    card: "#1A2320",
    border: "rgba(255,255,255,0.08)",

    // Brand
    primary: "#19D400",
    primaryForeground: "#052B00",

    // Secondary
    secondary: "#1A3D16",
    secondaryForeground: "#E6F9E2",

    // Muted
    muted: "#1F2937",
    mutedForeground: "#9CA3AF",

    // Accent
    accent: "#1A3D16",

    // Destructive
    destructive: "#F87171",

    // Sidebar
    sidebar: "#0B1A0E",
    sidebarForeground: "#D1EED0",
    sidebarPrimary: "#19D400",
    sidebarAccent: "#182E14",
    sidebarBorder: "rgba(25,212,0,0.10)",

    // Misc
    backgroundElement: "#1F2937",
    backgroundSelected: "#1A3D16",
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
  shadowColor: "#111827",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
