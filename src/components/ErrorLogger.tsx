"use client";

import { useEffect } from "react";

/**
 * Invisible component that installs global error listeners.
 * Catches unhandled errors and promise rejections, logging them to AppErrorLog.
 */
export function ErrorLogger() {
  useEffect(() => {
    function logError(payload: {
      message: string;
      stack?: string | null;
      source: string;
    }) {
      fetch("/api/admin/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          severity: "error",
          route: window.location.pathname,
        }),
      }).catch(() => {});
    }

    function onError(event: ErrorEvent) {
      logError({
        source: "client",
        message: event.message || "Unhandled error",
        stack: event.error?.stack ?? null,
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      logError({
        source: "client",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack ?? null : null,
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
