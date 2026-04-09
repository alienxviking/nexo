import type { Metadata } from "next";
import { Geist, Geist_Mono, Patrick_Hand, Gochi_Hand } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { DoodleProvider } from "@/context/DoodleContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const patrickHand = Patrick_Hand({
  variable: "--font-patrick-hand",
  subsets: ["latin"],
  weight: "400",
});

const gochiHand = Gochi_Hand({
  variable: "--font-gochi-hand",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Nexo Chat",
  description: "Modern real-time private messaging application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${patrickHand.variable} ${gochiHand.variable} antialiased`}
        suppressHydrationWarning
      >
        <DoodleProvider>
          <ThemeProvider
            attribute="data-theme"
            defaultTheme="clean-dark"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>
              <SocketProvider>
                {children}
              </SocketProvider>
            </AuthProvider>
          </ThemeProvider>
        </DoodleProvider>
      </body>
    </html>
  );
}
