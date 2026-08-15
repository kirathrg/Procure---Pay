import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Without this, an uncaught render error anywhere in the tree unmounts the
 * whole app and leaves a blank white page with no indication of what
 * happened — indistinguishable from "the app reloaded" or "the session
 * cleared." This makes the failure visible and gives a way back without a
 * hard refresh, and the error message/stack is what actually pinpoints the
 * real bug instead of guessing from symptoms alone. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
          <p className="font-heading text-[16px] font-medium text-text">Something went wrong</p>
          <p className="max-w-md text-[13px] text-text-faint">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-2 rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-white transition-colors duration-150 ease-out hover:bg-primary-hover"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
