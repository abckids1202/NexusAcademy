import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";

export function RouterErrorPage() {
  const error = useRouteError();
  const title = isRouteErrorResponse(error) && error.status === 404
    ? "That page isn't here"
    : "We couldn't load WheelForge";

  return (
    <main className="page-frame">
      <PageHeader
        eyebrow="Something went wrong"
        title={title}
        description="Your saved workspace has not been changed. Return to the app and try again."
        actions={(
          <div className="topbar-actions">
            <Link className="secondary-link" to="/">Home</Link>
            <Link className="primary-link" to="/dashboard">Open dashboard</Link>
          </div>
        )}
      />
    </main>
  );
}
