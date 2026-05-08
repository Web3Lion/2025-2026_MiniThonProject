export type AppTheme = "dark-violet" | "dark-blue" | "light-green";

export interface ThemeConfig {
  id: AppTheme;
  label: string;
  preview: string; // tailwind classes for preview swatch
  vars: Record<string, string>;
}

export const THEMES: ThemeConfig[] = [
  {
    id: "dark-violet",
    label: "Dark Violet",
    preview: "bg-gradient-to-br from-violet-900 to-gray-950",
    vars: {
      "--bg-primary":   "#030712",
      "--bg-card":      "rgba(255,255,255,0.05)",
      "--bg-card-hover":"rgba(255,255,255,0.08)",
      "--border":       "rgba(255,255,255,0.10)",
      "--border-accent":"rgba(139,92,246,0.50)",
      "--text-primary": "#f9fafb",
      "--text-muted":   "rgba(249,250,251,0.50)",
      "--text-faint":   "rgba(249,250,251,0.25)",
      "--accent":       "#7c3aed",
      "--accent-hover": "#6d28d9",
      "--accent-grad":  "linear-gradient(135deg,#7c3aed,#c026d3)",
      "--success":      "#10b981",
      "--warning":      "#f59e0b",
      "--error":        "#ef4444",
    },
  },
  {
    id: "dark-blue",
    label: "Dark Blue",
    preview: "bg-gradient-to-br from-blue-900 to-black",
    vars: {
      "--bg-primary":   "#00070f",
      "--bg-card":      "rgba(30,58,138,0.20)",
      "--bg-card-hover":"rgba(30,58,138,0.35)",
      "--border":       "rgba(59,130,246,0.20)",
      "--border-accent":"rgba(59,130,246,0.60)",
      "--text-primary": "#e0f2fe",
      "--text-muted":   "rgba(224,242,254,0.55)",
      "--text-faint":   "rgba(224,242,254,0.25)",
      "--accent":       "#1d4ed8",
      "--accent-hover": "#1e40af",
      "--accent-grad":  "linear-gradient(135deg,#1d4ed8,#0369a1)",
      "--success":      "#22d3ee",
      "--warning":      "#fbbf24",
      "--error":        "#f87171",
    },
  },
  {
    id: "light-green",
    label: "Kelly Green",
    preview: "bg-gradient-to-br from-green-600 to-green-100",
    vars: {
      "--bg-primary":   "#f0fdf4",
      "--bg-card":      "rgba(255,255,255,0.90)",
      "--bg-card-hover":"rgba(255,255,255,1)",
      "--border":       "rgba(22,101,52,0.15)",
      "--border-accent":"rgba(22,163,74,0.60)",
      "--text-primary": "#14532d",
      "--text-muted":   "rgba(21,128,61,0.70)",
      "--text-faint":   "rgba(21,128,61,0.40)",
      "--accent":       "#16a34a",
      "--accent-hover": "#15803d",
      "--accent-grad":  "linear-gradient(135deg,#16a34a,#15803d)",
      "--success":      "#16a34a",
      "--warning":      "#d97706",
      "--error":        "#dc2626",
    },
  },
];

export const THEME_STORAGE_KEY = "minthon_theme";

export function getThemeVarsStyle(theme: AppTheme): string {
  const cfg = THEMES.find(t => t.id === theme) ?? THEMES[0];
  return Object.entries(cfg.vars).map(([k, v]) => `${k}:${v}`).join(";");
}
