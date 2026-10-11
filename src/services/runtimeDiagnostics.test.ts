import { afterEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeDiagnostics, exportRuntimeDiagnostics, getRuntimeDiagnostics, installRuntimeDiagnostics, recordRuntimeDiagnostic } from "./runtimeDiagnostics";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runtime diagnostics", () => {
  it("fails closed outside a browser", () => {
    expect(getRuntimeDiagnostics()).toEqual([]);
    expect(() => recordRuntimeDiagnostic("window-error", "ignored")).not.toThrow();
  });

  it("keeps a bounded, sanitized support log without workspace data", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    vi.stubGlobal("navigator", { userAgent: "Test Browser", language: "en-US" });

    recordRuntimeDiagnostic("page-render-error", "  private\nparticipant name  ");
    expect(getRuntimeDiagnostics()).toHaveLength(1);
    expect(getRuntimeDiagnostics()[0]?.detail).toBe("private participant name");
    expect(exportRuntimeDiagnostics()).not.toContain("wheelforge_data_v1");
    clearRuntimeDiagnostics();
    expect(getRuntimeDiagnostics()).toEqual([]);
  });

  it("captures useful error context while redacting email addresses", () => {
    const storage = new Map<string, string>();
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
      addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    });

    const cleanup = installRuntimeDiagnostics();
    listeners.get("error")?.({
      error: new Error("Upload failed for person@example.com"),
      filename: "https://example.test/assets/app.js",
      lineno: 12,
      colno: 4,
      message: "Upload failed",
    } as ErrorEvent);
    listeners.get("unhandledrejection")?.({ reason: "Promise failed for person@example.com" } as PromiseRejectionEvent);

    expect(getRuntimeDiagnostics().map((event) => event.detail)).toEqual([
      "Error: Upload failed for [redacted-email] (https://example.test/assets/app.js:12:4)",
      "Promise failed for [redacted-email]",
    ]);
    cleanup();
    expect(listeners).toHaveLength(0);
  });
});
