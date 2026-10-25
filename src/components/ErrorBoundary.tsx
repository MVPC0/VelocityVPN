import React from 'react';

/**
 * Keeps a failing decorative part (3D canvas, map) from unmounting the whole
 * page: renders `fallback` instead and logs the error.
 */
export default class ErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; children: React.ReactNode; name?: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(`${this.props.name ?? 'Section'} failed to render; showing fallback.`, error);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
