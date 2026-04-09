"use client";

import { useEffect, useState, useRef, memo, useCallback, type TouchEvent as ReactTouchEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { Send, Image as ImageIcon, Paperclip, MoreVertical, Check, CheckCheck, Mic, Square, File as FileIcon, Play, Pause, Search, Clock, Bomb, X, Smile, Plus, ArrowDown, Download, ChevronLeft, Reply } from "lucide-react";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import EmojiPicker, { Theme, Emoji, EmojiStyle } from "emoji-picker-react";
import { getAvatarGradient } from "@/lib/avatarGradients";
import { useDoodle } from "@/context/DoodleContext";
import VoicePlayer from "./VoicePlayer";
import { API_URL } from "@/lib/config";

const isOnlyEmoji = (str: string) => {
  // Regex for emojis only (including multiple emojis, symbols, and spaces)
  const emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Component}|\s)+$/u;
  return emojiRegex.test(str.trim());
};

const getEmojiUnified = (emoji: string) => {
  return Array.from(emoji)
    .map(char => char.codePointAt(0)?.toString(16).toLowerCase())
    .join("-");
};

const SafeEmoji = ({ char, size }: { char: string; size: number }) => {
  const [error, setError] = useState(false);
  const unified = getEmojiUnified(char);

  return error ? (
    <span
      className="flex items-center justify-center select-none leading-none inline-flex"
      style={{ fontSize: `${size * 0.8}px`, width: `${size}px`, height: `${size}px` }}
    >
      {char}
    </span>
  ) : (
    <img
      src={`https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${unified}.png`}
      alt={char}
      className="object-contain select-none"
      style={{ width: `${size}px`, height: `${size}px` }}
      onError={() => {
        console.warn(`Emoji asset failed to load for: ${char} (${unified})`);
        setError(true);
      }}
      loading="lazy"
    />
  );
};

const MessageItem = memo(({
  msg,
  currentUser,
  currentActiveUser,
  index,
  messages,
  activeMenu,
  addReaction,
  startReply,
  startEdit,
  setMessageToDelete,
  scrollToMessage,
  highlightedMessageId
}: {
  msg: Message;
  currentUser: any;
  currentActiveUser: User;
  index: number;
  messages: Message[];
  activeMenu: string | null;
  addReaction: (id: string, emoji: string) => void;
  startReply: (msg: Message) => void;
  startEdit: (msg: Message) => void;
  setMessageToDelete: (id: string) => void;
  scrollToMessage: (id: string) => void;
  highlightedMessageId: string | null;
}) => {
  const isMe = msg.senderId === currentUser?.id;
  const isEmojiOnly = !msg.isDeleted && msg.type === "TEXT" && isOnlyEmoji(msg.content);
  const showTime = index === 0 || new Date(msg.createdAt).getTime() - new Date(messages[index - 1].createdAt).getTime() > 300000; // 5 mins
  const isHighlighted = highlightedMessageId === msg.id;

  // --- Swipe-to-reply state ---
  const [swipeX, setSwipeX] = useState(0);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const swipeLockedRef = useRef(false); // locks direction once determined

  // --- Long-press reaction state ---
  const [showLongPressMenu, setShowLongPressMenu] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressFiredRef = useRef(false);

  const SWIPE_THRESHOLD = 60;

  const handleTouchStart = (e: ReactTouchEvent) => {
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    isSwipingRef.current = false;
    swipeLockedRef.current = false;
    longPressFiredRef.current = false;

    // Start long-press timer
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      setShowLongPressMenu(true);
    }, 500);
  };

  const handleTouchMove = (e: ReactTouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartXRef.current;
    const dy = touch.clientY - touchStartYRef.current;

    // Cancel long-press if finger moves more than 10px
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // Lock direction on first significant movement
    if (!swipeLockedRef.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      swipeLockedRef.current = true;
      isSwipingRef.current = Math.abs(dx) > Math.abs(dy); // horizontal wins
    }

    if (!isSwipingRef.current) return;

    // Only allow right swipe (positive dx), cap at 120px
    const clampedX = Math.max(0, Math.min(dx, 120));
    setSwipeX(clampedX);
  };

  const handleTouchEnd = () => {
    // Cancel long-press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (swipeX >= SWIPE_THRESHOLD) {
      if (navigator.vibrate) navigator.vibrate(30);
      startReply(msg);
    }
    setSwipeX(0);
    isSwipingRef.current = false;
    swipeLockedRef.current = false;
  };

  const dismissLongPressMenu = () => setShowLongPressMenu(false);

  const { isDoodleMode } = useDoodle();
  // Swipe progress from 0 to 1
  const swipeProgress = Math.min(swipeX / SWIPE_THRESHOLD, 1);

  return (
    <div key={msg.id} id={`msg-${msg.id}`} className={`flex flex-col ${isMe ? "items-end" : "items-start"} relative group transition-colors duration-500 animate-msg-pop ${isHighlighted ? "bg-[var(--color-primary)]/5 rounded-xl -mx-2 px-2" : ""}`}>
      {showTime && (
        <div className="flex items-center gap-3 my-4 self-center w-full max-w-xs">
          <div className="flex-1 h-px bg-[var(--color-border)]/50"></div>
          <span className={`text-[10px] font-semibold text-[var(--color-text-secondary)] bg-[var(--color-glass-bg)] backdrop-blur-sm px-4 py-1.5 rounded-full border border-[var(--color-glass-border)] shadow-sm whitespace-nowrap ${isDoodleMode ? "doodle-border" : ""}`}>
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

      {/* Swipe-to-reply wrapper (mobile) */}
      <div
        className="relative w-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Reply icon indicator on swipe */}
        {swipeX > 0 && (
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center z-0 pointer-events-none"
            style={{ opacity: swipeProgress, transform: `translateY(-50%) scale(${0.5 + swipeProgress * 0.5})` }}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${swipeProgress >= 1 ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-border)] text-[var(--color-text-secondary)]'} transition-colors duration-150`}>
              <Reply className="w-4 h-4" />
            </div>
          </div>
        )}

        <div
          className={`flex items-center space-x-2 ${isMe ? "justify-end" : "justify-start"}`}
          style={{
            transform: swipeX > 0 ? `translateX(${swipeX}px)` : undefined,
            transition: swipeX > 0 ? 'none' : 'transform 0.25s ease-out',
          }}
        >
          {isMe && (
            <div className={`opacity-0 group-hover:opacity-100 transition-all duration-200 scale-95 group-hover:scale-100 bg-[var(--color-chat-bg)] border border-[var(--color-border)] rounded-full px-2 py-1 shadow-sm hidden md:flex items-center space-x-2 ${activeMenu === msg.id ? 'opacity-100 scale-100' : ''}`}>
              <button onClick={() => addReaction(msg.id, "👍")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                <SafeEmoji char="👍" size={20} />
              </button>
              <button onClick={() => addReaction(msg.id, "❤️")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                <SafeEmoji char="❤️" size={20} />
              </button>
              <button onClick={() => addReaction(msg.id, "😂")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                <SafeEmoji char="😂" size={20} />
              </button>
              <button onClick={() => addReaction(msg.id, "😮")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                <SafeEmoji char="😮" size={20} />
              </button>
              <button onClick={() => addReaction(msg.id, "😢")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                <SafeEmoji char="😢" size={20} />
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
            className={`w-fit max-w-[75%] md:max-w-[70%] transition-all duration-300 ${isEmojiOnly ? "p-0" : "px-4 py-2.5 md:px-5 md:py-3"} ${msg.isDeleted ? "bg-transparent border-2 border-dashed border-[var(--color-border)] rounded-[20px] text-[var(--color-text-secondary)] italic" :
              isEmojiOnly ? "bg-transparent shadow-none" :
                isMe
                  ? 'bubble-cute-me'
                  : 'bubble-cute-other'
              }`}
          >
            {msg.replyTo && !msg.isDeleted && (
              <div
                onClick={() => scrollToMessage(msg.replyTo!.id)}
                className={`text-xs p-2 rounded-lg mb-2 opacity-80 border-l-2 cursor-pointer hover:opacity-100 transition-opacity ${isMe ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]" : "bg-[var(--color-border)]/30 border-[var(--color-primary)]"} truncate`}
              >
                <span className="font-semibold block">{msg.replyTo.sender.id === currentUser?.id ? 'You' : currentActiveUser.name}</span>
                {msg.replyTo.content}
              </div>
            )}

            {!msg.isDeleted && msg.type === "IMAGE" && msg.fileUrl && (
              <img src={`${API_URL}${msg.fileUrl}`} alt="Sent image" className="max-w-full h-auto max-h-60 rounded-xl mb-2 object-contain" />
            )}

            {!msg.isDeleted && msg.type === "FILE" && msg.fileUrl && (
              <a href={`${API_URL}${msg.fileUrl}`} target="_blank" rel="noreferrer" className="group flex items-center space-x-3 p-3 rounded-2xl mb-2 border-2 border-dashed border-[var(--color-border)] transition-all hover:scale-[1.02] text-[var(--color-text-main)] hover:bg-[var(--color-bg)]/50 no-underline">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[var(--color-primary)]/10">
                  <FileIcon className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-semibold truncate max-w-[150px] leading-tight">{msg.content}</span>
                  <span className="text-[10px] mt-0.5 text-[var(--color-text-secondary)]">Click to download</span>
                </div>
                <Download className="w-4 h-4 ml-1 opacity-50 group-hover:opacity-100 transition-opacity shrink-0 text-[var(--color-primary)]" />
              </a>
            )}

            {!msg.isDeleted && msg.type === "VOICE" && msg.fileUrl && (
              <div className="mb-1">
                <VoicePlayer src={`${API_URL}${msg.fileUrl}`} isMe={isMe} />
              </div>
            )}

            {(msg.type === "TEXT" || msg.isDeleted) && (
              <div className={`leading-relaxed break-words ${isEmojiOnly ? "flex flex-wrap gap-2 py-3 justify-center min-h-[4rem]" : "text-[15px]"}`}>
                {isEmojiOnly ? (
                  msg.content.match(/\p{Extended_Pictographic}\uFE0F?(?:\u200d\p{Extended_Pictographic}\uFE0F?)*|\p{Emoji_Presentation}|\p{Emoji_Component}/gu)?.map((char, i) => (
                    <SafeEmoji key={i} char={char} size={64} />
                  ))
                ) : (
                  msg.content
                )}
              </div>
            )}

            <div className={`flex items-center justify-end mt-1 space-x-1 ${msg.isDeleted ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-secondary)]"}`}>
              {msg.isEdited && !msg.isDeleted && <span className="text-[10px] italic mr-1">edited</span>}
              <span className="text-[10px] opacity-80">
                {format(new Date(msg.createdAt), "h:mm a")}
              </span>
              {isMe && !msg.isDeleted && (
                <span className="text-xs ml-1 flex items-center font-bold">
                  {msg.status === "SENT" && <Check className="w-3.5 h-3.5 opacity-40" />}
                  {msg.status === "DELIVERED" && <CheckCheck className="w-3.5 h-3.5 opacity-40" />}
                  {msg.status === "SEEN" && <CheckCheck className="w-3.5 h-3.5 text-[var(--color-primary)] opacity-100" />}
                </span>
              )}
            </div>
          </div>

          {!isMe && (
            <div className={`opacity-0 group-hover:opacity-100 transition-all duration-200 scale-95 group-hover:scale-100 bg-[var(--color-chat-bg)] border border-[var(--color-border)] rounded-full px-2 py-1 shadow-sm hidden md:flex items-center space-x-2 ${activeMenu === msg.id ? 'opacity-100 scale-100' : ''}`}>
              <button onClick={() => addReaction(msg.id, "👍")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                <SafeEmoji char="👍" size={20} />
              </button>
              <button onClick={() => addReaction(msg.id, "❤️")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                <SafeEmoji char="❤️" size={20} />
              </button>
              <button onClick={() => addReaction(msg.id, "😂")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                <SafeEmoji char="😂" size={20} />
              </button>
              <button onClick={() => addReaction(msg.id, "😮")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                <SafeEmoji char="😮" size={20} />
              </button>
              <button onClick={() => addReaction(msg.id, "😢")} className="hover:scale-125 transition-transform flex items-center justify-center p-1">
                <SafeEmoji char="😢" size={20} />
              </button>
              <button onClick={() => startReply(msg)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] text-xs font-semibold px-1">Reply</button>
            </div>
          )}
        </div>
      </div>

      {/* Long-press reaction popup (mobile) */}
      {showLongPressMenu && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={dismissLongPressMenu} onTouchEnd={dismissLongPressMenu} />
          <div className={`absolute z-[100] ${isMe ? 'right-2' : 'left-2'} -top-2 animate-in fade-in zoom-in-95 duration-200`}>
            <div className="bg-[var(--color-chat-bg)] border border-[var(--color-border)] rounded-2xl px-2 py-1.5 shadow-xl flex items-center space-x-1">
              <button onClick={() => { addReaction(msg.id, "👍"); dismissLongPressMenu(); }} className="hover:scale-125 active:scale-95 transition-transform flex items-center justify-center p-1.5">
                <SafeEmoji char="👍" size={24} />
              </button>
              <button onClick={() => { addReaction(msg.id, "❤️"); dismissLongPressMenu(); }} className="hover:scale-125 active:scale-95 transition-transform flex items-center justify-center p-1.5">
                <SafeEmoji char="❤️" size={24} />
              </button>
              <button onClick={() => { addReaction(msg.id, "😂"); dismissLongPressMenu(); }} className="hover:scale-125 active:scale-95 transition-transform flex items-center justify-center p-1.5">
                <SafeEmoji char="😂" size={24} />
              </button>
              <button onClick={() => { addReaction(msg.id, "😮"); dismissLongPressMenu(); }} className="hover:scale-125 active:scale-95 transition-transform flex items-center justify-center p-1.5">
                <SafeEmoji char="😮" size={24} />
              </button>
              <button onClick={() => { addReaction(msg.id, "😢"); dismissLongPressMenu(); }} className="hover:scale-125 active:scale-95 transition-transform flex items-center justify-center p-1.5">
                <SafeEmoji char="😢" size={24} />
              </button>
              <div className="w-px h-6 bg-[var(--color-border)] mx-1"></div>
              <button onClick={() => { startReply(msg); dismissLongPressMenu(); }} className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] active:scale-95 transition-all text-xs font-bold px-2 py-1">
                Reply
              </button>
              {isMe && msg.content !== "This message was deleted" && !msg.isDeleted && (
                <>
                  <button onClick={() => { startEdit(msg); dismissLongPressMenu(); }} className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] active:scale-95 transition-all text-xs font-bold px-2 py-1">
                    Edit
                  </button>
                  <button onClick={() => { setMessageToDelete(msg.id); dismissLongPressMenu(); }} className="text-[var(--color-text-secondary)] hover:text-red-500 active:scale-95 transition-all text-xs font-bold px-2 py-1">
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

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
});

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

const ChatInput = memo(({
  socket,
  conversationId,
  currentUser,
  currentActiveUser,
  token,
  replyingTo,
  setReplyingTo,
  editingMessage,
  setEditingMessage,
  setMessages,
  scrollToBottom,
}: {
  socket: any;
  conversationId: string;
  currentUser: any;
  currentActiveUser: User;
  token: string | null;
  replyingTo: Message | null;
  setReplyingTo: (msg: Message | null) => void;
  editingMessage: Message | null;
  setEditingMessage: (msg: Message | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  scrollToBottom: () => void;
}) => {
  const { isDoodleMode } = useDoodle();
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [selfDestructTimer, setSelfDestructTimer] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const lastTypingEmitRef = useRef<number>(0);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    if (editingMessage) {
      setNewMessage(editingMessage.content);
      setTimeout(() => {
        if (messageInputRef.current) {
          messageInputRef.current.focus();
          messageInputRef.current.setSelectionRange(editingMessage.content.length, editingMessage.content.length);
        }
      }, 50);
    } else {
      // Clear input when edit is cancelled
      setNewMessage("");
      if (replyingTo) {
        setTimeout(() => messageInputRef.current?.focus(), 50);
      }
    }
  }, [editingMessage, replyingTo]);

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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !currentUser) return;

    const content = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();

    if (editingMessage) {
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
      if (scheduleTime) scheduledAtDate = new Date(scheduleTime).toISOString();

      let selfDestructAtDate = null;
      if (selfDestructTimer) selfDestructAtDate = new Date(Date.now() + selfDestructTimer * 1000).toISOString();

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
        tempId,
      });
    }

    setNewMessage("");
    setReplyingTo(null);
    setScheduleTime("");
    setSelfDestructTimer(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (socket) {
      const now = Date.now();
      if (now - lastTypingEmitRef.current > 2000) {
        socket.emit("typing", { conversationId, receiverId: currentActiveUser.id });
        lastTypingEmitRef.current = now;
      }
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
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const file = new File([blob], "voice_message.webm", { type: 'audio/webm' });
          const url = await uploadFile(file);
          if (url && socket) {
            socket.emit("send_message", {
              conversationId, receiverId: currentActiveUser.id, content: "Voice Message",
              fileUrl: url, type: "VOICE", replyToId: replyingTo?.id || null,
            });
          }
          stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) { console.error("Microphone error", err); }
    }
  };

  return (
    <div className="bg-[var(--color-sidebar)] border-t-2 border-dashed border-[var(--color-border)] p-4 md:p-6 z-20">
      {replyingTo && (
        <div className="flex items-center justify-between bg-[var(--color-bg)] rounded-[16px] p-4 mb-4 border-2 border-dashed border-[var(--color-primary)]/40 animate-in slide-in-from-bottom-2 duration-300 overflow-hidden">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-1 h-8 bg-[var(--color-primary)] rounded-full shrink-0"></div>
            <div className="overflow-hidden">
              <span className="text-xs font-bold text-[var(--color-primary)]">Replying to {replyingTo.senderId === currentUser?.id ? 'you' : currentActiveUser.name}</span>
              <p className="text-sm text-[var(--color-text-secondary)] truncate leading-relaxed">{replyingTo.content}</p>
            </div>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1.5 hover:bg-[var(--color-border)] rounded-full text-[var(--color-text-secondary)] transition-colors"><X className="w-4 h-4" /></button>
        </div>
      )}

      {editingMessage && (
        <div className="flex items-center justify-between bg-orange-50/80 rounded-[16px] p-4 mb-4 border-2 border-dashed border-orange-300 animate-in slide-in-from-bottom-2 duration-300 overflow-hidden dark:bg-orange-950/20 dark:border-orange-800/50">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-1 h-8 bg-orange-500 rounded-full shrink-0"></div>
            <div className="overflow-hidden">
              <span className="text-xs font-bold text-orange-600 dark:text-orange-400">Editing Message</span>
              <p className="text-sm text-[var(--color-text-secondary)] truncate leading-relaxed">{editingMessage.content}</p>
            </div>
          </div>
          <button onClick={() => setEditingMessage(null)} className="p-1.5 hover:bg-orange-100 rounded-full text-orange-600 transition-colors dark:hover:bg-orange-900/50"><X className="w-4 h-4" /></button>
        </div>
      )}

      <form onSubmit={handleSend} className="relative flex flex-col space-y-3">
        {showAttachMenu && (
          <div className="absolute bottom-full left-0 mb-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95 duration-200 z-50 min-w-[240px]">
            <button type="button" onClick={() => imageInputRef.current?.click()} className="w-full flex items-center space-x-3 px-6 py-3.5 hover:bg-[var(--color-chat-bg)] transition-colors">
              <ImageIcon className="w-5 h-5 text-pink-500" />
              <span className="text-sm font-medium text-[var(--color-text-main)]">Image</span>
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full flex items-center space-x-3 px-6 py-3.5 hover:bg-[var(--color-chat-bg)] transition-colors border-t border-[var(--color-border)]">
              <FileIcon className="w-5 h-5 text-indigo-500" />
              <span className="text-sm font-medium text-[var(--color-text-main)]">Document</span>
            </button>

            <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <div className="flex items-center space-x-3 mb-3">
                <Clock className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-bold text-[var(--color-text-main)]">Scheduled Send</span>
              </div>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs text-[var(--color-text-main)] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {scheduleTime && (
                <button type="button" onClick={() => setScheduleTime("")} className="text-[10px] text-red-500 hover:underline mt-2 w-full text-right font-medium">
                  Clear Schedule
                </button>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <div className="flex items-center space-x-3 mb-3">
                <Bomb className={`w-5 h-5 ${selfDestructTimer ? 'text-orange-500 animate-pulse' : 'text-orange-400'}`} />
                <span className="text-sm font-bold text-[var(--color-text-main)]">Self-Destruct</span>
              </div>
              <select
                value={selfDestructTimer || ""}
                onChange={e => setSelfDestructTimer(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-2.5 text-xs text-[var(--color-text-main)] outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all cursor-pointer"
              >
                <option value="">Status: Off</option>
                <option value="5">5 Seconds</option>
                <option value="30">30 Seconds</option>
                <option value="3600">1 Hour</option>
                <option value="86400">1 Day</option>
              </select>
            </div>
          </div>
        )}

        {showEmojiPicker && (
          <div className="absolute bottom-full right-0 mb-4 z-50 animate-in slide-in-from-bottom-4 zoom-in-95 duration-200 shadow-2xl">
            <EmojiPicker
              theme={Theme.AUTO}
              onEmojiClick={(emojiData) => setNewMessage(prev => prev + emojiData.emoji)}
              lazyLoadEmojis={true}
              emojiStyle={EmojiStyle.APPLE}
            />
          </div>
        )}

        <div className="flex items-center space-x-2 md:space-x-4">
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-2xl md:rounded-[2rem] transition-all duration-200 ${showAttachMenu || scheduleTime || selfDestructTimer 
              ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20' 
              : 'bg-[var(--color-chat-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] shadow-sm'} ${isDoodleMode ? 'doodle-border' : ''}`}
          >
            <Plus className={`w-6 h-6 transition-transform duration-200 ${showAttachMenu ? 'rotate-45' : ''} ${isDoodleMode && (showAttachMenu || scheduleTime || selfDestructTimer) ? 'animate-wobbly' : ''}`} />
          </button>

          <div className="flex-1 relative group">
            <input
              ref={messageInputRef}
              type="text"
              value={newMessage}
              onChange={handleTyping}
              placeholder={editingMessage ? "Edit message..." : "Type a message..."}
              className={`w-full h-12 md:h-14 pl-6 md:pl-8 pr-12 bg-[var(--color-chat-bg)] border border-[var(--color-border)] rounded-2xl md:rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all shadow-sm text-sm md:text-base text-[var(--color-text-main)] placeholder:text-[var(--color-text-secondary)]/50 ${isDoodleMode ? 'doodle-border shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]' : ''}`}
            />
            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${showEmojiPicker ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]'} ${isDoodleMode ? 'hover:animate-wobbly' : ''}`}>
              <Smile className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center">
            {newMessage.trim() || uploading ? (
              <button
                type="submit"
                disabled={uploading}
                className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center bg-[var(--color-primary)] text-white rounded-full shadow-lg hover:shadow-[var(--color-primary)]/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 ${isDoodleMode ? 'doodle-border' : ''}`}
              >
                {uploading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Send className={`w-5 h-5 ml-0.5 ${isDoodleMode ? 'animate-wobbly' : ''}`} />}
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleRecording}
                className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full border transition-all shadow-sm ${isRecording ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-[var(--color-chat-bg)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/30'} ${isDoodleMode ? 'doodle-border' : ''}`}
              >
                {isRecording ? <Square className="w-5 h-5" /> : <Mic className={`w-5 h-5 ${isDoodleMode && isRecording ? 'animate-wobbly' : ''}`} />}
              </button>
            )}
          </div>
        </div>


        <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileSelect(e, "FILE")} />
        <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, "IMAGE")} />
      </form>
    </div>
  );
});

export default function ChatWindow({
  activeUser,
  conversationId,
  onBack,
}: {
  activeUser: User;
  conversationId: string;
  onBack?: () => void;
}) {
  const { token, user: currentUser } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [currentActiveUser, setCurrentActiveUser] = useState<User>(activeUser);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);

  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

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
      // Use instant scroll for conversation switch — smooth feels sluggish
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      }, 50);
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
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(data);
      setIsLoadingMessages(false);
      
      // Wait for React to render messages before scrolling
      requestAnimationFrame(() => {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
        }, 50);
      });

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
      setIsLoadingMessages(false);
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

  const closeSearch = () => {
    setIsSearching(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const deleteMessage = useCallback(() => {
    if (!socket || !messageToDelete) return;
    socket.emit("delete_message", {
      messageId: messageToDelete,
      conversationId,
      receiverId: currentActiveUser.id
    });
    setMessageToDelete(null);
    setActiveMenu(null);
  }, [socket, messageToDelete, conversationId, currentActiveUser.id]);

  const addReaction = useCallback((msgId: string, emoji: string) => {
    if (!socket) return;
    socket.emit("add_reaction", {
      messageId: msgId,
      emoji,
      conversationId,
      receiverId: currentActiveUser.id
    });
    setActiveMenu(null);
  }, [socket, conversationId, currentActiveUser.id]);

  const startReply = useCallback((msg: Message) => {
    setReplyingTo(msg);
    setEditingMessage(null);
    setActiveMenu(null);
  }, []);

  const startEdit = useCallback((msg: Message) => {
    setEditingMessage(msg);
    setReplyingTo(null);
    setActiveMenu(null);
  }, []);

  const scrollToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(msgId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--color-bg)] relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-10 md:p-6 md:pt-12 border-b-2 border-dashed border-[var(--color-border)] bg-[var(--color-sidebar)] z-20 sticky top-0">
        <div className="flex items-center space-x-2 md:space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-2 -ml-1 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="relative">
            <div className="w-11 h-11 rounded-[16px] border-2 border-dashed flex items-center justify-center font-black text-lg shadow-md" style={{ backgroundColor: 'var(--color-bg)', borderColor: getAvatarGradient(currentActiveUser.name), color: getAvatarGradient(currentActiveUser.name) }}>
              {currentActiveUser.name.charAt(0)}
            </div>
            {currentActiveUser.status === "ONLINE" && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[var(--color-chat-bg)] rounded-full shadow-sm animate-pulse-dot"></span>
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
                <span>Last seen {currentActiveUser.lastSeen ? formatDistanceToNow(new Date(currentActiveUser.lastSeen), { addSuffix: true }) : "recently"}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isSearching ? (
            <form onSubmit={handleSearch} className="flex items-center bg-[var(--color-bg)] rounded-full px-3 py-1 border-2 border-dashed border-[var(--color-primary)] transition-all">
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
              <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--color-bg)] border-2 border-dashed border-[var(--color-border)] rounded-[16px] shadow-lg py-2 z-50">
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
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-4 relative">
        {isLoadingMessages ? (
          <div className="flex flex-col space-y-4 animate-pulse">
            {/* Skeleton bubbles */}
            <div className="flex justify-start">
              <div className="w-[55%] h-12 rounded-[20px] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-recv-msg)]/50"></div>
            </div>
            <div className="flex justify-end">
              <div className="w-[45%] h-12 rounded-[20px] border-2 border-dashed border-[var(--color-primary)]/20 bg-[var(--color-sent-msg-light)]/50"></div>
            </div>
            <div className="flex justify-start">
              <div className="w-[60%] h-16 rounded-[20px] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-recv-msg)]/50"></div>
            </div>
            <div className="flex justify-end">
              <div className="w-[40%] h-10 rounded-[20px] border-2 border-dashed border-[var(--color-primary)]/20 bg-[var(--color-sent-msg-light)]/50"></div>
            </div>
            <div className="flex justify-start">
              <div className="w-[50%] h-12 rounded-[20px] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-recv-msg)]/50"></div>
            </div>
            <div className="flex justify-end">
              <div className="w-[55%] h-14 rounded-[20px] border-2 border-dashed border-[var(--color-primary)]/20 bg-[var(--color-sent-msg-light)]/50"></div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
          <MessageItem
            key={msg.id}
            msg={msg}
            currentUser={currentUser}
            currentActiveUser={currentActiveUser}
            index={index}
            messages={messages}
            activeMenu={activeMenu}
            addReaction={addReaction}
            startReply={startReply}
            startEdit={startEdit}
            setMessageToDelete={setMessageToDelete}
            scrollToMessage={scrollToMessage}
            highlightedMessageId={highlightedMessageId}
          />
        ))}
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
        </>
        )}
      </div>

      {/* Scroll to bottom button */}
      {!isNearBottom && (
        <div className={`absolute right-8 z-30 transition-all duration-300 ${replyingTo || editingMessage ? 'bottom-56' : 'bottom-32'}`}>
          <button
            onClick={scrollToBottom}
            className="no-doodle w-10 h-10 bg-[var(--color-sidebar)] border-2 border-dashed border-[var(--color-border)] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)]"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* New message toast */}
      {newMsgToast && (
        <div
          onClick={() => { scrollToBottom(); setNewMsgToast(null); }}
          className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 cursor-pointer animate-in fade-in"
        >
          <div className="bg-[var(--color-primary)] text-[var(--color-background)] px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium hover:scale-105 transition-transform">
            <ArrowDown className="w-4 h-4" />
            <span className="font-bold">{newMsgToast.sender}:</span>
            <span className="opacity-90 truncate max-w-[200px]">{newMsgToast.text}</span>
          </div>
        </div>
      )}

      {/* Input Area */}
      <ChatInput
        socket={socket}
        conversationId={conversationId}
        currentUser={currentUser}
        currentActiveUser={currentActiveUser}
        token={token}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        editingMessage={editingMessage}
        setEditingMessage={setEditingMessage}
        setMessages={setMessages}
        scrollToBottom={scrollToBottom}
      />

      {/* Delete Confirmation Modal */}
      {messageToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--color-sidebar)] p-6 rounded-[20px] shadow-2xl max-w-sm w-full mx-4 border-2 border-dashed border-[var(--color-border)] animate-in fade-in">
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
