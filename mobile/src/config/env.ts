type EnvMap = Record<string, string | undefined>;

const env =
  ((globalThis as { process?: { env?: EnvMap } }).process?.env ?? {}) as EnvMap;

export const API_BASE_URL =
  env.EXPO_PUBLIC_API_BASE_URL?.trim() || "http://10.0.2.2:3045";

export const SYSTEM_API_BASE_URL =
  env.EXPO_PUBLIC_SYSTEM_API_BASE_URL?.trim() || API_BASE_URL;

export const REQUEST_TIMEOUT = 15000;
