import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  variant?: "page" | "inline";
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("MADY boundary caught an error", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <ErrorState
        title={this.props.fallbackTitle}
        message={this.props.fallbackMessage || this.state.error.message}
        variant={this.props.variant}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}

export function ErrorState({
  title = "Something needs attention.",
  message = "This part could not load. The rest of the site can keep running.",
  variant = "page",
  onRetry,
}: {
  title?: string;
  message?: string;
  variant?: "page" | "inline";
  onRetry?: () => void;
}) {
  return (
    <section className={`error-state ${variant}`} role="alert">
      <AlertTriangle size={variant === "inline" ? 20 : 34} aria-hidden="true" />
      <div>
        <span>Recovered error</span>
        <h1>{title}</h1>
        <p>{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" />
            Try again
          </button>
        )}
      </div>
    </section>
  );
}
