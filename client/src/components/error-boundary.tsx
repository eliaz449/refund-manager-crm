import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  name?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    const msg = `[ErrorBoundary:${this.props.name ?? "app"}] ${error?.message ?? error}\n${info.componentStack}`;
    console.error(msg);
    try {
      fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: this.props.name ?? "app", message: error?.message, stack: error?.stack, componentStack: info.componentStack }),
      }).catch(() => {});
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: 24, fontFamily: "monospace", direction: "ltr" }}>
          <h2 style={{ color: "red" }}>Application Error</h2>
          <pre style={{ background: "#fee", padding: 12, overflow: "auto", fontSize: 12 }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
