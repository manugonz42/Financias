import { Component, type ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, fontSize: 13, color: "var(--text-dim)" }}>
          <div style={{ fontWeight: 600, color: "var(--bad)", marginBottom: 4 }}>
            {this.props.title ?? "Error"}
          </div>
          <div style={{ marginBottom: 8, opacity: 0.7 }}>
            {this.state.error?.message ?? "Algo salió mal."}
          </div>
          <button
            className="link-btn"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
