import { useEffect, useState, type PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { getStorageHealth, loadData, type StorageHealth } from "../../services/storageService";
import { useDataRevision } from "../../hooks/useDataRevision";

export function AppLayout({ children, standalone = false }: PropsWithChildren & { standalone?: boolean }) {
  const revision = useDataRevision();
  const [storageHealth, setStorageHealth] = useState<StorageHealth>(getStorageHealth);

  useEffect(() => {
    const settings = loadData().settings;
    setStorageHealth(getStorageHealth());
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme = settings.theme === "system"
        ? (media.matches ? "light" : "dark")
        : settings.theme;
      document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
      document.documentElement.dataset.animationsEnabled = String(settings.animationsEnabled);
    };
    apply();
    if (settings.theme === "system") media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [revision]);

  const storageWarning = storageHealth.mode === "memory"
    ? storageHealth.reason === "corrupt"
      ? "The saved workspace is invalid and has been preserved. Changes are temporary; download the raw data, import a valid backup, or reset it in Settings."
      : storageHealth.reason === "write-failed"
        ? "This browser could not save your latest changes. They are temporary until storage is available again."
        : storageHealth.reason === "quota-exceeded"
          ? "Browser storage is full. Export a backup, remove unused wheels or results, then try again. Your latest changes are temporary."
        : "Browser storage is unavailable. Changes will be lost when this page closes."
    : null;

  if (standalone) return <div className="standalone-app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    {storageWarning && <div className="storage-warning" role="alert"><span>{storageWarning}</span><Link to="/settings">Open settings</Link></div>}
    <div className="standalone-page-frame" id="main-content" tabIndex={-1}>{children}</div>
  </div>;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <Sidebar />
    <div className="app-main">
      <Navbar />
      {storageWarning && <div className="storage-warning" role="alert">
        <span>{storageWarning}</span>
        <Link to="/settings">Open settings</Link>
      </div>}
      <main className="page-frame" id="main-content" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
