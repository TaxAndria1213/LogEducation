import { api } from "@/lib/api";
import type { ApiEnvelope, PaginatedCollection } from "@/types/models";

type QueryParams = Record<string, unknown>;

function normalizeParam(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return value;
}

function buildParams(params: QueryParams = {}) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, normalizeParam(value)]),
  );
}

export async function getCollection<T>(
  resource: string,
  params: QueryParams = {},
) {
  const { data } = await api.get<ApiEnvelope<PaginatedCollection<T> | T[]>>(
    `/api/${resource}`,
    {
      params: buildParams(params),
    },
  );

  if (Array.isArray(data.data)) {
    return {
      data: data.data,
      meta: {
        take: data.data.length,
        hasNextPage: false,
      },
    } satisfies PaginatedCollection<T>;
  }

  return data.data as PaginatedCollection<T>;
}

export async function getRows<T>(resource: string, params: QueryParams = {}) {
  const collection = await getCollection<T>(resource, params);
  return collection.data ?? [];
}

export async function getFirst<T>(resource: string, params: QueryParams = {}) {
  const rows = await getRows<T>(resource, {
    take: 1,
    ...params,
  });

  return rows[0] ?? null;
}
