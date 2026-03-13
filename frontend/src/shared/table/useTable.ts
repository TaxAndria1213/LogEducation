/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import {
  type PaginatedResponse,
  type UseTableOptions,
  type UseTableResult,
  type TableQuery,
  type ApiSuccess,
} from "./types";
import { tableQueryToParams } from "./query";

function defaultMapResponse<T>(raw: any): PaginatedResponse<T> {
  const payload = (raw as ApiSuccess<any>)?.data ?? raw;

  if (payload?.data && payload?.meta) {
    return payload as PaginatedResponse<T>;
  }

  return {
    data: Array.isArray(payload) ? payload : [],
    meta: {
      take: Array.isArray(payload) ? payload.length : 0,
      hasNextPage: false,
      total: Array.isArray(payload) ? payload.length : 0,
      page: 1,
      skip: 0,
    },
  };
}

function getSortField(orderBy?: any): { field?: string; dir?: "asc" | "desc" } {
  if (!orderBy) return {};
  if (Array.isArray(orderBy) && orderBy.length) {
    const first = orderBy[0];
    const k = Object.keys(first ?? {})[0];
    return { field: k, dir: (first as any)[k] };
  }
  if (typeof orderBy === "object") {
    const k = Object.keys(orderBy ?? {})[0];
    return { field: k, dir: (orderBy as any)[k] };
  }
  return {};
}

export function useTable<T>(options: UseTableOptions<T>): UseTableResult<T> & { reset: () => void } {
  const { service, initialQuery, mapResponse } = options;

  const initialQueryRef = React.useRef<TableQuery>({
    page: 1,
    take: 10,
    ...initialQuery,
  });

  const [rows, setRows] = React.useState<T[]>([]);
  const [meta, setMeta] = React.useState<any>(undefined);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);

  const [query, setQuery] = React.useState<TableQuery>(initialQueryRef.current);

  const map = React.useMemo(() => mapResponse ?? defaultMapResponse<T>, [mapResponse]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const params = tableQueryToParams(query);
      const raw = await service.getAll(params);

      const paged = map(raw);
      setRows(paged.data ?? []);
      setMeta(paged.meta);
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, [service, query, map]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const setPage = (page: number) =>
    setQuery((q) => ({ ...q, page: Math.max(1, page) }));

  const setTake = (take: number) =>
    setQuery((q) => ({ ...q, take: Math.max(1, take), page: 1 }));

  const setWhere = (where: Record<string, any> | undefined) =>
    setQuery((q) => ({ ...q, where, page: 1 }));

  const patchWhere = (patch: Record<string, any>) =>
    setQuery((q) => ({ ...q, where: { ...(q.where ?? {}), ...patch }, page: 1 }));

  const toggleSort = (field: string) => {
    setQuery((q) => {
      const { field: curField, dir } = getSortField(q.orderBy);
      if (curField !== field) return { ...q, orderBy: { [field]: "asc" }, page: 1 };
      return { ...q, orderBy: { [field]: dir === "asc" ? "desc" : "asc" }, page: 1 };
    });
  };

  const clearSort = () => setQuery((q) => ({ ...q, orderBy: undefined, page: 1 }));

  // ✅ NOUVEAU : reset "Actualiser" => annule filtres (where), tri (orderBy), page...
  const reset = React.useCallback(() => {
    // remet exactement l'initialQuery (page/take/etc) et surtout where/orderBy à l'état initial
    setQuery(initialQueryRef.current);
  }, []);

  const remove = async (id: string | number) => {
    await service.delete(id);
    await refresh();
  };

  return {
    rows,
    meta,
    loading,
    error,
    query,
    setQuery,
    refresh,
    reset, // ✅
    setPage,
    setTake,
    setWhere,
    patchWhere,
    toggleSort,
    clearSort,
    remove,
  };
}
