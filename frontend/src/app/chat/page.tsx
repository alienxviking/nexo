"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/chat/Sidebar";
import ChatWindow from "@/components/chat/ChatWindow";
import OnlineUsersPanel from "@/components/chat/OnlineUsersPanel";
import SettingsPanel from "@/components/chat/SettingsPanel";
import ThemeSwitcher from "@/components/chat/ThemeSwitcher";
import { MessageSquare, Users, Settings, LogOut, ChevronLeft } from "lucide-react";
import { useTheme } from "next-themes";

interface User {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  lastSeen?: string;
}

type NavTab = "chats" | "users" | "settings";

export default function ChatPage() {
  const { user, token, logout, isLoading } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>("chats");
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && (!token || !user)) {
      router.push("/");
    }
  }, [isLoading, token, user, router]);

  if (isLoading || !token || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-transparent text-[var(--color-text-main)]">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-[var(--color-primary)] opacity-20 blur-3xl rounded-full animate-pulse"></div>
          <div className="relative w-20 h-20 bg-[var(--color-primary)] rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-[var(--color-primary)]/40 rotate-3 animate-bounce-slow">
            <span className="text-[var(--color-background)] font-black text-4xl">N</span>
          </div>
        </div>
        <p className="text-sm font-semibold text-[var(--color-text-secondary)] animate-pulse tracking-widest uppercase">Loading Nexo</p>
      </div>
    );
  }

  const handleSelectConversation = (selectedUser: User, conversationId: string) => {
    setActiveUser(selectedUser);
    setActiveConversationId(conversationId);
    setActiveTab("chats");
    setShowChat(true); // Switch to chat view on mobile
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const navItems: { tab: NavTab; icon: typeof MessageSquare; label: string }[] = [
    { tab: "chats", icon: MessageSquare, label: "Chats" },
    { tab: "users", icon: Users, label: "Contacts" },
    { tab: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="h-[100dvh] w-full flex flex-col md:flex-row bg-transparent overflow-hidden overflow-x-hidden md:p-3 md:gap-3">
      {/* Navigation Rail - Desktop */}
      <div className="hidden md:flex w-20 bg-[var(--color-sidebar)] border-2 border-dashed border-[var(--color-border)] flex-col items-center py-8 z-40 transition-colors duration-300 rounded-[20px]">
        <div className="w-12 h-12 bg-[var(--color-primary)] rounded-[14px] flex items-center justify-center text-white font-black text-2xl mb-10 shadow-lg rotate-3 transition-all hover:rotate-12 hover:scale-110 cursor-pointer hover-jiggle" style={{ boxShadow: '0 8px 20px -6px var(--color-primary)' }}>
          N
        </div>

        <div className="flex flex-col space-y-4 flex-1">
          {navItems.map(({ tab, icon: Icon, label }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`no-doodle relative w-12 h-12 flex flex-col items-center justify-center rounded-[14px] transition-all hover:scale-110 active:scale-95 ${activeTab === tab
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-chat-bg)]"
                }`}
              title={label}
            >
              <Icon className="w-6 h-6" />
              {activeTab === tab && (
                <div className="absolute -bottom-1.5 w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full"></div>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center space-y-4 w-full">
          {mounted && activeTab !== "settings" && <ThemeSwitcher />}

          <button
            onClick={handleLogout}
            className="no-doodle p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-[14px] transition-colors mt-auto"
            title="Logout"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Side Panel — all panels stay mounted, hidden when inactive */}
      <div className={`flex-1 md:flex-none md:w-80 h-full ${showChat ? 'hidden md:block' : 'block md:block'} rounded-none md:rounded-[20px] overflow-hidden border-b md:border-2 md:border-dashed border-[var(--color-border)] shadow-sm transition-all duration-300`}>
        <div className={`h-full ${activeTab === "chats" ? "block" : "hidden"}`}>
          <Sidebar
            onSelectConversation={handleSelectConversation}
            activeId={activeConversationId}
          />
        </div>
        <div className={`h-full ${activeTab === "users" ? "block" : "hidden"}`}>
          <OnlineUsersPanel
            onSelectUser={handleSelectConversation}
          />
        </div>
        <div className={`h-full ${activeTab === "settings" ? "block" : "hidden"}`}>
          <SettingsPanel onLogout={handleLogout} />
        </div>
      </div>

      {/* Chat Window */}
      <div className={`flex-1 h-full ${!showChat ? 'hidden md:block' : 'block md:block'} rounded-none md:rounded-[20px] overflow-hidden border-b md:border-2 md:border-dashed border-[var(--color-border)] shadow-sm transition-all duration-300`}>
        {activeUser && activeConversationId ? (
          <ChatWindow
            conversationId={activeConversationId as string}
            activeUser={activeUser as User}
            onBack={() => setShowChat(false)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center h-full bg-[var(--color-glass-bg)] backdrop-blur-md text-[var(--color-text-secondary)] p-12 text-center animate-in fade-in duration-700">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-[var(--color-primary)] opacity-20 blur-3xl rounded-full animate-pulse"></div>
              <div className="relative w-28 h-28 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-[var(--color-primary)]/40 rotate-6 hover:rotate-12 transition-transform duration-500 animate-bounce-slow">
                <MessageSquare className="w-12 h-12 text-[var(--color-background)]" />
              </div>
            </div>
            <h3 className="text-3xl font-black text-[var(--color-text-main)] mb-3 tracking-tight bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-text-main)] bg-clip-text text-transparent">
              Welcome to Nexo
            </h3>
            <p className="max-w-sm text-lg font-medium opacity-80 leading-relaxed text-[var(--color-text-secondary)]">
              Select a conversation from the sidebar to start a bubbly chat!
            </p>
            <div className="mt-10 flex gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]/20 animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]/40 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]/20 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav - Mobile */}
      {!showChat && (
        <div className="md:hidden flex-none flex bg-[var(--color-sidebar)] border-t-2 border-dashed border-[var(--color-border)] p-4 pb-8 items-center justify-around z-50">
          {navItems.map(({ tab, icon: Icon, label }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex flex-col items-center gap-1 ${activeTab === tab ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"}`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
              {activeTab === tab && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"></div>}
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 text-red-500"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Exit</span>
          </button>
        </div>
      )}
    </div>
  );
}
