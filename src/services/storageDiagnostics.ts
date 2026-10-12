import { exportData } from "./storageService";

export type StorageEstimate = {
  supported: boolean;
  usageBytes?: number;
  quotaBytes?: number;
};

export type StorageRisk = "healthy" | "warning" | "critical";

const WORKSPACE_WARNING_BYTES = 2 * 1024 * 1024;
const WORKSPACE_CRITICAL_BYTES = 4 * 1024 * 1024;
const QUOTA_WARNING_RATIO = 0.75;
const QUOTA_CRITICAL_RATIO = 0.9;

export function getWorkspaceSizeBytes(): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(exportData()).byteLength;
  return exportData().length;
}

export async function getStorageEstimate(): Promise<StorageEstimate> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return { supported: false };
  try {
    const estimate = await navigator.storage.estimate();
    return {
      supported: typeof estimate.usage === "number" && typeof estimate.quota === "number",
      usageBytes: estimate.usage,
      quotaBytes: estimate.quota,
    };
  } catch {
    return { supported: false };
  }
}

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getStorageRisk(workspaceSizeBytes: number, estimate: StorageEstimate): StorageRisk {
  const workspaceRisk = workspaceSizeBytes >= WORKSPACE_CRITICAL_BYTES
    ? "critical"
    : workspaceSizeBytes >= WORKSPACE_WARNING_BYTES ? "warning" : "healthy";
  const quotaRatio = estimate.supported && typeof estimate.usageBytes === "number" && typeof estimate.quotaBytes === "number" && estimate.quotaBytes > 0
    ? estimate.usageBytes / estimate.quotaBytes
    : 0;
  const quotaRisk = quotaRatio >= QUOTA_CRITICAL_RATIO
    ? "critical"
    : quotaRatio >= QUOTA_WARNING_RATIO ? "warning" : "healthy";
  return workspaceRisk === "critical" || quotaRisk === "critical"
    ? "critical"
    : workspaceRisk === "warning" || quotaRisk === "warning" ? "warning" : "healthy";
}
