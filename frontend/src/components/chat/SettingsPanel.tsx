"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "next-themes";
import ThemeSwitcher from "./ThemeSwitcher";
import { getAvatarGradient } from "@/lib/avatarGradients";
import { LogOut, Palette, User, Bell, Shield, ChevronRight } from "lucide-react";

export default function SettingsPanel({
  onLogout
}: {
  onLogout: () => void;
}) {
  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="w-full md:w-80 h-full bg-[var(--color-sidebar)]/80 backdrop-blur-3xl border-r border-[var(--color-glass-border)] flex flex-col z-30 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.1)]">
      <div className="flex-1 overflow-y-auto no-scrollbar-mobile">
        {/* Profile Card */}
        <div className="p-6 pt-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-[24px] border-4 border-dashed flex items-center justify-center font-black text-3xl shadow-xl mb-4" style={{ backgroundColor: 'var(--color-bg)', borderColor: getAvatarGradient(currentUser?.name || 'U'), color: getAvatarGradient(currentUser?.name || 'U') }}>
            {currentUser?.name?.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-xl font-black text-[var(--color-text-main)]">{currentUser?.name}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{currentUser?.email}</p>
          <span className="mt-3 px-4 py-1.5 bg-green-500/10 text-green-500 text-xs font-bold rounded-full">Online</span>
        </div>

        {/* Settings Sections */}
        <div className="px-4 space-y-2 mt-4">
          <div className="px-3 py-2 text-[10px] font-bold text-[var(--color-text-secondary)] tracking-wider uppercase">
            Appearance
          </div>

          {/* Theme */}
          <div className="p-4 bg-[var(--color-glass-bg)] border-2 border-dashed border-[var(--color-border)] rounded-[20px] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[1rem] bg-[var(--color-primary)]/10 flex items-center justify-center">
                <Palette className="w-5 h-5 text-[var(--color-primary)]" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-[var(--color-text-main)]">Theme</p>
                <p className="text-xs text-[var(--color-text-secondary)] capitalize">{theme === 'cute-dark' ? 'Dark mode 🌙' : 'Light mode ☀️'}</p>
              </div>
              <ThemeSwitcher />
            </div>
          </div>

          <div className="px-3 py-2 text-[10px] font-bold text-[var(--color-text-secondary)] tracking-wider uppercase mt-4">
            Preferences
          </div>

          {/* Notifications Toggle */}
          <div
            onClick={() => setNotifications(!notifications)}
            className="flex items-center gap-3 p-4 bg-[var(--color-glass-bg)] border-2 border-dashed border-[var(--color-border)] rounded-[20px] cursor-pointer hover:scale-[1.01] transition-all"
          >
            <div className="w-10 h-10 rounded-[1rem] bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-[var(--color-text-main)]">Notifications</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Message alerts & sounds</p>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors duration-300 flex items-center px-0.5 ${notifications ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${notifications ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </div>
          </div>

          {/* Privacy */}
          <div className="flex items-center gap-3 p-4 bg-[var(--color-glass-bg)] border-2 border-dashed border-[var(--color-border)] rounded-[20px] cursor-pointer hover:scale-[1.01] transition-all">
            <div className="w-10 h-10 rounded-[1rem] bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-[var(--color-text-main)]">Privacy</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Last seen, read receipts</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </div>

          {/* Account */}
          <div className="flex items-center gap-3 p-4 bg-[var(--color-glass-bg)] border-2 border-dashed border-[var(--color-border)] rounded-[20px] cursor-pointer hover:scale-[1.01] transition-all">
            <div className="w-10 h-10 rounded-[1rem] bg-[var(--color-primary)]/10 flex items-center justify-center">
              <User className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-[var(--color-text-main)]">Account</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Edit profile, change password</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </div>
        </div>

        {/* Logout */}
        <div className="px-4 mt-6 mb-6">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 p-4 bg-red-500/10 border-2 border-dashed border-red-500/30 text-red-500 font-bold rounded-[20px] hover:bg-red-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
