"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { Send, Image as ImageIcon, Paperclip, MoreVertical, Check, CheckCheck, Mic, Square, File as FileIcon, Play, Pause, Search, Clock, Bomb, X, Smile, Plus, ArrowDown, Download } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import EmojiPicker, { Theme, Emoji, EmojiStyle } from "emoji-picker-react";

const isOnlyEmoji = (str: string) => {
  // Regex for emojis only (including multiple emojis and spaces)
  const emojiRegex = /^(\p{Extended_Pictographic}|\s)+$/u;
  return emojiRegex.test(str.trim());
};

const getEmojiUnified = (emoji: string) => {
  return Array.from(emoji)
    .map(char => char.codePointAt(0)?.toString(16).toLowerCase())
    .filter(Boolean)
    .join("-");
};
import { getAvatarGradient } from "@/lib/avatarGradients";
import VoicePlayer from "./VoicePlayer";
import { API_URL } from "@/lib/config";

interface User {
  id: string;
  name: string;
  status: string;
  lastSeen?: string;
}

interface Reaction {
  id: string;
  emoji: string;
  user: { id: string; name: string };
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  status: "SENT" | "DELIVERED" | "SEEN";
  createdAt: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  replyTo?: { id: string; content: string; sender: { id: string; name: string } } | null;
  reactions?: Reaction[];
  type?: "TEXT" | "IMAGE" | "FILE" | "VOICE";
  fileUrl?: string;
}

export default function ChatWindow({
  activeUser,
  conversationId,
}: {
  activeUser: User;
  conversationId: string;
}) {
  const { token, user: currentUser } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentActiveUser, setCurrentActiveUser] = useState<User>(activeUser);
  
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  
  const [scheduleTime, setScheduleTime] = useState("");
  const [selfDestructTimer, setSelfDestructTimer] = useState<number | null>(null); // in seconds

  // Smart scroll state
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMsgToast, setNewMsgToast] = useState<{ sender: string; text: string } | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const newMsgToastTimeout = useRef<NodeJS.Timeout | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentActiveUser(activeUser);
  }, [activeUser]);

  useEffect(() => {
    fetchMessages();
  }, [conversationId, token]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message: Message) => {
      if (message.conversationId === conversationId) {
        setMessages((prev) => [...prev, message]);
        socket.emit("mark_all_seen", { 
          conversationId, 
          senderId: message.senderId 
        });

        // Smart scroll: only auto-scroll if user is near the bottom
        const container = messagesContainerRef.current;
        if (container) {
          const threshold = 150;
          const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
          if (atBottom) {
            setTimeout(() => scrollToBottom(), 100);
          } else {
            // Show toast for new message
            setNewMsgToast({ sender: currentActiveUser.name, text: message.content.slice(0, 50) });
            if (newMsgToastTimeout.current) clearTimeout(newMsgToastTimeout.current);
            newMsgToastTimeout.current = setTimeout(() => setNewMsgToast(null), 4000);
          }
        }
      }
    };

    const handleMessageSent = (message: any) => {
      setMessages((prev) => {
        const tempId = message.tempId;
        const exists = prev.find(m => m.id === message.id);
        if (exists) return prev;

        const filtered = tempId ? prev.filter(m => m.id !== tempId) : prev;
        return [...filtered, message];
      });
      // Always scroll to bottom for own messages
      setTimeout(() => scrollToBottom(), 100);
    };

    const handleMessageDelivered = ({ messageId }: any) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: "DELIVERED" } : m))
      );
    };

    const handleMessageSeen = ({ messageId, conversationId: convId }: any) => {
      if (convId === conversationId) {
        setMessages((prev) =>
           prev.map((m) => (m.id === messageId ? { ...m, status: "SEEN" } : m))
        );
      }
    };

    const handleConversationSeen = ({ conversationId: convId }: any) => {
      if (convId === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m.senderId === currentUser?.id ? { ...m, status: "SEEN" } : m))
        );
      }
    };

    const handleTyping = ({ userId, conversationId: convId }: any) => {
      if (userId === currentActiveUser.id && convId === conversationId) {
        setIsTyping(true);
        // Scroll down to show the typing indicator if near bottom
        const container = messagesContainerRef.current;
        if (container) {
          const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
          if (atBottom) setTimeout(() => scrollToBottom(), 100);
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
      }
    };

    const handleMessageEdited = (updatedMsg: Message) => {
      setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
    };

    const handleMessageDeleted = (deletedMsg: Message) => {
      setMessages((prev) => prev.map((m) => (m.id === deletedMsg.id ? deletedMsg : m)));
    };

    const handleReactionAdded = ({ messageId, reaction }: any) => {
      setMessages((prev) => prev.map((m) => {
        if (m.id === messageId) {
          const reactions = m.reactions || [];
          const filtered = reactions.filter(r => r.user.id !== reaction.user.id);
          return { ...m, reactions: [...filtered, reaction] };
        }
        return m;
      }));
    };

    const handleReactionRemoved = ({ messageId, reactionId }: any) => {
      setMessages((prev) => prev.map((m) => {
        if (m.id === messageId) {
          const reactions = m.reactions || [];
          return { ...m, reactions: reactions.filter(r => r.id !== reactionId) };
        }
        return m;
      }));
    };

    const handleUserStatus = ({ userId, status, lastSeen }: any) => {
      if (userId === currentActiveUser.id) {
        setCurrentActiveUser(prev => ({ ...prev, status, lastSeen }));
      }
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("message_sent", handleMessageSent);
    socket.on("message_delivered", handleMessageDelivered);
    socket.on("message_seen", handleMessageSeen);
    socket.on("conversation_seen", handleConversationSeen);
    socket.on("typing", handleTyping);
    socket.on("message_edited", handleMessageEdited);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("reaction_added", handleReactionAdded);
    socket.on("reaction_removed", handleReactionRemoved);
    socket.on("user_status", handleUserStatus);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("message_sent", handleMessageSent);
      socket.off("message_delivered", handleMessageDelivered);
      socket.off("message_seen", handleMessageSeen);
      socket.off("conversation_seen", handleConversationSeen);
      socket.off("typing", handleTyping);
      socket.off("message_edited", handleMessageEdited);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("reaction_added", handleReactionAdded);
      socket.off("reaction_removed", handleReactionRemoved);
      socket.off("user_status", handleUserStatus);
    };
  }, [socket, conversationId, currentActiveUser.id]);

  useEffect(() => {
    // Only auto-scroll on initial load / conversation switch
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [conversationId]);

  // Track scroll position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const threshold = 150;
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      setIsNearBottom(atBottom);
      if (atBottom) setNewMsgToast(null);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(data);
      scrollToBottom();
      
      // Mark loaded unread messages from the other user as SEEN
      if (socket && Array.isArray(data)) {
        const hasUnread = data.some((msg: Message) => msg.senderId === currentActiveUser.id && msg.status !== "SEEN");
        if (hasUnread) {
          socket.emit("mark_all_seen", {
            conversationId,
            senderId: currentActiveUser.id
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !currentUser) return;

    const content = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();

    if (editingMessage) {
      // For editing, we update immediately locally too
      setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content, isEdited: true } : m));
      
      socket.emit("edit_message", {
        messageId: editingMessage.id,
        newContent: content,
        conversationId,
        receiverId: currentActiveUser.id,
      });
      setEditingMessage(null);
    } else {
      let scheduledAtDate = null;
      if (scheduleTime) {
        scheduledAtDate = new Date(scheduleTime).toISOString();
      }
      
      let selfDestructAtDate = null;
      if (selfDestructTimer) {
        selfDestructAtDate = new Date(Date.now() + selfDestructTimer * 1000).toISOString();
      }

      // Optimistic message
      if (!scheduledAtDate) {
        const optimisticMsg: Message = {
          id: tempId,
          content,
          senderId: currentUser.id,
          conversationId,
          status: "SENT",
          createdAt: now,
          type: "TEXT",
          replyTo: replyingTo ? {
            id: replyingTo.id,
            content: replyingTo.content,
            sender: { id: replyingTo.senderId, name: replyingTo.senderId === currentUser.id ? currentUser.name : currentActiveUser.name }
          } : null,
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setTimeout(() => scrollToBottom(), 50);
      }

      socket.emit("send_message", {
        conversationId,
        receiverId: currentActiveUser.id,
        content,
        replyToId: replyingTo?.id || null,
        scheduledAt: scheduledAtDate,
        selfDestructAt: selfDestructAtDate,
        tempId, // Pass tempId so server can echo it back
      });
    }

    setNewMessage("");
    setReplyingTo(null);
    setScheduleTime("");
    setSelfDestructTimer(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
  };

  const startEdit = (msg: Message) => {
    setEditingMessage(msg);
    setNewMessage(msg.content);
    setReplyingTo(null);
    setActiveMenu(null);
    setTimeout(() => {
      const input = messageInputRef.current;
      if (input) {
        input.focus();
        input.setSelectionRange(msg.content.length, msg.content.length);
      }
    }, 50);
  };

  const startReply = (msg: Message) => {
    setReplyingTo(msg);
    setEditingMessage(null);
    setActiveMenu(null);
    setTimeout(() => messageInputRef.current?.focus(), 50);
  };

  const deleteMessage = () => {
    if (!socket || !messageToDelete) return;
    socket.emit("delete_message", {
      messageId: messageToDelete,
      conversationId,
      receiverId: currentActiveUser.id
    });
    setMessageToDelete(null);
    setActiveMenu(null);
  };

  const addReaction = (msgId: string, emoji: string) => {
    if (!socket) return;
    socket.emit("add_reaction", {
      messageId: msgId,
      emoji,
      conversationId,
      receiverId: currentActiveUser.id
    });
    setActiveMenu(null);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      setUploading(false);
      return data.url;
    } catch (err) {
      console.error("Upload error", err);
      setUploading(false);
      return null;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, msgType: "IMAGE" | "FILE") => {
    const file = e.target.files?.[0];
    if (!file || !socket) return;
    
    setShowAttachMenu(false);
    const url = await uploadFile(file);
    if (!url) return;

    socket.emit("send_message", {
      conversationId,
      receiverId: currentActiveUser.id,
      content: file.name,
      fileUrl: url,
      type: msgType,
      replyToId: replyingTo?.id || null,
    });
    setReplyingTo(null);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const file = new File([blob], "voice_message.webm", { type: 'audio/webm' });
          const url = await uploadFile(file);
          if (url && socket) {
            socket.emit("send_message", {
              conversationId,
              receiverId: currentActiveUser.id,
              content: "Voice Message",
              fileUrl: url,
              type: "VOICE",
              replyToId: replyingTo?.id || null,
            });
          }
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error accessing microphone:", err);
      }
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/conversations/${conversationId}/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Search error", err);
    }
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(msgId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  const closeSearch = () => {
    setIsSearching(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (socket) {
      socket.emit("typing", { conversationId, receiverId: activeUser.id });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--color-bg)] relative bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-sidebar)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-xl shadow-sm z-20 sticky top-0 m-2 rounded-[2rem]">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-white/10" style={{ background: getAvatarGradient(currentActiveUser.name) }}>
              {currentActiveUser.name.charAt(0)}
            </div>
            {currentActiveUser.status === "ONLINE" && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[var(--color-chat-bg)] rounded-full shadow-sm"></span>
            )}
          </div>
          <div>
            <h2 className="font-semibold text-[var(--color-text-main)]">{currentActiveUser.name}</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {isTyping ? (
                <span className="italic text-[var(--color-primary)] font-medium">typing...</span>
              ) : currentActiveUser.status === "ONLINE" ? (
                <span className="text-green-500 font-medium">Online</span>
              ) : (
                <span>Last seen {currentActiveUser.lastSeen ? format(new Date(currentActiveUser.lastSeen), "MMM d, h:mm a") : "recently"}</span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {isSearching ? (
             <form onSubmit={handleSearch} className="flex items-center bg-[var(--color-bg)] rounded-full px-3 py-1 border border-[var(--color-primary)] transition-all">
               <input
                 type="text"
                 autoFocus
                 value={searchQuery}
                 onChange={(e) => { setSearchQuery(e.target.value); }}
                 onKeyUp={() => handleSearch()}
                 placeholder="Search messages..."
                 className="bg-transparent border-none focus:outline-none text-sm w-40 text-[var(--color-text-main)]"
               />
               <button type="button" onClick={closeSearch} className="text-[var(--color-text-secondary)] ml-2 hover:text-red-500"><X className="w-4 h-4" /></button>
             </form>
          ) : (
            <button onClick={() => setIsSearching(true)} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors rounded-full hover:bg-[var(--color-bg)]">
              <Search className="w-5 h-5" />
            </button>
          )}
          <div className="relative">
            <button onClick={() => setShowHeaderMenu(!showHeaderMenu)} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors rounded-full hover:bg-[var(--color-bg)]">
              <MoreVertical className="w-5 h-5" />
            </button>
            {showHeaderMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-lg py-2 z-50">
                <button className="w-full text-left px-4 py-2 text-sm text-[var(--color-text-main)] hover:bg-[var(--color-chat-bg)]">Contact Info</button>
                <button className="w-full text-left px-4 py-2 text-sm text-[var(--color-text-main)] hover:bg-[var(--color-chat-bg)]">Mute Notifications</button>
                <div className="h-px bg-[var(--color-border)] my-1"></div>
                <button className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[var(--color-chat-bg)]">Block User</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isSearching && searchResults.length > 0 && (
        <div className="bg-[var(--color-glass-bg)] backdrop-blur-xl border-b border-[var(--color-glass-border)] max-h-52 overflow-y-auto mx-2 rounded-b-2xl shadow-md">
          <div className="px-4 py-2 text-[10px] font-bold text-[var(--color-text-secondary)] tracking-wider uppercase">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </div>
          {searchResults.map(msg => (
            <div
              key={msg.id}
              onClick={() => scrollToMessage(msg.id)}
              className="px-4 py-3 hover:bg-[var(--color-chat-bg)]/60 cursor-pointer transition-colors border-b border-[var(--color-glass-border)]/30 last:border-0"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-[var(--color-primary)]">{(msg as any).sender?.name || 'You'}</span>
                <span className="text-[10px] text-[var(--color-text-secondary)]">{format(new Date(msg.createdAt), "MMM d, h:mm a")}</span>
              </div>
              <p className="text-sm text-[var(--color-text-main)] truncate mt-0.5">{msg.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Messages Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4 relative">
        {messages.map((msg, index) => {
          const isMe = msg.senderId === currentUser?.id;
          const isEmojiOnly = !msg.isDeleted && msg.type === "TEXT" && isOnlyEmoji(msg.content);
          const showTime = index === 0 || new Date(msg.createdAt).getTime() - new Date(messages[index - 1].createdAt).getTime() > 300000; // 5 mins

          return (
            <div key={msg.id} id={`msg-${msg.id}`} className={`flex flex-col ${isMe ? "items-end" : "items-start"} relative group`}>
              {showTime && (
                <div className="flex items-center gap-3 my-4 self-center w-full max-w-xs">
                  <div className="flex-1 h-px bg-[var(--color-border)]/50"></div>
                  <span className="text-[10px] font-semibold text-[var(--color-text-secondary)] bg-[var(--color-glass-bg)] backdrop-blur-sm px-4 py-1.5 rounded-full border border-[var(--color-glass-border)] shadow-sm whitespace-nowrap">
                    {(() => {
                      const d = new Date(msg.createdAt);
                      if (isToday(d)) return `Today, ${format(d, "h:mm a")}`;
                      if (isYesterday(d)) return `Yesterday, ${format(d, "h:mm a")}`;
                      return format(d, "MMM d, h:mm a");
                    })()}
                  </span>
                  <div className="flex-1 h-px bg-[var(--color-border)]/50"></div>
                </div>
              )}
              <div className="flex items-center space-x-2">
                {isMe && (
                  <div className={`opacity-0 group-hover:opacity-100 transition-all duration-200 scale-95 group-hover:scale-100 bg-[var(--color-chat-bg)] border border-[var(--color-border)] rounded-full px-2 py-1 shadow-sm flex items-center space-x-2 ${activeMenu === msg.id ? 'opacity-100 scale-100' : ''}`}>
                    <button onClick={() => addReaction(msg.id, "👍")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                      <Emoji unified={getEmojiUnified("👍")} size={18} emojiStyle={EmojiStyle.APPLE} />
                    </button>
                    <button onClick={() => addReaction(msg.id, "❤️")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                      <Emoji unified={getEmojiUnified("❤️")} size={18} emojiStyle={EmojiStyle.APPLE} />
                    </button>
                    <button onClick={() => addReaction(msg.id, "😂")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                      <Emoji unified={getEmojiUnified("😂")} size={18} emojiStyle={EmojiStyle.APPLE} />
                    </button>
                    <button onClick={() => startReply(msg)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] text-xs font-semibold px-1">Reply</button>
                    {msg.content !== "This message was deleted" && !msg.isDeleted && (
                      <>
                        <button onClick={() => startEdit(msg)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] text-xs font-semibold px-1">Edit</button>
                        <button onClick={() => setMessageToDelete(msg.id)} className="text-[var(--color-text-secondary)] hover:text-red-500 text-xs font-semibold px-1">Delete</button>
                      </>
                    )}
                  </div>
                )}
                
                <div
                  className={`max-w-[70%] ${isEmojiOnly ? "p-0" : "px-5 py-3 rounded-[2rem]"} ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'} ${
                    msg.isDeleted ? "bg-transparent border border-dashed border-[var(--color-border)] text-[var(--color-text-secondary)] italic" :
                    isEmojiOnly ? "bg-transparent shadow-none" :
                    isMe
                      ? "bg-[var(--color-primary)] text-[var(--color-background)] shadow-[0_2px_10px_-4px_var(--color-primary)]"
                      : "bg-[var(--color-glass-bg)] backdrop-blur-md text-[var(--color-text-main)] border border-[var(--color-glass-border)] shadow-sm"
                  }`}
                >
                  {msg.replyTo && !msg.isDeleted && (
                    <div
                      onClick={() => scrollToMessage(msg.replyTo!.id)}
                      className={`text-xs p-2 rounded-lg mb-2 opacity-80 border-l-2 cursor-pointer hover:opacity-100 transition-opacity ${isMe ? "bg-white/20 border-white/40" : "bg-[var(--color-border)] border-[var(--color-primary)]"} truncate`}
                    >
                      <span className="font-semibold block">{msg.replyTo.sender.id === currentUser?.id ? 'You' : currentActiveUser.name}</span>
                      {msg.replyTo.content}
                    </div>
                  )}

                  {!msg.isDeleted && msg.type === "IMAGE" && msg.fileUrl && (
                    <img src={`${API_URL}${msg.fileUrl}`} alt="Sent image" className="max-w-full h-auto max-h-60 rounded-xl mb-2 object-contain" />
                  )}
                  
                  {!msg.isDeleted && msg.type === "FILE" && msg.fileUrl && (
                    <a href={`${API_URL}${msg.fileUrl}`} target="_blank" rel="noreferrer" className={`group flex items-center space-x-3 p-3 rounded-2xl mb-2 backdrop-blur-md border transition-all hover:scale-[1.02] ${isMe ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-[var(--color-glass-bg)] border-[var(--color-glass-border)] text-[var(--color-text-main)] shadow-sm hover:bg-[var(--color-bg)]/50'} no-underline`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20' : 'bg-[var(--color-primary)]/10'}`}>
                        <FileIcon className={`w-5 h-5 ${isMe ? 'text-white' : 'text-[var(--color-primary)]'}`} />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                         <span className="text-sm font-semibold truncate max-w-[150px] leading-tight">{msg.content}</span>
                         <span className={`text-[10px] mt-0.5 ${isMe ? 'text-white/70' : 'text-[var(--color-text-secondary)]'}`}>Click to download</span>
                      </div>
                      <Download className={`w-4 h-4 ml-1 opacity-50 group-hover:opacity-100 transition-opacity shrink-0 ${isMe ? 'text-white' : 'text-[var(--color-primary)]'}`} />
                    </a>
                  )}

                  {!msg.isDeleted && msg.type === "VOICE" && msg.fileUrl && (
                    <div className="mb-1">
                      <VoicePlayer src={`${API_URL}${msg.fileUrl}`} isMe={isMe} />
                    </div>
                  )}

                  {(msg.type === "TEXT" || msg.isDeleted) && (
                    <div className={`leading-relaxed break-words ${isEmojiOnly ? "flex flex-wrap gap-1 my-2" : "text-[15px]"}`}>
                      {isEmojiOnly ? (
                        msg.content.match(/(\p{Extended_Pictographic}+(?:\u{200D}\p{Extended_Pictographic}+)*|\p{Emoji_Presentation}|\s)/gu)?.map((char, i) => (
                           char.trim() === "" ? <span key={i} className="w-2" /> : <Emoji key={i} unified={getEmojiUnified(char)} size={64} emojiStyle={EmojiStyle.APPLE} />
                        ))
                      ) : (
                        msg.content
                      )}
                    </div>
                  )}
                  
                  <div className={`flex items-center justify-end mt-1 space-x-1 ${msg.isDeleted ? "text-[var(--color-text-secondary)]" : (isEmojiOnly || !isMe) ? "text-[var(--color-text-secondary)]" : "text-blue-100"}`}>
                    {msg.isEdited && !msg.isDeleted && <span className="text-[10px] italic mr-1">edited</span>}
                    <span className="text-[10px] opacity-80">
                      {format(new Date(msg.createdAt), "h:mm a")}
                    </span>
                    {isMe && !msg.isDeleted && (
                      <span className="text-xs ml-1 flex items-center font-bold">
                        {msg.status === "SENT" && <Check className="w-3.5 h-3.5 opacity-60" />}
                        {msg.status === "DELIVERED" && <CheckCheck className="w-3.5 h-3.5 opacity-60" />}
                        {msg.status === "SEEN" && <CheckCheck className="w-3.5 h-3.5 text-cyan-300 opacity-100 drop-shadow-[0_0_2px_rgba(103,232,249,0.8)]" />}
                      </span>
                    )}
                  </div>
                </div>

                {!isMe && (
                   <div className={`opacity-0 group-hover:opacity-100 transition-all duration-200 scale-95 group-hover:scale-100 bg-[var(--color-chat-bg)] border border-[var(--color-border)] rounded-full px-2 py-1 shadow-sm flex items-center space-x-2 ${activeMenu === msg.id ? 'opacity-100 scale-100' : ''}`}>
                      <button onClick={() => addReaction(msg.id, "👍")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                        <Emoji unified={getEmojiUnified("👍")} size={18} emojiStyle={EmojiStyle.APPLE} />
                      </button>
                      <button onClick={() => addReaction(msg.id, "❤️")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                        <Emoji unified={getEmojiUnified("❤️")} size={18} emojiStyle={EmojiStyle.APPLE} />
                      </button>
                      <button onClick={() => addReaction(msg.id, "😂")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                        <Emoji unified={getEmojiUnified("😂")} size={18} emojiStyle={EmojiStyle.APPLE} />
                      </button>
                      <button onClick={() => startReply(msg)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] text-xs font-semibold px-1">Reply</button>
                   </div>
                )}
              </div>
              
              {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (
                <div className={`flex -mt-2.5 z-10 animate-in fade-in zoom-in duration-300 ${isMe ? "mr-4" : "ml-4"}`}>
                  <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-full px-1.5 py-0.5 shadow-sm text-xs flex space-x-1 items-center">
                    {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => (
                       <Emoji key={emoji} unified={getEmojiUnified(emoji)} size={14} emojiStyle={EmojiStyle.APPLE} />
                    ))}
                    <span className="text-[10px] text-[var(--color-text-secondary)] font-semibold">{msg.reactions.length}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {isTyping && (
          <div className="flex flex-col items-start space-y-1 mb-2 ml-2 animate-in fade-in duration-300">
            <span className="text-[10px] text-[var(--color-text-secondary)] font-medium animate-pulse ml-2">
              {currentActiveUser.name} is typing...
            </span>
            <div className="bg-[var(--color-glass-bg)] backdrop-blur-md border border-[var(--color-glass-border)] text-[var(--color-text-main)] px-3 py-2 rounded-[2rem] rounded-bl-sm shadow-sm flex items-center space-x-1 w-max">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]/50 animate-bounce" style={{ animationDelay: "0ms" }}></span>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]/50 animate-bounce" style={{ animationDelay: "150ms" }}></span>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]/50 animate-bounce" style={{ animationDelay: "300ms" }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {!isNearBottom && (
        <div className="absolute bottom-28 right-8 z-30">
          <button
            onClick={scrollToBottom}
            className="w-10 h-10 bg-[var(--color-glass-bg)] backdrop-blur-xl border border-[var(--color-glass-border)] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-background)]"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* New message toast */}
      {newMsgToast && (
        <div
          onClick={() => { scrollToBottom(); setNewMsgToast(null); }}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 cursor-pointer animate-in fade-in"
        >
          <div className="bg-[var(--color-primary)] text-[var(--color-background)] px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium hover:scale-105 transition-transform">
            <ArrowDown className="w-4 h-4" />
            <span className="font-bold">{newMsgToast.sender}:</span>
            <span className="opacity-90 truncate max-w-[200px]">{newMsgToast.text}</span>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-[var(--color-glass-bg)] backdrop-blur-xl border-t border-[var(--color-glass-border)] flex flex-col">
        {(replyingTo || editingMessage) && (
          <div className="flex items-center justify-between bg-[var(--color-bg)]/80 backdrop-blur-md border border-[var(--color-glass-border)] px-4 py-3 rounded-2xl mb-2 shadow-sm z-0">
            <div className="text-sm truncate opacity-80">
              <span className="font-semibold text-[var(--color-primary)]">{editingMessage ? 'Editing message' : `Replying to ${replyingTo?.senderId === currentUser?.id ? 'Yourself' : currentActiveUser.name}`}</span>
              <p className="text-xs truncate max-w-sm mt-0.5 text-[var(--color-text-main)]">{editingMessage?.content || replyingTo?.content}</p>
            </div>
            <button 
              onClick={() => { setReplyingTo(null); setEditingMessage(null); setNewMessage(""); }}
              className="text-[var(--color-text-secondary)] hover:text-red-500 transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-2 z-10 relative">
          <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileSelect(e, "FILE")} />
          <input type="file" accept="image/*" ref={imageInputRef} className="hidden" onChange={(e) => handleFileSelect(e, "IMAGE")} />
          
          <div className="relative">
            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-[var(--color-text-secondary)] hover:text-yellow-500 transition-colors rounded-full hover:bg-[var(--color-bg)]">
              <Smile className="w-6 h-6" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-4 z-50">
                <EmojiPicker 
                  theme={Theme.AUTO}
                  onEmojiClick={(emojiData) => setNewMessage(p => p + emojiData.emoji)} 
                />
              </div>
            )}
          </div>

          <div className="relative">
            <button type="button" onClick={() => setShowAttachMenu(!showAttachMenu)} className={`p-2 transition-colors rounded-full hover:bg-[var(--color-bg)] ${showAttachMenu || scheduleTime || selfDestructTimer ? 'bg-[var(--color-bg)] text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]'}`}>
              <Plus className={`w-6 h-6 transition-transform ${showAttachMenu ? 'rotate-45' : ''}`} />
            </button>
            
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl shadow-xl flex flex-col p-2 space-y-1 w-48 z-40">
                <button type="button" onClick={() => imageInputRef.current?.click()} className="flex items-center space-x-3 w-full text-left px-3 py-2 text-sm text-[var(--color-text-main)] hover:bg-[var(--color-chat-bg)] rounded-lg">
                  <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><ImageIcon className="w-4 h-4" /></span>
                  <span>Photo & Video</span>
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-3 w-full text-left px-3 py-2 text-sm text-[var(--color-text-main)] hover:bg-[var(--color-chat-bg)] rounded-lg">
                  <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0"><FileIcon className="w-4 h-4" /></span>
                  <span>Document</span>
                </button>
                
                <div className="h-px bg-[var(--color-border)] my-1"></div>

                <div className="px-3 py-2 w-full">
                  <label className="text-xs text-[var(--color-text-secondary)] font-bold uppercase mb-1 block">Scheduled Send</label>
                  <input type="datetime-local" value={scheduleTime} onChange={e => {setScheduleTime(e.target.value);}} className="w-full bg-[var(--color-chat-bg)] border border-[var(--color-border)] rounded p-1.5 text-xs text-[var(--color-text-main)]" />
                  {scheduleTime && <button type="button" onClick={() => setScheduleTime("")} className="text-[10px] text-red-500 hover:underline mt-1 w-full text-right">Clear Time</button>}
                </div>

                <div className="px-3 py-1 w-full pb-2">
                  <label className="text-xs text-[var(--color-text-secondary)] font-bold uppercase mb-1 block">Self-Destruct Timer</label>
                  <select value={selfDestructTimer || ""} onChange={e => {setSelfDestructTimer(Number(e.target.value) || null);}} className="w-full bg-[var(--color-chat-bg)] border border-[var(--color-border)] rounded p-1.5 text-xs text-[var(--color-text-main)] outline-none">
                    <option value="">Off</option>
                    <option value="15">15 Seconds</option>
                    <option value="60">1 Minute</option>
                    <option value="300">5 Minutes</option>
                    <option value="3600">1 Hour</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1 bg-[var(--color-bg)]/60 backdrop-blur-md border border-[var(--color-glass-border)] rounded-[2rem] flex items-center px-6 py-4 focus-within:ring-2 focus-within:ring-[var(--color-primary)]/30 focus-within:bg-[var(--color-bg)] transition-all shadow-inner">
            {uploading ? (
              <span className="text-sm text-[var(--color-text-secondary)] italic">Uploading...</span>
            ) : (
              <input
                ref={messageInputRef}
                type="text"
                value={newMessage}
                onChange={handleTyping}
                placeholder={isRecording ? "Recording audio..." : "Type a message..."}
                disabled={isRecording}
                className="flex-1 bg-transparent text-[var(--color-text-main)] focus:outline-none placeholder-[var(--color-text-secondary)] font-medium"
              />
            )}
          </div>
          
          {newMessage.trim() || uploading ? (
            <button 
              type="submit" 
              disabled={!newMessage.trim() || uploading}
              className="px-4 py-3 bg-[var(--color-primary)] text-[var(--color-background)] rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_14px_-4px_var(--color-primary)] hover:shadow-[0_6px_20px_-6px_var(--color-primary)] hover:-translate-y-0.5 cursor-pointer shrink-0 flex items-center justify-center"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          ) : (
            <button 
              type="button" 
              onClick={toggleRecording}
              className={`px-4 py-3 text-[var(--color-background)] rounded-full transition-all hover:-translate-y-0.5 cursor-pointer shrink-0 flex items-center justify-center ${isRecording ? 'bg-red-500 animate-pulse shadow-[0_4px_14px_-4px_rgba(239,68,68,0.5)]' : 'bg-[var(--color-primary)] shadow-[0_4px_14px_-4px_var(--color-primary)] hover:shadow-[0_6px_20px_-6px_var(--color-primary)]'}`}
            >
              {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
        </form>
      </div>
      {/* Delete Confirmation Modal */}
      {messageToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--color-chat-bg)] p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-[var(--color-border)] animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">Delete Message?</h3>
            <p className="text-[var(--color-text-secondary)] mb-6">Are you sure you want to delete this message? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setMessageToDelete(null)}
                className="px-4 py-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] rounded-xl transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={deleteMessage}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors shadow-sm shadow-red-500/20 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
