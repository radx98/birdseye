"use client";

import { useEffect, useRef, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "birdseye-theme";

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

const prefersDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const applyTheme = (mode: ThemeMode) => {
  const root = document.documentElement;
  const resolved: "light" | "dark" =
    mode === "system" ? (prefersDark() ? "dark" : "light") : mode;

  root.classList.remove("light", "dark");
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.add("light");
  }
  root.dataset.theme = resolved;
  root.dataset.mode = resolved;
  root.dataset.themeMode = mode;
  root.style.colorScheme = resolved;

  const body = document.body;
  if (body) {
    body.classList.remove("light", "dark");
    if (resolved === "dark") {
      body.classList.add("dark");
    } else {
      body.classList.add("light");
    }
    body.dataset.theme = resolved;
    body.dataset.mode = resolved;
  }
};

const resolveInitialMode = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "system";
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemeMode(stored)) {
      return stored;
    }
    localStorage.setItem(STORAGE_KEY, "system");
  } catch {
    // ignore read/write errors
  }
  return "system";
};

const ThemeSwitch = () => {
  const initialMode = resolveInitialMode();
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const modeRef = useRef<ThemeMode>(initialMode);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (modeRef.current === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    modeRef.current = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore write errors (e.g. private mode)
    }
    applyTheme(mode);
  }, [mode]);

  const renderButton = (value: ThemeMode, label: string) => {
    const isActive = mode === value;
    return (
      <button
        type="button"
        key={value}
        onClick={() => setMode(value)}
        aria-pressed={isActive}
        className={[
          "inline-flex min-w-[2.25rem] items-center justify-center rounded-full border px-2 py-1 text-xs font-medium transition",
          isActive
            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
            : "border-transparent bg-transparent text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center gap-0.5 rounded-full border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
        {renderButton("light", "Light")}
        {renderButton("dark", "Dark")}
        {renderButton("system", "System")}
      </div>
    </div>
  );
};

export default ThemeSwitch;
