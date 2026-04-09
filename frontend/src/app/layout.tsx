import type { Metadata } from "next";
import { Nunito, Gabarito, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { DoodleProvider } from "@/context/DoodleContext";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${nunito.variable} ${gabarito.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <DoodleProvider>
          <ThemeProvider
            attribute="data-theme"
            defaultTheme="cute-light"
            enableSystem={false}
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
