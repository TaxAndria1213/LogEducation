const SENSITIVE_USER_FIELDS = new Set([
  "mot_de_passe_hash",
]);

function stripSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripSensitiveFields(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitizedEntries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !SENSITIVE_USER_FIELDS.has(key))
    .map(([key, nestedValue]) => [key, stripSensitiveFields(nestedValue)]);

  return Object.fromEntries(sanitizedEntries);
}

export function sanitizeUserResponse<T>(value: T): T {
  return stripSensitiveFields(value) as T;
}
