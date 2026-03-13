/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import Service from "../../app/api/Service";

export type SortDir = "asc" | "desc";

export type TableOrderBy =
  | Record<string, SortDir>
  | Array<Record<string, SortDir>>;

export type TableQuery = {
  page?: number;
  take?: number;
  where?: Record<string, any>;
  orderBy?: TableOrderBy;
  includeAll?: boolean;
  includes?: string[];     // ex ["user","items","items.product"]
  includeSpec?: Record<string, any>;
  select?: Record<string, any>;
};

export type PaginatedMeta = {
  take: number;
  skip?: number;
  page?: number;
  total?: number;
  hasNextPage: boolean;
  nextCursor?: any;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginatedMeta;
};

/**
 * IMPORTANT:
 * Ton backend Response.success renvoie sûrement quelque chose comme:
 * { success: true, message: "...", data: ..., code: ... }
 * donc on enveloppe un type générique.
 */
export type ApiSuccess<T> = {
  success?: boolean;
  message?: string;
  code?: number | string;
  data: T;
};

export type ColumnDef<T> = {
  /** libellé colonne */
  header: React.ReactNode;
  /** clé unique */
  key: string;
  /** champ direct: row[name] */
  accessor?: keyof T | string;
  /** rendu custom */
  render?: (row: T) => React.ReactNode;
  /** tri possible sur cette colonne */
  sortable?: boolean;
  /** nom exact champ back (si différent) */
  sortKey?: string;
  /** classes */
  className?: string;
  headerClassName?: string;
};

export type RowAction<T> = {
  label: string;
  onClick: (row: T) => void | Promise<void>;
  /** optionnel: masquer selon row */
  show?: (row: T) => boolean;
  /** optionnel: style bouton */
  variant?: "primary" | "danger" | "secondary";
  /** optionnel: demander confirmation */
  confirm?: {
    title?: string;
    message?: string;
  };
  render?: (row: T) => React.ReactNode;
};

export type UseTableOptions<T> = {
  service: Service;
  /**
   * Construire une query prisma-like envoyée au back.
   * Si tu veux, tu peux injecter des where/includes fixes ici.
   */
  initialQuery?: TableQuery;
  /**
   * Adaptateur: selon ton format API exact.
   * Par défaut, on suppose response.data = { data, meta }.
   */
  mapResponse?: (raw: any) => PaginatedResponse<T>;
};

export type UseTableResult<T> = {
  rows: T[];
  meta?: PaginatedMeta;
  loading: boolean;
  error?: string;

  query: TableQuery;
  setQuery: React.Dispatch<React.SetStateAction<TableQuery>>;

  refresh: () => Promise<void>;

  setPage: (page: number) => void;
  setTake: (take: number) => void;

  setWhere: (where: Record<string, any>) => void;
  patchWhere: (patch: Record<string, any>) => void;

  toggleSort: (field: string) => void;
  clearSort: () => void;

  remove: (id: string | number) => Promise<void>;
};
