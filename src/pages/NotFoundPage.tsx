import { Link } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";

export function NotFoundPage() {
  return (
    <PageHeader
      eyebrow="404 · Not found"
      title="That page isn't here"
      description="The address may be outdated, or the page may have moved. Your wheels and generators are still available."
      actions={(
        <div className="topbar-actions">
          <Link className="secondary-link" to="/">Home</Link>
          <Link className="primary-link" to="/dashboard">Open dashboard</Link>
        </div>
      )}
    />
  );
}
