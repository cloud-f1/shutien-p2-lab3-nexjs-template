import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    color: "var(--white)",
    fontFamily: "var(--font-body)",
    padding: "24px",
  } as const,
  card: {
    maxWidth: 480,
    width: "100%",
    textAlign: "center" as const,
    padding: "48px 32px",
    border: "1px solid var(--border)",
    borderRadius: 14,
    background: "var(--bg2)",
  } as const,
  icon: {
    fontSize: 48,
    marginBottom: 16,
    color: "var(--red)",
  } as const,
  title: {
    fontFamily: "var(--font-display)",
    fontSize: 24,
    letterSpacing: "-0.02em",
    marginBottom: 12,
    color: "var(--white)",
  } as const,
  message: {
    fontSize: 14,
    color: "var(--gray)",
    lineHeight: 1.6,
    marginBottom: 32,
  } as const,
  errorDetail: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--red)",
    background: "rgba(255,79,79,0.06)",
    border: "1px solid rgba(255,79,79,0.2)",
    borderRadius: 6,
    padding: "12px 14px",
    marginBottom: 32,
    textAlign: "left" as const,
    wordBreak: "break-word" as const,
  } as const,
  actions: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
  } as const,
  retryButton: {
    padding: "11px 24px",
    background: "var(--amber)",
    color: "#000",
    border: "none",
    borderRadius: 6,
    fontFamily: "var(--font-body)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    letterSpacing: "0.04em",
  } as const,
  homeLink: {
    padding: "11px 24px",
    background: "var(--bg3)",
    color: "var(--gray)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontFamily: "var(--font-body)",
    fontSize: 14,
    textDecoration: "none",
    letterSpacing: "0.04em",
  } as const,
};

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>!</div>
            <h1 style={styles.title}>Something went wrong</h1>
            <p style={styles.message}>
              An unexpected error occurred. You can try again or return to the
              home page.
            </p>
            {import.meta.env.DEV && (
              <div style={styles.errorDetail} data-testid="error-detail">
                {this.state.error.message}
              </div>
            )}
            <div style={styles.actions}>
              <button
                style={styles.retryButton}
                onClick={this.handleReset}
                type="button"
              >
                Try again
              </button>
              <Link to="/" style={styles.homeLink}>
                Go home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
