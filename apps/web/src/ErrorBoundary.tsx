import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * One render throw used to blank the whole portal to white — including for a
 * student who only wanted to read a guide. This keeps the page, says what
 * happened and offers a way back.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Portal render failed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="auth-shell">
        <div className="auth-card" role="alert">
          <p className="eyebrow">Something went wrong</p>
          <h1>This screen could not load.</h1>
          <p className="muted">
            Nothing you sent has been lost. Reload the page to try again, or open the Student Portal to keep reading.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload the page
          </button>
          <a className="ghost-button" href="/student">
            Open the Student Portal
          </a>
        </div>
      </main>
    );
  }
}
