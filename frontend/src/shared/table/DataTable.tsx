/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import Service from "../../app/api/Service";
import { type ColumnDef, type RowAction, type TableQuery } from "./types";
import { useTable } from "./useTable";
import Spin from "../../components/anim/Spin";

export type DataTableHandle = {
  reset: () => void;
  refresh: () => void;
};

type Props<T> = {
  title?: string;
  service: Service;
  columns: ColumnDef<T>[];
  actions?: RowAction<T>[];
  initialQuery?: TableQuery;
  getRowId: (row: T) => string | number;
  pageSizes?: number[];
  showSearch?: boolean;
  onSearchBuildWhere?: (text: string) => Record<string, any>;
  onRowClick?: (row: T) => void;
};

function ActionButton<T>({ action, row }: { action: RowAction<T>; row: T }) {
  const onClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (action.confirm) {
      const ok = window.confirm(
        `${action.confirm.title ? action.confirm.title + "\n\n" : ""}${action.confirm.message ?? "Confirmer ?"}`,
      );
      if (!ok) return;
    }
    await action.onClick(row);
  };

  const className =
    action.variant === "danger"
      ? "btn btn-danger"
      : action.variant === "secondary"
        ? "btn btn-secondary"
        : "btn btn-primary";

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      style={{ marginRight: 6 }}
    >
      {action.render ? action.render(row) : action.label}
    </button>
  );
}

function DataTableInner<T>(
  props: Props<T>,
  ref: React.ForwardedRef<DataTableHandle>,
) {
  const {
    title,
    service,
    columns,
    actions,
    initialQuery,
    getRowId,
    pageSizes = [5, 10, 20, 50],
    showSearch = true,
    onSearchBuildWhere,
    onRowClick,
  } = props;

  const table = useTable<T>({ service, initialQuery });
  const { rows, meta, loading, error, query, setPage, setTake, toggleSort } =
    table;

  const [search, setSearch] = React.useState("");

  const total = meta?.total ?? rows.length;
  const page = query.page ?? 1;
  const take = query.take ?? 10;
  const pageCount = total ? Math.ceil(total / take) : 1;

  const doReset = React.useCallback(() => {
    setSearch("");
    table.reset();
  }, [table]);

  const applySearch = () => {
    if (!onSearchBuildWhere) return;
    const text = search.trim();

    if (!text) {
      doReset(); // recherche vide => reset (annule filtres)
      return;
    }

    const where = onSearchBuildWhere(text);
    table.setWhere(where);
  };

  // ✅ Expose reset/refresh au parent
  React.useImperativeHandle(
    ref,
    () => ({
      reset: doReset,
      refresh: table.refresh,
    }),
    [doReset, table.refresh],
  );

  return (
    <div>
      {title ? <h3 style={{ marginBottom: 12 }}>{title}</h3> : null}

      {showSearch && onSearchBuildWhere ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
            placeholder="Rechercher..."
            style={{ padding: 8, flex: 1 }}
          />

          <button
            type="button"
            className="btn btn-secondary"
            onClick={applySearch}
            disabled={loading}
          >
            Chercher
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={doReset}
            disabled={loading}
          >
            Actualiser
          </button>
        </div>
      ) : null}

      {error ? (
        <div
          style={{ padding: 10, marginBottom: 10, border: "1px solid #f00" }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={c.headerClassName}
                  onClick={() =>
                    c.sortable
                      ? toggleSort(c.sortKey ?? String(c.accessor ?? c.key))
                      : undefined
                  }
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderBottom: "1px solid #ddd",
                    cursor: c.sortable ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {c.header} {c.sortable ? "↕" : null}
                </th>
              ))}
              {actions?.length ? (
                <th style={{ padding: 10, borderBottom: "1px solid #ddd" }}>
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (actions?.length ? 1 : 0)}
                  style={{ padding: 20, textAlign: "center" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Spin label="Chargement des données" showLabel />
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions?.length ? 1 : 0)}
                  style={{ padding: 20, textAlign: "center" }}
                >
                  Aucun résultat.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={String(getRowId(row))}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    cursor: onRowClick ? "pointer" : "default",
                  }}
                >
                  {columns.map((c) => {
                    const value = c.render
                      ? c.render(row)
                      : c.accessor
                        ? (row as any)[c.accessor as any]
                        : (row as any)[c.key];

                    return (
                      <td
                        key={c.key}
                        className={c.className}
                        style={{ padding: 10 }}
                      >
                        {value as any}
                      </td>
                    );
                  })}

                  {actions?.length ? (
                    <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                      {actions
                        .filter((a) => (a.show ? a.show(row) : true))
                        .map((a, idx) => (
                          <React.Fragment key={a.label ?? idx}>
                            <ActionButton action={a} row={row} />
                          </React.Fragment>
                        ))}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
        }}
      >
        <div>
          <button
            className="btn btn-secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            Précédent
          </button>

          <span style={{ margin: "0 10px" }}>
            Page {page} / {pageCount}
          </span>

          <button
            className="btn btn-secondary"
            disabled={page >= pageCount || loading}
            onClick={() => setPage(page + 1)}
          >
            Suivant
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Par page:</span>
          <select
            value={take}
            onChange={(e) => setTake(Number(e.target.value))}
            disabled={loading}
          >
            {pageSizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <span style={{ marginLeft: 10 }}>Total: {total ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

// ✅ export forwardRef (astuce TS pour garder le générique)
export const DataTable = React.forwardRef(DataTableInner) as <T>(
  props: Props<T> & { ref?: React.Ref<DataTableHandle> },
) => React.ReactElement;
