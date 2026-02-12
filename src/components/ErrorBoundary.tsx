"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error?: Error };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          <h2 className="font-semibold">Something went wrong</h2>
          <p className="mt-1 text-sm">This part of the app crashed. You can try again or go back.</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
