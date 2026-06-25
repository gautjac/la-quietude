import { useEffect, useState } from "react";

// La Quiétude — light / dark theme. "auto" follows the OS. The initial class is
// applied by an inline script in index.html (no flash); this hook keeps it in
// sync and persists the choice.

export type Theme = "light" | "dark" | "auto";
const KEY = "quietude:theme";

function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolvedDark(theme: Theme): boolean {
  return theme === "dark" || (theme === "auto" && systemDark());
}

function apply(theme: Theme): void {
  const dark = resolvedDark(theme);
  document.documentElement.classList.toggle("dark", dark);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", dark ? "#1a1815" : "#efe7da");
}

export function useTheme(): {
  theme: Theme;
  dark: boolean;
  setTheme: (t: Theme) => void;
  toggle: () => void;
} {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(KEY) as Theme) || "auto";
    } catch {
      return "auto";
    }
  });
  const [dark, setDark] = useState<boolean>(() => resolvedDark(theme));

  useEffect(() => {
    apply(theme);
    setDark(resolvedDark(theme));
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  // follow the OS while in "auto"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme === "auto") {
        apply("auto");
        setDark(systemDark());
      }
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // explicit flip: choose the opposite of what's showing now
  const toggle = () => setThemeState(dark ? "light" : "dark");

  return { theme, dark, setTheme: setThemeState, toggle };
}
