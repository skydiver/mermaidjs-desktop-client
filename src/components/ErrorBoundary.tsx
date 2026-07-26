import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/button';

// ── Types ────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// ── Component ────────────────────────────────────────────

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack);
  }

  handleReset = () => {
    this.props.onReset();
    // Clear the boundary's error state so the tree remounts with recovered settings
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-white p-8 text-center dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-neutral-800 dark:text-slate-100">
          Something went wrong
        </h1>
        <p className="max-w-md text-sm break-words text-neutral-500 dark:text-slate-400">
          {error.message}
        </p>
        <Button variant="default" onClick={this.handleReset}>
          Reset settings
        </Button>
      </div>
    );
  }
}
