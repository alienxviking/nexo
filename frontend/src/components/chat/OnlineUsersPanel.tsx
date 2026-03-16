"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { getAvatarGradient } from "@/lib/avatarGradients";
import { Search, Circle } from "lucide-react";
import { API_URL } from "@/lib/config";

interface User {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  lastSeen?: string;
}

export default function OnlineUsersPanel({
  onSelectUser
}: {
  onSelectUser: (user: User, convId: string) => void;
}) {
  const { token, user: currentUser } = useAuth();
  const { socket } = useSocket();
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchUsers();
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    const handleUserStatus = ({ userId, status, lastSeen }: any) => {
      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, status, lastSeen } : u)
      );
    };
    socket.on("user_status", handleUserStatus);
    return () => { socket.off("user_status", handleUserStatus); };
  }, [socket]);

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/users/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const usersArray = Array.isArray(data) ? data : [];
      setUsers(usersArray);
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
      onSelectUser(targetUser, conv.id);
    } catch (err) {
      console.error(err);
    }
  };

  const onlineUsers = users.filter(u => u.status === "ONLINE");
  const offlineUsers = users.filter(u => u.status !== "ONLINE");
  const filteredOnline = filter ? onlineUsers.filter(u => u.name.toLowerCase().includes(filter.toLowerCase())) : onlineUsers;
  const filteredOffline = filter ? offlineUsers.filter(u => u.name.toLowerCase().includes(filter.toLowerCase())) : offlineUsers;

  return (
    <div className="w-full md:w-80 h-full bg-[var(--color-sidebar)]/80 backdrop-blur-3xl border-r border-[var(--color-glass-border)] flex flex-col z-30 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.1)]">
      {/* Search */}
      <div className="p-4 pt-6 bg-[var(--color-sidebar)]/50">
        <div className="relative">
          <input
            type="text"
            placeholder="Search contacts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-[var(--color-bg)]/80 backdrop-blur-md text-[var(--color-text-main)] border border-[var(--color-glass-border)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 shadow-inner transition-all placeholder:text-[var(--color-text-secondary)]/70 font-medium"
          />
          <Search className="absolute left-4 top-3 text-[var(--color-text-secondary)] h-4 w-4" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1 mt-2">
        {/* Online Section */}
        {filteredOnline.length > 0 && (
          <>
            <div className="px-4 py-2 text-[10px] font-bold text-green-500 tracking-wider uppercase flex items-center gap-2">
              <Circle className="w-2 h-2 fill-green-500" />
              Online — {filteredOnline.length}
            </div>
            {filteredOnline.map(u => (
              <div
                key={u.id}
                onClick={() => startConversation(u)}
                className="flex items-center p-3 mx-1 hover:bg-[var(--color-chat-bg)]/60 cursor-pointer transition-all rounded-[2rem] group"
              >
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shadow-sm group-hover:scale-105 transition-transform text-lg" style={{ background: getAvatarGradient(u.name) }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-[var(--color-background)]"></div>
                </div>
                <div className="ml-3">
                  <p className="text-[var(--color-text-main)] font-semibold text-sm">{u.name}</p>
                  <p className="text-green-500 text-xs font-medium">Online</p>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Offline Section */}
        {filteredOffline.length > 0 && (
          <>
            <div className="px-4 py-2 text-[10px] font-bold text-[var(--color-text-secondary)] tracking-wider uppercase flex items-center gap-2 mt-4">
              <Circle className="w-2 h-2 fill-gray-400" />
              Offline — {filteredOffline.length}
            </div>
            {filteredOffline.map(u => (
              <div
                key={u.id}
                onClick={() => startConversation(u)}
                className="flex items-center p-3 mx-1 hover:bg-[var(--color-chat-bg)]/60 cursor-pointer transition-all rounded-[2rem] group opacity-60 hover:opacity-100"
              >
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shadow-sm group-hover:scale-105 transition-transform text-lg" style={{ background: getAvatarGradient(u.name) }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-[var(--color-text-main)] font-semibold text-sm">{u.name}</p>
                  <p className="text-[var(--color-text-secondary)] text-xs">
                    {u.lastSeen ? `Last seen ${format(new Date(u.lastSeen), "MMM d, h:mm a")}` : "Offline"}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}

        {filteredOnline.length === 0 && filteredOffline.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-[var(--color-text-secondary)] text-sm">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}
