import { afterEach, describe, expect, it, vi } from "vitest";
import { formatStorageBytes, getStorageEstimate, getWorkspaceSizeBytes } from "./storageDiagnostics";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storage diagnostics", () => {
  it("formats workspace sizes for readable settings text", () => {
    expect(formatStorageBytes(512)).toBe("512 B");
    expect(formatStorageBytes(2048)).toBe("2.0 KB");
    expect(formatStorageBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  it("reports a workspace size even when browser storage is unavailable", () => {
    expect(getWorkspaceSizeBytes()).toBeGreaterThan(0);
  });

  it("fails closed when the browser does not expose storage estimates", async () => {
    vi.stubGlobal("navigator", {});
    await expect(getStorageEstimate()).resolves.toEqual({ supported: false });
  });

  it("returns a supported estimate when the browser provides one", async () => {
    vi.stubGlobal("navigator", {
      storage: { estimate: vi.fn().mockResolvedValue({ usage: 100, quota: 1000 }) },
    });
    await expect(getStorageEstimate()).resolves.toEqual({ supported: true, usageBytes: 100, quotaBytes: 1000 });
  });

  it("fails closed when the estimate API rejects", async () => {
    vi.stubGlobal("navigator", {
      storage: { estimate: vi.fn().mockRejectedValue(new Error("blocked")) },
    });
    await expect(getStorageEstimate()).resolves.toEqual({ supported: false });
  });
});
