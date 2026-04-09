"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface DoodleContextType {
  isDoodleMode: boolean;
  setDoodleMode: (isDoodle: boolean) => void;
  toggleDoodleMode: () => void;
}

const DoodleContext = createContext<DoodleContextType | undefined>(undefined);

export function DoodleProvider({ children }: { children: React.ReactNode }) {
  const [isDoodleMode, setIsDoodleMode] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("doodle-mode");
    if (saved !== null) {
      setIsDoodleMode(saved === "true");
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("doodle-mode", isDoodleMode.toString());
      if (isDoodleMode) {
        document.body.setAttribute("data-doodle", "true");
      } else {
        document.body.removeAttribute("data-doodle");
      }
    }
  }, [isDoodleMode, mounted]);

  const toggleDoodleMode = () => setIsDoodleMode(prev => !prev);
  const setDoodleMode = (isDoodle: boolean) => setIsDoodleMode(isDoodle);

  return (
    <DoodleContext.Provider value={{ isDoodleMode, setDoodleMode, toggleDoodleMode }}>
      {children}
    </DoodleContext.Provider>
  );
}

export function useDoodle() {
  const context = useContext(DoodleContext);
  if (context === undefined) {
    throw new Error("useDoodle must be used within a DoodleProvider");
  }
  return context;
}
