import React from "react";

type AppErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

export default class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown render error",
    };
  }

  componentDidCatch(error: unknown) {
    // Keep this visible in console for debugging production crashes.
    console.error("AppErrorBoundary caught error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen bg-[#F5F3EF] text-[#121212] flex items-center justify-center px-6">
            <div className="max-w-md w-full rounded-2xl border border-[#E7E3DB] bg-[#FBFAF7] p-6 shadow-sm">
              <h1 className="text-xl font-semibold">Mo Katha hit an unexpected issue</h1>
              <p className="mt-2 text-sm text-[#6B6B6B]">
                The app recovered safely. Please refresh this page. If it still fails, check environment setup.
              </p>
              {this.state.message ? (
                <p className="mt-4 text-xs rounded-md bg-[#E7E3DB] px-3 py-2 break-all">{this.state.message}</p>
              ) : null}
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
