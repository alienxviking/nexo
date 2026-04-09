"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Mic } from "lucide-react";
import { useDoodle } from "@/context/DoodleContext";

export default function VoicePlayer({
  src,
  isMe
}: {
  src: string;
  isMe: boolean;
}) {
  const { isDoodleMode } = useDoodle();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pos * duration;
    setCurrentTime(audio.currentTime);
  };

  const formatTime = (t: number) => {
    if (!t || isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  // Generate fake waveform bars (deterministic based on src length)
  const barCount = 28;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const seed = (i * 7 + src.length * 3) % 17;
    return 20 + (seed / 17) * 80; // height percentage between 20-100
  });

  return (
    <div className="flex items-center gap-3 min-w-[220px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-110 active:scale-95 ${
          isMe
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-[var(--color-primary)]/15 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/25"
        } ${isDoodleMode ? 'doodle-border' : ''}`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className={`w-4 h-4 ml-0.5 ${isDoodleMode && isPlaying ? 'animate-wobbly' : ''}`} />}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 flex flex-col gap-1.5">
        {/* Waveform bars */}
        <div
          className="flex items-end gap-[2px] h-7 cursor-pointer"
          onClick={handleSeek}
        >
          {bars.map((height, i) => {
            const isPlayedPast = duration > 0 && (i / barCount) * 100 <= progress;
            return (
              <div
                key={i}
                className={`w-[3px] rounded-full transition-all duration-150 ${
                  isPlayedPast
                    ? isMe ? "bg-white" : "bg-[var(--color-primary)]"
                    : isMe ? "bg-white/30" : "bg-[var(--color-primary)]/20"
                } ${isDoodleMode ? 'hover:animate-wobbly' : ''}`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>

        {/* Time */}
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-medium ${isMe ? "text-white/70" : "text-[var(--color-text-secondary)]"}`}>
            {isPlaying ? formatTime(currentTime) : formatTime(duration)}
          </span>
          <Mic className={`w-3 h-3 ${isMe ? "text-white/40" : "text-[var(--color-primary)]/30"}`} />
        </div>
      </div>
    </div>
  );
}
