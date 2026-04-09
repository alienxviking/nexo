"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (theme === "system" || !theme) {
      setTheme("cute-light");
    }
  }, [theme, setTheme]);

  if (!mounted) return null;

  const isDark = theme === "cute-dark";

  const toggle = () => {
    setTheme(isDark ? "cute-light" : "cute-dark");
  };

  return (
    <button
      onClick={toggle}
      className="no-doodle relative w-14 h-8 rounded-full transition-all duration-300 flex items-center px-1 group hover:scale-105 active:scale-95"
      style={{
        background: isDark
          ? "linear-gradient(135deg, #2D2440, #1A1520)"
          : "linear-gradient(135deg, #FFE4D6, #FFF0EC)",
        border: `2px dashed ${isDark ? "#3D2F4A" : "#F5D5CC"}`,
      }}
      title={isDark ? "Switch to Light" : "Switch to Dark"}
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
          isDark
            ? "translate-x-5 bg-indigo-400/30"
            : "translate-x-0 bg-orange-300/50"
        }`}
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-indigo-200" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-orange-500" />
        )}
      </div>
    </button>
  );
}
