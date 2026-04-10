import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import Chatbot from "@/components/Chatbot";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IT Support Intelligent — Helpdesk IA",
  description: "Système de ticketing intelligent propulsé par l'IA. Gérez, classifiez et résolvez vos tickets IT avec l'aide de l'intelligence artificielle.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.className} antialiased bg-[hsl(var(--background))] text-[hsl(var(--foreground))]`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 min-h-screen overflow-x-hidden">
              {children}
            </main>
          </div>
          <Chatbot />
        </ThemeProvider>
      </body>
    </html>
  );
}
