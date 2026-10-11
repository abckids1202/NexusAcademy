const DIAGNOSTICS_KEY = "wheelforge_runtime_diagnostics_v1";
const MAX_EVENTS = 40;

export type RuntimeDiagnostic = {
  occurredAt: string;
  kind: "window-error" | "unhandled-rejection" | "page-render-error";
  detail: string;
};

function getStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function readDiagnostics(): RuntimeDiagnostic[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(DIAGNOSTICS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is RuntimeDiagnostic => {
      if (!item || typeof item !== "object") return false;
      const value = item as Record<string, unknown>;
      return typeof value.occurredAt === "string" &&
        ["window-error", "unhandled-rejection", "page-render-error"].includes(String(value.kind)) &&
        typeof value.detail === "string";
    }).slice(-MAX_EVENTS);
  } catch {
    return [];
  }
}

function sanitizeDetail(detail: string): string {
  return detail
    .replace(/[\r\n]+/g, " ")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .trim()
    .slice(0, 160) || "Unspecified runtime failure";
}

function describeUnknownError(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name || "Error"}: ${value.message || "No error message"}`;
  }
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return `Unhandled ${Object.prototype.toString.call(value).slice(8, -1).toLowerCase()}`;
  return "Unhandled browser error";
}

function sanitizeSource(source: string): string {
  try {
    const url = new URL(source);
    return `${url.origin}${url.pathname}`;
  } catch {
    return source.split(/[?#]/, 1)[0] || "unknown-source";
  }
}

export function getRuntimeDiagnostics(): RuntimeDiagnostic[] {
  return readDiagnostics();
}

export function recordRuntimeDiagnostic(kind: RuntimeDiagnostic["kind"], detail: string): void {
  const storage = getStorage();
  if (!storage) return;
  const event: RuntimeDiagnostic = {
    occurredAt: new Date().toISOString(),
    kind,
    detail: sanitizeDetail(detail),
  };
  try {
    storage.setItem(DIAGNOSTICS_KEY, JSON.stringify([...readDiagnostics(), event].slice(-MAX_EVENTS)));
  } catch {
    // Diagnostics must never interfere with the application when storage is full or blocked.
  }
}

export function clearRuntimeDiagnostics(): void {
  try {
    getStorage()?.removeItem(DIAGNOSTICS_KEY);
  } catch {
    // Best-effort cleanup only.
  }
}

export function exportRuntimeDiagnostics(): string {
  return JSON.stringify({
    schema: 1,
    exportedAt: new Date().toISOString(),
    environment: typeof navigator === "undefined"
      ? { userAgent: "unavailable", language: "unavailable" }
      : { userAgent: navigator.userAgent, language: navigator.language },
    events: readDiagnostics(),
  }, null, 2);
}

export function installRuntimeDiagnostics(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onError = (event: ErrorEvent) => {
    const source = event.filename ? ` (${sanitizeSource(event.filename)}:${event.lineno ?? 0}:${event.colno ?? 0})` : "";
    recordRuntimeDiagnostic("window-error", `${describeUnknownError(event.error ?? event.message)}${source}`);
  };
  const onRejection = (event: PromiseRejectionEvent) => recordRuntimeDiagnostic("unhandled-rejection", describeUnknownError(event.reason));
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
