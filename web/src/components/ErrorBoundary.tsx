import { Component, type ReactNode } from "react";

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  render() {
    if (this.state.error)
      return (
        <div role="alert" style={{ border: "2px solid #c00", borderRadius: 8, padding: 16 }}>
          <h2>Something broke while rendering</h2>
          <p>
            <code>{this.state.error}</code>
          </p>
          <p style={{ color: "#555", fontSize: 13 }}>
            The loaded JSON likely has an unexpected shape. Load a file produced by{" "}
            <code>python -m historian --out historian.json</code>, or{" "}
            <button onClick={() => this.setState({ error: null })}>dismiss</button>.
          </p>
        </div>
      );
    return this.props.children;
  }
}
