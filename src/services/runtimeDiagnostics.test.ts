import { afterEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeDiagnostics, exportRuntimeDiagnostics, getRuntimeDiagnostics, recordRuntimeDiagnostic } from "./runtimeDiagnostics";

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
});
