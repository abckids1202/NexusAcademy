import { Link } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { ShellCard } from "../components/common/ShellCard";

export function PrivacyPage() {
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Privacy and data"
        title="Your WheelForge data"
        description="WheelForge is local-first. This page describes what the current application stores and what optional cloud actions send."
      />
      <div className="dashboard-grid privacy-grid">
        <ShellCard title="Stored in this browser" description="These records stay in the browser unless you export or upload them yourself.">
          <ul className="privacy-list">
            <li>Wheels, options, generator chains, templates, participants, tournaments, settings, and local history.</li>
            <li>Workspace data is stored under the versioned <code>wheelforge_data_v1</code> localStorage key.</li>
            <li>Support diagnostics are a separate, bounded browser log and do not contain workspace backups.</li>
          </ul>
        </ShellCard>
        <ShellCard title="Optional cloud backup" description="Cloud features are disabled unless this deployment is configured and you choose to use them.">
          <ul className="privacy-list">
            <li>Account authentication is handled by Supabase Auth.</li>
            <li>Uploading a backup sends the current workspace to your private Supabase row.</li>
            <li>Restore, cloud-backup deletion, and account deletion are explicit actions; there is no automatic sync.</li>
            <li>Row-level security is intended to prevent one account from accessing another account's backup.</li>
          </ul>
        </ShellCard>
        <ShellCard title="Your controls" description="You remain in control of local and optional cloud data.">
          <ul className="privacy-list">
            <li>Use Settings to export, import, merge, reset, or clear local data.</li>
            <li>Use Settings to download or clear support diagnostics.</li>
            <li>Use Settings to restore or delete an optional cloud backup.</li>
            <li>Review a backup before sharing it; exported files can contain participant and event data.</li>
          </ul>
          <div className="hero-actions">
            <Link className="secondary-link" to="/settings">Open Settings</Link>
          </div>
        </ShellCard>
        <ShellCard title="Technical boundary" description="This page describes the current software behavior, not a legal privacy policy.">
          <p className="muted">Before a public launch, the product owner should review this notice with the applicable legal and data-retention requirements, add an operator contact, and publish any required terms separately.</p>
          <p className="privacy-updated">Last reviewed: October 9, 2026</p>
        </ShellCard>
      </div>
    </div>
  );
}
