import React, { Component, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[Root Error Boundary Caught]:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg">
            TK
          </div>
          <div>
            <h2 className="text-lg font-bold">Teams Krypton</h2>
            <p className="text-xs text-destructive font-mono mt-1 max-w-xs break-words">
              {this.state.error?.message || 'An initialization issue occurred during startup.'}
            </p>
            {this.state.error?.stack && (
              <div className="mt-2 p-2 bg-muted/80 border border-border rounded text-[10px] font-mono text-left max-w-sm max-h-36 overflow-auto text-muted-foreground">
                {this.state.error.stack}
              </div>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold shadow hover:opacity-90 transition-opacity"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  );
}
