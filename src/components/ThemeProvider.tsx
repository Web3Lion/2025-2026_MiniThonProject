"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { THEMES, AppTheme, THEME_STORAGE_KEY } from "@/lib/themes";

// ─── Context ──────────────────────────────────────────────────────────────────
interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark-violet",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ─── Theme icon map ───────────────────────────────────────────────────────────
const THEME_META: Record<AppTheme, { icon: string; bg: string; text: string; border: string }> = {
  "dark-violet": { icon: "🌙", bg: "#1e1b4b", text: "#c4b5fd", border: "#7c3aed" },
  "dark-blue":   { icon: "🌊", bg: "#0c1a2e", text: "#93c5fd", border: "#1d4ed8" },
  "light-green": { icon: "🌿", bg: "#dcfce7", text: "#15803d", border: "#16a34a" },
};

// ─── Switcher widget ──────────────────────────────────────────────────────────
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const current = THEME_META[theme];
  const currentLabel = THEMES.find(t => t.id === theme)?.label ?? "Theme";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{ background: current.bg, color: current.text, border: `1.5px solid ${current.border}`, minWidth: "130px" }}
      >
        <span>{current.icon}</span>
        <span>{currentLabel}</span>
        <span className="ml-auto opacity-60">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-2xl z-50"
          style={{ border: "1.5px solid rgba(255,255,255,0.15)", minWidth: "150px" }}>
          {THEMES.map((t) => {
            const meta = THEME_META[t.id];
            const isActive = theme === t.id;
            return (
              <button key={t.id} onClick={() => { setTheme(t.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-all"
                style={{ background: isActive ? meta.bg : "rgba(0,0,0,0.85)", color: isActive ? meta.text : "rgba(255,255,255,0.7)", borderLeft: isActive ? `3px solid ${meta.border}` : "3px solid transparent" }}>
                <span className="text-base">{meta.icon}</span>
                <span>{t.label}</span>
                {isActive && <span className="ml-auto" style={{ color: meta.border }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Provider — wraps the page and injects CSS vars ───────────────────────────
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("dark-violet");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
    if (saved && THEMES.find((t) => t.id === saved)) {
      setThemeState(saved);
    }
    setMounted(true);
  }, []);

  function setTheme(t: AppTheme) {
    setThemeState(t);
    localStorage.setItem(THEME_STORAGE_KEY, t);
  }

  const cfg = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const cssVars = Object.entries(cfg.vars).reduce(
    (acc, [k, v]) => ({ ...acc, [k]: v }),
    {} as React.CSSProperties
  );

  // Avoid flash of wrong theme — render children only after mount
  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", background: "#030712" }} />
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div
        style={{
          ...cssVars,
          minHeight: "100vh",
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
