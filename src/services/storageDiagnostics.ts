import { exportData } from "./storageService";

export type StorageEstimate = {
  supported: boolean;
  usageBytes?: number;
  quotaBytes?: number;
};

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
