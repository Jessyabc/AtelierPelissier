"use client";

import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "./ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
      <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
    </ErrorBoundary>
  );
}
