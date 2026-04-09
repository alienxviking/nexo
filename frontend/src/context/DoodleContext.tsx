"use client";

import React, { createContext, useContext, useEffect } from "react";

interface DoodleContextType {
  isDoodleMode: boolean;
}

const DoodleContext = createContext<DoodleContextType>({ isDoodleMode: true });

export const useDoodle = () => useContext(DoodleContext);

export const DoodleProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Always enable doodle mode — it's the permanent aesthetic
    document.body.setAttribute("data-doodle", "true");
  }, []);

  return (
    <DoodleContext.Provider value={{ isDoodleMode: true }}>
      {children}
    </DoodleContext.Provider>
  );
};
