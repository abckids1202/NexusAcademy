import { Component, type PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "./PageHeader";
import { recordRuntimeDiagnostic } from "../../services/runtimeDiagnostics";

type RouteErrorBoundaryState = {
  hasError: boolean;
};

export class RouteErrorBoundary extends Component<PropsWithChildren, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    recordRuntimeDiagnostic("page-render-error", "A route failed to render");
    console.error("WheelForge could not render the current page.");
  }

  render() {
    if (this.state.hasError) {
      return (
        <PageHeader
          eyebrow="Page error"
          title="We couldn't load this page"
          description="Your saved workspace is still here. Try reloading, or return to a working page."
          actions={(
            <div className="topbar-actions">
              <button className="secondary-link" onClick={() => window.location.reload()} type="button">
                Reload page
              </button>
              <Link className="primary-link" to="/dashboard">Open dashboard</Link>
            </div>
          )}
        />
      );
    }

    return this.props.children;
  }
}
