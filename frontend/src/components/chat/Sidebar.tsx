"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { Search, MessageSquare, X } from "lucide-react";
import { getAvatarGradient } from "@/lib/avatarGradients";
import { API_URL } from "@/lib/config";

interface User {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  lastSeen?: string;
}

interface Conversation {
  id: string;
  participants: User[];
  messages: any[];
}

interface Toast {
  id: string;
  sender: string;
  text: string;
  convId: string;
}

export default function Sidebar({
  onSelectConversation,
  activeId
}: {
  onSelectConversation: (user: User, id: string) => void;
  activeId: string | null;
}) {
  const { token, user: currentUser } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    fetchConversations();
  }, [token]);

  // Clear unread when user opens a conversation
  useEffect(() => {
    if (activeId) {
      setUnreadCounts(prev => {
        const next = { ...prev };
        delete next[activeId];
        return next;
      });
    }
  }, [activeId]);

  useEffect(() => {
    if (!socket) return;
    
    const handleUserStatus = ({ userId, status, lastSeen }: any) => {
      setConversations(prev => 
        prev.map(conv => ({
          ...conv,
          participants: conv.participants.map(p => 
            p.id === userId ? { ...p, status, lastSeen } : p
          )
        }))
      );
    };

    const handleNewMessage = (message: any) => {
      // Update last message in sidebar
      setConversations(prev => {
        const exists = prev.find(c => c.id === message.conversationId);
        if (exists) {
          return prev.map(c => 
            c.id === message.conversationId 
              ? { ...c, messages: [message] }
              : c
          );
        }
        // If conversation doesn't exist in list, re-fetch
        fetchConversations();
        return prev;
      });

      // Track unread if not the active conversation and not sent by current user
      if (message.conversationId !== activeId && message.senderId !== currentUser?.id) {
        setUnreadCounts(prev => ({
          ...prev,
          [message.conversationId]: (prev[message.conversationId] || 0) + 1,
        }));

        // Find the sender name
        const conv = conversations.find(c => c.id === message.conversationId);
        const sender = conv?.participants.find(p => p.id === message.senderId);
        const senderName = sender?.name || "Someone";

        // Show toast
        const toastId = `${message.id}-${Date.now()}`;
        setToasts(prev => [...prev, { 
          id: toastId, 
          sender: senderName, 
          text: message.content?.slice(0, 60) || "Sent an attachment",
          convId: message.conversationId 
        }]);

        // Auto dismiss after 4s
        toastTimeouts.current[toastId] = setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toastId));
          delete toastTimeouts.current[toastId];
        }, 4000);
      }
    };

    socket.on("user_status", handleUserStatus);
    socket.on("receive_message", handleNewMessage);

    return () => {
      socket.off("user_status", handleUserStatus);
      socket.off("receive_message", handleNewMessage);
    }
  }, [socket, activeId, currentUser?.id, conversations]);

  const dismissToast = (toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
    if (toastTimeouts.current[toastId]) {
      clearTimeout(toastTimeouts.current[toastId]);
      delete toastTimeouts.current[toastId];
    }
  };

  const handleToastClick = (toast: Toast) => {
    const conv = conversations.find(c => c.id === toast.convId);
    const otherUser = conv?.participants.find(p => p.id !== currentUser?.id);
    if (otherUser && conv) {
      onSelectConversation(otherUser, conv.id);
    }
    dismissToast(toast.id);
  };

  const fetchConversations = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/users/search?query=${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    }
  };

  const startConversation = async (targetUser: User) => {
    try {
      const res = await fetch(`${API_URL}/api/conversations/get-or-create`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ targetUserId: targetUser.id })
      });
      const conv = await res.json();
      
      setSearchQuery("");
      setSearchResults([]);
      onSelectConversation(targetUser, conv.id);
      fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full md:w-80 h-full bg-[var(--color-sidebar)]/80 backdrop-blur-3xl border-r border-[var(--color-glass-border)] flex flex-col z-30 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.1)] relative">
      
      {/* Toast notifications */}
      <div className="absolute top-0 left-0 right-0 z-50 p-2 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => handleToastClick(toast)}
            className="pointer-events-auto bg-[var(--color-primary)] text-[var(--color-background)] px-4 py-3 rounded-[1.5rem] shadow-xl flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-all animate-in fade-in mx-1"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ring-2 ring-white/30" style={{ background: getAvatarGradient(toast.sender) }}>
              {toast.sender.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{toast.sender}</p>
              <p className="text-xs opacity-80 truncate">{toast.text}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="p-4 bg-[var(--color-sidebar)]/50">
        <div className="relative group">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-[var(--color-bg)]/80 backdrop-blur-md text-[var(--color-text-main)] border border-[var(--color-glass-border)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 shadow-inner transition-all placeholder:text-[var(--color-text-secondary)]/70 font-medium"
          />
          <Search className="absolute left-4 top-3 text-[var(--color-text-secondary)] h-4 w-4 transition-colors" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1 mt-2 flex flex-col">
        {searchQuery ? (
          <div>
            <div className="px-3 py-2 text-[10px] font-bold text-[var(--color-text-secondary)] tracking-wider uppercase mb-1">Search Results</div>
            {searchResults.map(u => (
              <div 
                key={u.id}
                onClick={() => startConversation(u)}
                className="flex items-center p-3 mx-1 hover:bg-[var(--color-chat-bg)]/60 cursor-pointer transition-all rounded-2xl group"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm group-hover:scale-105 transition-transform text-lg" style={{ background: getAvatarGradient(u.name) }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="ml-4">
                  <p className="text-[var(--color-text-main)] font-semibold">{u.name}</p>
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length > 0 ? (
          conversations.map(conv => {
            const otherUser = conv.participants.find(p => p.id !== currentUser?.id);
            if (!otherUser) return null;
            const lastMessage = conv.messages?.[0];
            const unread = unreadCounts[conv.id] || 0;

            const renderMessagePreview = (msg: any) => {
              if (!msg) return "Start a conversation";
              if (msg.isDeleted) return "🚫 This message was deleted";
              if (msg.type === "IMAGE") return "📷 Photo";
              if (msg.type === "VOICE") return "🎤 Voice message";
              if (msg.type === "FILE") return "📎 File";
              return msg.content;
            };

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(otherUser, conv.id)}
                className={`flex items-center p-4 mb-2 mx-2 cursor-pointer transition-all rounded-[2rem] group ${
                  activeId === conv.id 
                    ? "bg-[var(--color-glass-bg)] ring-1 ring-[var(--color-primary)]/20 shadow-md scale-[1.02]"
                    : "hover:bg-[var(--color-chat-bg)]/60 hover:shadow-sm border border-transparent"
                }`}
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl text-white shadow-sm transition-transform group-hover:scale-105" style={{ background: getAvatarGradient(otherUser.name) }}>
                    {otherUser.name.charAt(0).toUpperCase()}
                  </div>
                  {otherUser.status === "ONLINE" && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full shadow-sm z-10 border border-[var(--color-background)]"></div>
                  )}
                </div>
                <div className="ml-4 flex-1 overflow-hidden">
                  <div className="flex justify-between items-baseline">
                    <p className={`font-semibold truncate ${activeId === conv.id ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}>{otherUser.name}</p>
                    {/* Unread badge */}
                    {unread > 0 && (
                      <span className="ml-2 shrink-0 min-w-[22px] h-[22px] flex items-center justify-center bg-[var(--color-primary)] text-[var(--color-background)] text-[11px] font-bold rounded-full px-1.5 shadow-md animate-in fade-in">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm truncate ${unread > 0 ? 'text-[var(--color-text-main)] font-semibold' : 'text-[var(--color-text-secondary)]'}`}>
                    {renderMessagePreview(lastMessage)}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-[var(--color-primary)]/10 rounded-[1.5rem] flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-[var(--color-primary)] opacity-60" />
            </div>
            <p className="text-[var(--color-text-secondary)] text-sm font-medium">No conversations yet</p>
            <p className="text-[var(--color-text-secondary)]/60 text-xs mt-1">Search for a user to start chatting!</p>
          </div>
        )}
      </div>
    </div>
  );
}
