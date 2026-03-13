/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseJSON<T>(value: any, fallback: any): T {
  try {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "object") return value as T;
    if (typeof value === "string" && value.trim() === "") return fallback;
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

export function parseBool(value: any, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  const v = String(value).toLowerCase();
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  return fallback;
}

export function parseNumber(value: any, fallback?: number): number | undefined {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return fallback;
}

export function parseStringArray(value: any): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map(String);

  const s = String(value).trim();
  if (!s) return undefined;

  // accepte JSON ["a","b"] ou CSV "a,b"
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr.map(String) : undefined;
    } catch {
      // fallback csv
    }
  }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
