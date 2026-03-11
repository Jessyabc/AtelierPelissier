"use client";

import React, { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

/**
 * Global error boundary — catches unhandled React errors,
 * displays a recovery UI, and logs the error to AppErrorLog via API.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const route = typeof window !== "undefined" ? window.location.pathname : "unknown";

    fetch("/api/admin/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "client",
        severity: "error",
        message: error.message,
        stack: error.stack ?? null,
        route,
        context: {
          componentStack: errorInfo.componentStack?.slice(0, 2000),
        },
      }),
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto mt-20 text-center space-y-4">
          <div className="neo-card p-8">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">Something went wrong</h2>
            <p className="text-sm text-[var(--foreground-muted)] mb-4">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <p className="text-xs text-[var(--foreground-muted)] mb-6">
              This error has been logged. You can view diagnostics in Admin Hub &gt; System Health.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="neo-btn-primary px-6 py-2.5 text-sm font-medium"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
