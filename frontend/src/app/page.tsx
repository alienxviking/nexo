"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { MessageSquare, Sparkles, Shield, Zap, Pencil, Loader2 } from "lucide-react";
import { API_URL } from "@/lib/config";
import { useDoodle } from "@/context/DoodleContext";

export default function AuthPage() {
  const { isDoodleMode, toggleDoodleMode } = useDoodle();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const url = isLogin ? `${API_URL}/api/auth/login` : `${API_URL}/api/auth/register`;
    const body = isLogin ? { email, password } : { email, password, name };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      login(data.token, data.user);
      router.push("/chat");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)] relative overflow-hidden">
      {/* Doodle Mode Toggle (Persistent) */}
      <button 
        onClick={toggleDoodleMode}
        type="button"
        className={`absolute top-6 right-6 z-50 p-4 transition-all hover:scale-110 active:scale-95 group ${isDoodleMode ? 'bg-orange-500 text-white doodle-border rotate-3 shadow-lg' : 'bg-[var(--color-glass-bg)] text-[var(--color-text-secondary)] rounded-2xl border border-[var(--color-glass-border)] shadow-sm'}`}
        title="Toggle Doodle Mode"
      >
        <Pencil className={`w-6 h-6 ${isDoodleMode ? 'animate-wobbly' : 'group-hover:rotate-12 transition-transform'}`} />
      </button>

      {/* Animated background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[var(--color-primary)]/15 rounded-full mix-blend-multiply filter blur-[80px] animate-blob"></div>
      <div className="absolute top-[30%] right-[-5%] w-[400px] h-[400px] bg-[var(--color-primary-hover)]/15 rounded-full mix-blend-multiply filter blur-[80px] animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-15%] left-[30%] w-[450px] h-[450px] bg-[var(--color-primary)]/10 rounded-full mix-blend-multiply filter blur-[80px] animate-blob animation-delay-4000"></div>

      {/* Left panel — Branding */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-16 relative z-10">
        <div className="max-w-md space-y-10">
          {/* Logo */}
          <div className="flex items-center gap-4 text-[var(--font-patrick-hand)]">
            <div className={`w-16 h-16 bg-[var(--color-primary)] rounded-[1.5rem] flex items-center justify-center shadow-xl rotate-3 hover:rotate-6 transition-transform ${isDoodleMode ? 'doodle-border text-white' : ''}`}>
              <span className="text-4xl font-black text-[var(--color-background)]">N</span>
            </div>
            <h1 className="text-5xl font-black bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-text-main)] bg-clip-text text-transparent">
              Nexo
            </h1>
          </div>

          <p className="text-xl font-medium text-[var(--color-text-secondary)] leading-relaxed">
            The modern chat experience. Fast, secure, and beautifully designed for every conversation.
          </p>

          {/* Feature pills */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-[var(--color-glass-bg)] backdrop-blur-xl border border-[var(--color-glass-border)] rounded-[2rem] shadow-sm hover:scale-[1.02] transition-transform">
              <div className="w-12 h-12 rounded-[1rem] bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                <Zap className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <div>
                <p className="font-bold text-[var(--color-text-main)]">Real-time Messaging</p>
                <p className="text-sm text-[var(--color-text-secondary)]">Instant delivery with typing indicators</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-[var(--color-glass-bg)] backdrop-blur-xl border border-[var(--color-glass-border)] rounded-[2rem] shadow-sm hover:scale-[1.02] transition-transform">
              <div className="w-12 h-12 rounded-[1rem] bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <div>
                <p className="font-bold text-[var(--color-text-main)]">Self-Destructing Messages</p>
                <p className="text-sm text-[var(--color-text-secondary)]">Privacy-first with auto-delete</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-[var(--color-glass-bg)] backdrop-blur-xl border border-[var(--color-glass-border)] rounded-[2rem] shadow-sm hover:scale-[1.02] transition-transform">
              <div className="w-12 h-12 rounded-[1rem] bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <div>
                <p className="font-bold text-[var(--color-text-main)]">10 Custom Themes</p>
                <p className="text-sm text-[var(--color-text-secondary)]">Make it yours with gorgeous palettes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — Auth form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16 relative z-10">
        <div className={`w-full max-w-md p-10 lg:p-12 bg-[var(--color-glass-bg)] backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-[var(--color-glass-border)] transition-all duration-500 ${isDoodleMode ? 'doodle-border -rotate-1' : ''}`}>
          
          {/* Mobile-only logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <div className={`w-16 h-16 bg-[var(--color-primary)] rounded-[1.5rem] flex items-center justify-center shadow-xl rotate-3 hover:rotate-12 transition-transform ${isDoodleMode ? 'doodle-border' : ''}`}>
              <span className="text-3xl font-black text-[var(--color-background)]">N</span>
            </div>
          </div>

          <h1 className="text-3xl font-black mb-2 text-[var(--color-text-main)] lg:text-left text-center">
            {isLogin ? "Welcome back!" : "Create account"}
          </h1>
          <p className="text-[var(--color-text-secondary)] font-medium mb-8 lg:text-left text-center">
            {isLogin ? "Sign in to continue your conversations" : "Join Nexo and start chatting"}
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-[1.5rem] mb-6 text-sm font-medium animate-in fade-in duration-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-bold text-[var(--color-text-main)] mb-2 ml-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-6 py-4 bg-[var(--color-input-bg)]/80 backdrop-blur-sm text-[var(--color-text-main)] border border-[var(--color-glass-border)] rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:bg-[var(--color-input-bg)] transition-all shadow-inner font-medium disabled:opacity-50"
                  required={!isLogin}
                  placeholder="John Doe"
                  disabled={isLoading}
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-bold text-[var(--color-text-main)] mb-2 ml-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-4 bg-[var(--color-input-bg)]/80 backdrop-blur-sm text-[var(--color-text-main)] border border-[var(--color-glass-border)] rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:bg-[var(--color-input-bg)] transition-all shadow-inner font-medium disabled:opacity-50"
                required
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[var(--color-text-main)] mb-2 ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4 bg-[var(--color-input-bg)]/80 backdrop-blur-sm text-[var(--color-text-main)] border border-[var(--color-glass-border)] rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:bg-[var(--color-input-bg)] transition-all shadow-inner font-medium disabled:opacity-50"
                required
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-[var(--color-primary)] text-[var(--color-background)] font-bold rounded-[2rem] transition-all shadow-lg hover:brightness-110 hover:-translate-y-0.5 hover:shadow-xl mt-4 active:scale-[0.98] text-lg disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isLogin ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                isLogin ? "Sign In" : "Sign Up"
              )}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-[var(--color-text-secondary)]">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              className="text-[var(--color-primary)] hover:underline focus:outline-none font-bold"
              disabled={isLoading}
            >
              {isLogin ? "Register" : "Login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

