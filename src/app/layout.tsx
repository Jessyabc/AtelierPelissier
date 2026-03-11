import type { Metadata } from "next";
import { Suspense } from "react";
import { Providers } from "@/components/Providers";
import { AppHeader } from "@/components/AppHeader";
import { AiChatWidget } from "@/components/ai/AiChatWidget";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorLogger } from "@/components/ErrorLogger";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atelier Pelissier — Operations",
  description: "Woodshop operations management for Atelier Pelissier",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <ErrorBoundary>
          <AppHeader />
          <main className="p-4 sm:p-6">
            <Providers>{children}</Providers>
          </main>
          <Suspense fallback={null}>
            <AiChatWidget />
          </Suspense>
          <ErrorLogger />
        </ErrorBoundary>
      </body>
    </html>
  );
}
