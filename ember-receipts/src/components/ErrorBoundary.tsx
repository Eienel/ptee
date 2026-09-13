import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Without this, any error thrown during render unmounts the whole tree and
 * leaves a blank page — which is exactly what a bad RPC endpoint did in
 * production. Showing the message is worth more than showing nothing.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ember Receipts crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="page">
        <div className="crash">
          <h1>Something broke</h1>
          <p className="msg">{error.message}</p>
          <p>
            If this mentions the endpoint URL, the RPC setting is empty or malformed. Clear it
            and reload, or set a valid https endpoint.
          </p>
          <div className="crash-actions">
            <button
              className="primary"
              onClick={() => {
                localStorage.removeItem('ember.rpc');
                location.href = location.pathname;
              }}
            >
              Reset settings and reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
