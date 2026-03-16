"use client";

import { useTheme } from "next-themes";
import { useState, useEffect, useRef } from "react";
import { Palette, Check } from "lucide-react";

const themes = [
  { name: "Strawberry Milk", value: "strawberry", type: "light", color: "#C0436E", bg: "#FFF5F7" },
  { name: "Lavender Dream", value: "lavender", type: "light", color: "#4B3FA0", bg: "#F4F2FD" },
  { name: "Matcha Latte", value: "matcha", type: "light", color: "#3B6D11", bg: "#F3F8ED" },
  { name: "Peach Sorbet", value: "peach", type: "light", color: "#993C1D", bg: "#FFF7F2" },
  { name: "Midnight Rose", value: "midnight-rose", type: "dark", color: "#C0436E", bg: "#1E1018" },
  { name: "Galaxy Dust", value: "galaxy-dust", type: "dark", color: "#7F77DD", bg: "#100E1E" },
  { name: "Forest Night", value: "forest-night", type: "dark", color: "#639922", bg: "#0B1409" },
  { name: "Ember Glow", value: "ember-glow", type: "dark", color: "#D85A30", bg: "#180D08" },
  { name: "Clean Light", value: "clean-light", type: "light", color: "#1A73E8", bg: "#FFFFFF" },
  { name: "Clean Dark", value: "clean-dark", type: "dark", color: "#3B82F6", bg: "#141414" },
];

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    
    // Default theme if system
    if (theme === "system" || !theme) {
      setTheme("clean-light");
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [theme, setTheme]);

  if (!mounted) return null;

  const currentTheme = themes.find(t => t.value === theme) || themes[8];

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-main)] rounded-xl transition-colors relative group"
        title="Change Theme"
      >
        <Palette className="w-6 h-6" />
        {/* Color indicator dot */}
        <span 
          className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full border border-white dark:border-gray-800 shadow-sm"
          style={{ backgroundColor: currentTheme.color }}
        />
      </button>

      {isOpen && (
        <div className="absolute left-full bottom-0 ml-4 mb-0 w-64 bg-[var(--color-glass-bg)] backdrop-blur-3xl border border-[var(--color-glass-border)] rounded-2xl shadow-2xl p-2 z-[100] flex flex-col gap-1 max-h-[80vh] overflow-y-auto">
          <div className="px-3 py-2 border-b border-[var(--color-glass-border)] mb-1">
            <h3 className="text-sm font-bold text-[var(--color-text-main)]">App Themes</h3>
            <p className="text-[10px] text-[var(--color-text-secondary)] font-medium">Select your aesthetic ✨</p>
          </div>
          
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setTheme(t.value);
                setIsOpen(false);
              }}
              className={`flex items-center w-full px-3 py-2.5 rounded-xl transition-all text-left group ${
                theme === t.value 
                  ? "bg-[var(--color-bg)] shadow-inner ring-1 ring-[var(--color-primary)]/20" 
                  : "hover:bg-[var(--color-bg)]/80"
              }`}
            >
              <div 
                className={`w-6 h-6 rounded-full border border-black/10 shadow-sm mr-3 flex items-center justify-center shrink-0 ${theme === t.value ? 'ring-2 ring-offset-1 ring-offset-[var(--color-bg)]' : 'group-hover:scale-110 transition-transform'}`}
                style={{ backgroundColor: t.bg, borderColor: t.type === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              </div>
              <span className={`text-sm font-medium flex-1 truncate ${theme === t.value ? 'text-[var(--color-primary)] font-bold' : 'text-[var(--color-text-main)]'}`}>
                {t.name}
              </span>
              {theme === t.value && (
                <Check className="w-4 h-4 text-[var(--color-primary)] md:ml-2" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
