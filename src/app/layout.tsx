import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { AppHeader } from "@/components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atelier Pelissier — Pricing Engine",
  description: "Internal pricing and cost engine for Atelier Pelissier",
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
        <AppHeader />
        <main className="p-4 sm:p-6">
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
