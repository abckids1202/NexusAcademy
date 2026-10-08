import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Cloud, CloudDownload, CloudUpload, Download, LogIn, LogOut, RotateCcw, Trash2, Upload } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { ShellCard } from "../components/common/ShellCard";
import type { UserSettings, WheelForgeData } from "../types";
import { getStorageHealth, getPreservedCorruptData, getImportReviewSummary, STORAGE_KEY, importData, loadData, mergeImportData, parseImportData, resetData, saveSettingsPatch, seedDemoData } from "../services/storageService";
import { useDataRevision } from "../hooks/useDataRevision";
import {
  deleteCloudAccount,
  deleteCloudBackup,
  getCloudUser,
  isCloudBackupConfigured,
  readCloudBackup,
  requestCloudPasswordReset,
  signInWithEmail,
  signOutCloudUser,
  signUpWithEmail,
  subscribeToCloudUserChanges,
  updateCloudPassword,
  writeCloudBackup,
} from "../services/cloudBackupService";

function applyPreferences(settings: UserSettings) {
  const theme = settings.theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : settings.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
  document.documentElement.dataset.animationsEnabled = String(settings.animationsEnabled);
}

export function SettingsPage() {
  const dataRevision = useDataRevision();
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<UserSettings>(() => loadData().settings);
  const [message, setMessage] = useState("");
  const [importReview, setImportReview] = useState<{ data: WheelForgeData; current: WheelForgeData; fingerprint: string } | null>(null);
  const cloudConfigured = isCloudBackupConfigured();
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudPassword, setCloudPassword] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMessage, setCloudMessage] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [showRecoveryRequest, setShowRecoveryRequest] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deleteAccountPhrase, setDeleteAccountPhrase] = useState("");
  const preservedCorruptData = getPreservedCorruptData();

  useEffect(() => {
    if (!cloudConfigured) return;
    let active = true;
    void getCloudUser().then((user) => {
      if (active) setCloudUser(user);
    }).catch((error: unknown) => {
      if (active) setCloudError(error instanceof Error ? error.message : "Could not check cloud account status.");
    });
    const unsubscribe = subscribeToCloudUserChanges(setCloudUser);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [cloudConfigured]);

  useEffect(() => {
    applyPreferences(settings);
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemThemeChange = () => {
      if (settings.theme === "system") applyPreferences(settings);
    };
    if (settings.theme === "system") media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, [settings]);

  useEffect(() => {
    setSettings(loadData().settings);
  }, [dataRevision]);

  function update<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSettings(saveSettingsPatch({ [key]: value }));
    setMessage("Preferences saved.");
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(loadData(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wheelforge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Backup downloaded.");
  }

  function exportPreservedData() {
    const raw = getPreservedCorruptData();
    if (raw === undefined) return;
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wheelforge-preserved-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Preserved raw workspace downloaded without changing browser storage.");
  }

  async function importBackup(file?: File) {
    if (!file) return;
    try {
      const importedData = parseImportData(await file.text());
      const current = loadData();
      setImportReview({ data: importedData, current, fingerprint: JSON.stringify(current) });
      setMessage("");
    } catch {
      setImportReview(null);
      setMessage("That file is not a valid WheelForge backup.");
    }
  }

  function applyLocalImport(mode: "replace" | "merge") {
    if (!importReview) return;
    if (getPreservedCorruptData() !== undefined && mode !== "replace") return;
    const current = loadData();
    if (JSON.stringify(current) !== importReview.fingerprint) {
      setImportReview({ ...importReview, current, fingerprint: JSON.stringify(current) });
      setMessage("Your workspace changed while the backup was open. Review the refreshed counts, then choose again.");
      return;
    }
    const imported = mode === "replace" ? importData(importReview.data) : importData(mergeImportData(current, importReview.data));
    setSettings(imported.settings);
    setImportReview(null);
    const storageAfterImport = getStorageHealth();
    setMessage(getPreservedCorruptData() !== undefined
      ? "Backup loaded for this session, but browser storage could not replace the damaged workspace. The original is still preserved; download it and retry when storage is available."
      : storageAfterImport.mode === "memory" && storageAfterImport.reason === "quota-exceeded"
        ? "Backup loaded for this session, but browser storage is full. Export the backup and clear unused local data before retrying."
      : mode === "replace"
        ? `Backup restored: ${imported.wheels.length} wheels and ${imported.chains.length} generators.`
        : `Backup merged: ${imported.wheels.length} wheels and ${imported.chains.length} generators in your workspace.`);
  }

  function resetWorkspace() {
    if (!window.confirm("Reset all WheelForge data on this device? Export a backup first if you may need it.")) return;
    const clean = resetData();
    setSettings(clean.settings);
    if (getPreservedCorruptData() !== undefined) {
      setMessage("Reset could not replace the damaged workspace because browser storage is unavailable. The original remains preserved; download it and retry later.");
      return;
    }
    setMessage("Workspace reset.");
    window.location.reload();
  }

  function loadDemo() {
    const seeded = seedDemoData();
    setSettings(seeded.settings);
    setMessage("Demo wheels and chains restored.");
    window.location.reload();
  }

  async function handleCloudAuth(action: "sign-in" | "sign-up") {
    setCloudBusy(true);
    setCloudError("");
    setCloudMessage("");
    try {
      const result = action === "sign-in"
        ? await signInWithEmail(cloudEmail.trim(), cloudPassword)
        : await signUpWithEmail(cloudEmail.trim(), cloudPassword);
      setCloudUser(result.session ? result.user : null);
      setCloudPassword("");
      setCloudMessage(action === "sign-up" && !result.session
        ? "Account created. Check your email to confirm, then sign in."
        : action === "sign-up" ? "Account created and signed in." : "Signed in.");
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Could not authenticate with the cloud service.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function sendPasswordReset() {
    setCloudBusy(true);
    setCloudError("");
    setCloudMessage("");
    try {
      const redirect = new URL("/settings?password-reset=1", window.location.origin).toString();
      await requestCloudPasswordReset(cloudEmail.trim(), redirect);
      setCloudMessage("If an account exists for that email, a password reset link has been sent.");
      setShowRecoveryRequest(false);
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Could not request a password reset.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function saveRecoveredPassword() {
    if (recoveryPassword.length < 8 || recoveryPassword !== recoveryPasswordConfirm) return;
    setCloudBusy(true);
    setCloudError("");
    setCloudMessage("");
    try {
      const user = await updateCloudPassword(recoveryPassword);
      setCloudUser(user);
      setRecoveryPassword("");
      setRecoveryPasswordConfirm("");
      setSearchParams({}, { replace: true });
      setCloudMessage("Password updated. You are now signed in.");
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Could not update the password.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleCloudSignOut() {
    setCloudBusy(true);
    setCloudError("");
    try {
      await signOutCloudUser();
      setCloudUser(null);
      setCloudMessage("Signed out. Your local workspace is unchanged.");
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Could not sign out.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function uploadCloudBackup() {
    setCloudBusy(true);
    setCloudError("");
    setCloudMessage("");
    try {
      const health = getStorageHealth();
      if (health.mode !== "persistent") {
        throw new Error("Local storage is currently temporary or unreadable. Export/recover your data before uploading it.");
      }
      const previous = await readCloudBackup();
      const detail = previous ? ` This replaces the backup last updated ${new Date(previous.updatedAt).toLocaleString()}.` : "";
      if (!window.confirm(`Upload this browser's entire WheelForge workspace to your private cloud backup?${detail}`)) return;
      const updatedAt = await writeCloudBackup(loadData());
      setCloudMessage(`Cloud backup updated ${new Date(updatedAt).toLocaleString()}.`);
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Could not upload the cloud backup.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function restoreCloudBackup() {
    setCloudBusy(true);
    setCloudError("");
    setCloudMessage("");
    try {
      const backup = await readCloudBackup();
      if (!backup) {
        setCloudMessage("No cloud backup exists for this account yet.");
        return;
      }
      if (!window.confirm(`Replace this browser's entire WheelForge workspace with the cloud backup from ${new Date(backup.updatedAt).toLocaleString()}?`)) return;
      const imported = importData(backup.data);
      setSettings(imported.settings);
      setCloudMessage(`Cloud backup restored: ${imported.wheels.length} wheels and ${imported.chains.length} generators.`);
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Could not restore the cloud backup.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function removeCloudBackup() {
    if (!window.confirm("Delete your private WheelForge cloud backup? Your local workspace will not be changed.")) return;
    setCloudBusy(true);
    setCloudError("");
    try {
      await deleteCloudBackup();
      setCloudMessage("Cloud backup deleted. Your local workspace is unchanged.");
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Could not delete the cloud backup.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleDeleteCloudAccount() {
    if (!cloudUser?.email || deleteAccountPhrase !== "DELETE" || deleteAccountPassword.length < 8) return;
    setCloudBusy(true);
    setCloudError("");
    setCloudMessage("");
    try {
      await signInWithEmail(cloudUser.email, deleteAccountPassword);
      await deleteCloudAccount();
      setCloudUser(null);
      setDeleteAccountPassword("");
      setDeleteAccountPhrase("");
      setCloudMessage("Cloud account and cloud backup deleted. Your local workspace is unchanged.");
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Could not delete the cloud account.");
    } finally {
      setCloudBusy(false);
    }
  }

  return <div className="stack">
    <PageHeader eyebrow="Preferences" title="Settings" description="Choose how WheelForge looks and behaves, and keep your local data portable." />
    <div className="dashboard-grid settings-grid">
      <ShellCard title="Appearance and motion" description="These preferences are stored with this browser's WheelForge data.">
        <div className="settings-fields">
          <label className="field-stack"><span>Theme</span><select className="select-field" value={settings.theme} onChange={(event) => update("theme", event.target.value as UserSettings["theme"])}><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></label>
          <label className="field-stack"><span>Default spin duration · {settings.defaultSpinDurationMs / 1000}s</span><input className="range-field" type="range" min="2500" max="10000" step="100" value={settings.defaultSpinDurationMs} onChange={(event) => update("defaultSpinDurationMs", Number(event.target.value))} /></label>
          <label className="field-stack"><span>Default segment layout</span><select className="select-field" value={settings.defaultVisualMode} onChange={(event) => update("defaultVisualMode", event.target.value as UserSettings["defaultVisualMode"])}><option value="equal">Equal segments</option><option value="weighted">Weighted segments</option></select></label>
          <label className="field-stack"><span>Default spin behavior</span><select className="select-field" value={settings.defaultSpinMode} onChange={(event) => update("defaultSpinMode", event.target.value as UserSettings["defaultSpinMode"])}><option value="normal">Normal</option><option value="no-repeat">No repeat</option><option value="elimination">Elimination</option><option value="accumulation">Accumulate counts</option></select></label>
          {([ ["animationsEnabled", "Animations"], ["confettiEnabled", "Confetti effects"], ["soundsEnabled", "Sound effects"], ["reducedMotion", "Reduce motion"] ] as const).map(([key, label]) => <label className="setting-toggle" key={key}><span>{label}</span><input type="checkbox" checked={settings[key]} onChange={(event) => update(key, event.target.checked)} /></label>)}
        </div>
      </ShellCard>
      <ShellCard title="Your data" description="This version keeps your projects in localStorage on this device.">
        <div className="settings-fields">
          <p className="storage-key">Storage key <code>{STORAGE_KEY}</code></p>
          {preservedCorruptData !== undefined && <section className="storage-recovery" aria-labelledby="storage-recovery-title">
            <h3 id="storage-recovery-title">Recover damaged workspace</h3>
            <p>The original saved value is preserved. Download it for diagnosis, then import a valid backup with Replace or reset local data. Merge is disabled because the saved workspace cannot be trusted.</p>
            <button className="secondary-link" type="button" onClick={exportPreservedData}><Download size={16} /> Download preserved raw data</button>
          </section>}
          <button className="secondary-link" type="button" disabled={preservedCorruptData !== undefined} onClick={exportBackup}><Download size={16} /> Export full backup</button>
          <label className="secondary-link file-button"><Upload size={16} /> Import backup<input type="file" accept="application/json,.json" onChange={(event) => { void importBackup(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
          {importReview && (() => {
            const summary = getImportReviewSummary(importReview.current, importReview.data);
            return <section className="import-review" aria-labelledby="import-review-title">
              <h3 id="import-review-title">Review backup</h3>
              <p className="muted">{preservedCorruptData !== undefined
                ? "This backup is valid. Replace the damaged workspace to recover; merging is unavailable because the saved data cannot be trusted."
                : "Choose how to apply this validated backup. Replace restores everything, including preferences. Merge keeps matching records from this browser and keeps its current preferences."}</p>
              <dl className="import-review-counts">
                {Object.entries(summary.counts).map(([key, counts]) => <div key={key}><dt>{key === "spinResults" ? "Spin results" : key === "chainSessions" ? "Generator sessions" : key === "userTemplates" ? "Saved templates" : key[0].toUpperCase() + key.slice(1)}</dt><dd>{counts.incoming} in backup · {counts.current} here · {counts.new} new</dd></div>)}
                <div><dt>Favorites / recent templates</dt><dd>{importReview.data.favoriteTemplateIds.length} / {importReview.data.recentTemplateIds.length} in backup</dd></div>
              </dl>
              {preservedCorruptData === undefined && <p className="muted">Merge policy: matching IDs keep the current record{summary.idConflicts === 1 ? "" : "s"}; new IDs are added. {summary.idConflicts} ID conflict{summary.idConflicts === 1 ? "" : "s"} found.</p>}
              <div className="hero-actions">
                {preservedCorruptData === undefined && <button className="primary-link" type="button" onClick={() => applyLocalImport("merge")}>Merge into this browser</button>}
                <button className="danger-button" type="button" onClick={() => applyLocalImport("replace")}>Replace existing data</button>
                <button className="secondary-link" type="button" onClick={() => { setImportReview(null); setMessage("Import canceled."); }}>Cancel</button>
              </div>
            </section>;
          })()}
          <button className="secondary-link" type="button" disabled={preservedCorruptData !== undefined} onClick={loadDemo}><RotateCcw size={16} /> Restore demo data</button>
          <button className="danger-button reset-button" type="button" onClick={resetWorkspace}>Reset all local data</button>
          {message && <p className="status-note" role="status">{message}</p>}
        </div>
      </ShellCard>
      <ShellCard title="Private cloud backup" description="Optional account-backed backup. Upload and restore are always manual; this does not merge or live-sync devices.">
        <div className="settings-fields cloud-backup-fields">
          {!cloudConfigured ? <p className="muted">Cloud backup is not configured in this deployment. Local wheels, generators, and tournaments continue to work normally.</p> : searchParams.get("password-reset") === "1" ? cloudUser ? <form className="settings-fields" onSubmit={(event) => { event.preventDefault(); void saveRecoveredPassword(); }}>
            <p className="muted">Choose a new password for {cloudUser.email}.</p>
            <label className="field-stack"><span>New password</span><input className="text-field" type="password" autoComplete="new-password" minLength={8} required value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} /></label>
            <label className="field-stack"><span>Confirm new password</span><input className="text-field" type="password" autoComplete="new-password" minLength={8} required value={recoveryPasswordConfirm} onChange={(event) => setRecoveryPasswordConfirm(event.target.value)} /></label>
            {recoveryPasswordConfirm && recoveryPassword !== recoveryPasswordConfirm && <p className="validation-message" role="alert">Passwords do not match.</p>}
            <div className="hero-actions"><button className="primary-link" type="submit" disabled={cloudBusy || recoveryPassword.length < 8 || recoveryPassword !== recoveryPasswordConfirm}><LogIn size={16} /> Update password</button></div>
          </form> : <div className="settings-fields"><p className="muted">This password reset link is invalid or expired. Request a new link to continue.</p><button className="secondary-link" type="button" onClick={() => { setSearchParams({}, { replace: true }); setShowRecoveryRequest(false); setCloudMessage(""); }}><LogIn size={16} /> Return to sign in</button></div> : cloudUser ? <>
            <p className="cloud-account"><Cloud size={17} /> Signed in as <strong>{cloudUser.email}</strong></p>
            <div className="hero-actions">
              <button className="secondary-link" type="button" disabled={cloudBusy} onClick={() => void uploadCloudBackup()}><CloudUpload size={16} /> Upload local workspace</button>
              <button className="secondary-link" type="button" disabled={cloudBusy} onClick={() => void restoreCloudBackup()}><CloudDownload size={16} /> Restore cloud backup</button>
              <button className="danger-button" type="button" disabled={cloudBusy} onClick={() => void removeCloudBackup()}><Trash2 size={16} /> Delete cloud backup</button>
              <button className="secondary-link" type="button" disabled={cloudBusy} onClick={() => void handleCloudSignOut()}><LogOut size={16} /> Sign out</button>
            </div>
            <details className="cloud-danger-zone">
              <summary>Delete cloud account</summary>
              <p>This permanently deletes your WheelForge cloud account and its cloud backup. Data stored in this browser will remain.</p>
              <label className="field-stack"><span>Re-enter your password</span><input className="text-field" type="password" autoComplete="current-password" minLength={8} required value={deleteAccountPassword} onChange={(event) => setDeleteAccountPassword(event.target.value)} /></label>
              <label className="field-stack"><span>Type DELETE to confirm</span><input className="text-field" autoComplete="off" value={deleteAccountPhrase} onChange={(event) => setDeleteAccountPhrase(event.target.value)} /></label>
              <button className="danger-button" type="button" disabled={cloudBusy || !cloudUser.email || deleteAccountPassword.length < 8 || deleteAccountPhrase !== "DELETE"} onClick={() => void handleDeleteCloudAccount()}><Trash2 size={16} /> Permanently delete account</button>
            </details>
          </> : showRecoveryRequest ? <form className="settings-fields" onSubmit={(event) => { event.preventDefault(); void sendPasswordReset(); }}>
            <p className="muted">Enter your account email. If it is registered, we will send a password reset link.</p>
            <label className="field-stack"><span>Email</span><input className="text-field" type="email" autoComplete="email" required value={cloudEmail} onChange={(event) => setCloudEmail(event.target.value)} /></label>
            <div className="hero-actions"><button className="primary-link" type="submit" disabled={cloudBusy}><LogIn size={16} /> Send reset link</button><button className="secondary-link" type="button" disabled={cloudBusy} onClick={() => setShowRecoveryRequest(false)}>Back to sign in</button></div>
          </form> : <form className="settings-fields" onSubmit={(event) => { event.preventDefault(); void handleCloudAuth("sign-in"); }}>
            <label className="field-stack"><span>Email</span><input className="text-field" type="email" autoComplete="email" required value={cloudEmail} onChange={(event) => setCloudEmail(event.target.value)} /></label>
            <label className="field-stack"><span>Password</span><input className="text-field" type="password" autoComplete="current-password" minLength={8} required value={cloudPassword} onChange={(event) => setCloudPassword(event.target.value)} /></label>
            <div className="hero-actions">
              <button className="primary-link" type="submit" disabled={cloudBusy}><LogIn size={16} /> Sign in</button>
              <button className="secondary-link" type="button" disabled={cloudBusy || !cloudEmail.includes("@") || cloudPassword.length < 8} onClick={() => void handleCloudAuth("sign-up")}>Create account</button>
              <button className="secondary-link" type="button" disabled={cloudBusy} onClick={() => { setShowRecoveryRequest(true); setCloudError(""); setCloudMessage(""); }}>Forgot password?</button>
            </div>
          </form>}
          {cloudError && <p className="validation-message" role="alert">{cloudError}</p>}
          {cloudMessage && <p className="status-note" role="status">{cloudMessage}</p>}
        </div>
      </ShellCard>
    </div>
  </div>;
}
