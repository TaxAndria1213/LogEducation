/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import Service from "../../app/api/Service";
import Spin from "../../components/anim/Spin";
import TableActionButton, {
  TableViewActionLabel,
} from "../../components/actions/TableActionButton";
import {
  enrichGeneratedDetailModelHints,
  getGeneratedDetailIncludePaths,
  getGeneratedDetailModelEndpoint,
  getGeneratedDetailOwnerResolutionCandidates,
} from "../detail/detail-meta";
import RecursiveDetailView from "../detail/RecursiveDetailView";
import type {
  DetailFieldFormatter,
  DetailFieldGroup,
  DetailRenderMode,
  DetailViewRecord,
} from "../detail/types";
import { tableQueryToParams } from "./query";
import { useTable } from "./useTable";
import { type ColumnDef, type RowAction, type TableQuery } from "./types";

export type DataTableHandle = {
  reset: () => void;
  refresh: () => void;
};

const EMPTY_DETAIL_VIEW: DataTableDetailViewConfig<any> = {};

export type DataTableProps<T> = {
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
  detailView?: DataTableDetailViewConfig<T> | false;
};

export type DataTableDetailViewConfig<T> = {
  mode?: "replace" | "below";
  renderMode?: DetailRenderMode;
  title?: string;
  getTitle?: (row: T) => string;
  onEdit?: (row: T) => void;
  selectedRow?: T | null;
  onSelectedRowChange?: (row: T | null) => void;
  editLabel?: string;
  hiddenKeys?: string[];
  fieldLabels?: Record<string, string>;
  emptyTitle?: string;
  emptyDescription?: string;
  getDetailData?: (row: T) => DetailViewRecord;
  loadDetailData?: (row: T) => Promise<DetailViewRecord | null | undefined>;
  fieldGroups?: DetailFieldGroup[];
  fieldFormatters?: Record<string, DetailFieldFormatter>;
  autoIncludeDepth?: number;
  autoIncludeMaxPaths?: number;
  openOnRowClick?: boolean;
  autoViewAction?: boolean;
  viewActionLabel?: string;
  viewActionVariant?: "primary" | "danger" | "secondary";
  isViewAction?: (action: RowAction<T>) => boolean;
};

function isPlainObject(value: unknown): value is DetailViewRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveBaseDetailRecord<T>(
  row: T,
  detailView?: DataTableDetailViewConfig<T> | null,
) {
  const rawRecord = detailView?.getDetailData?.(row) ?? (row as unknown as DetailViewRecord);
  return isPlainObject(rawRecord) ? rawRecord : {};
}

function mergeDetailRecord(
  baseRecord: DetailViewRecord,
  loadedRecord?: DetailViewRecord | null,
) {
  if (!loadedRecord || !isPlainObject(loadedRecord)) {
    return baseRecord;
  }

  return {
    ...baseRecord,
    ...loadedRecord,
  };
}

function extractDetailPayload(payload: unknown): DetailViewRecord | null {
  if (!isPlainObject(payload)) return null;

  if (isPlainObject(payload.data)) {
    return payload.data;
  }

  return payload;
}

function enrichLoadedDetailRecord(
  record: DetailViewRecord | null,
  options?: {
    endpoint?: string | null;
    parentRecord?: DetailViewRecord | null;
    relationKey?: string | null;
  },
) {
  if (!record) return null;
  return enrichGeneratedDetailModelHints(record, {
    endpoint: options?.endpoint ?? null,
    parentRecord: options?.parentRecord ?? null,
    relationKey: options?.relationKey ?? null,
    maxDepth: 2,
  });
}

function extractDetailCollectionPayload(payload: unknown): DetailViewRecord | null {
  if (Array.isArray(payload)) {
    return payload.find(isPlainObject) ?? null;
  }

  if (isPlainObject(payload) && Array.isArray(payload.data)) {
    return payload.data.find(isPlainObject) ?? null;
  }

  return extractDetailPayload(payload);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractAutoDetailErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "object" && error !== null) {
    const response = (error as {
      response?: {
        data?: { message?: unknown; status?: { message?: unknown } };
        status?: unknown;
      };
      message?: unknown;
    }).response;

    const responseMessage =
      typeof response?.data?.message === "string" && response.data.message.trim()
        ? response.data.message.trim()
        : typeof response?.data?.status?.message === "string" &&
            response.data.status.message.trim()
          ? response.data.status.message.trim()
          : null;

    if (responseMessage) {
      return responseMessage;
    }

    const directMessage = (error as { message?: unknown }).message;
    if (typeof directMessage === "string" && directMessage.trim()) {
      return directMessage.trim();
    }
  }

  return "Impossible de charger les details complementaires.";
}

function isRecoverableAutoDetailError(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const responseStatus = (error as { response?: { status?: unknown } }).response?.status;
    if (responseStatus === 404) {
      return true;
    }
  }

  const message = extractAutoDetailErrorMessage(error).toLowerCase();
  return (
    message.includes("introuvable") ||
    message.includes("not found") ||
    message.includes("aucun") ||
    message.includes("404")
  );
}

function resolveDetailRecordId(record: DetailViewRecord) {
  const rawId = record.id;
  if (typeof rawId === "string" || typeof rawId === "number") {
    return rawId;
  }
  return null;
}

function resolveServiceEndpoint(service?: Service | null) {
  return service?.url ?? null;
}

function isIdentityFieldKey(key: string) {
  return key === "id" || /(^|_)id$/i.test(key) || /Id$/.test(key);
}

function getComparableRecordValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return null;
}

function getRecordIdentityEntries(record: DetailViewRecord) {
  const directId = resolveDetailRecordId(record);
  if (directId !== null) {
    return [["id", String(directId)]];
  }

  return Object.entries(record)
    .filter(([key]) => isIdentityFieldKey(key))
    .map(([key, value]) => {
      const comparableValue = getComparableRecordValue(value);
      return comparableValue === null ? null : [key, comparableValue];
    })
    .filter((entry): entry is [string, string] => Boolean(entry));
}

function recordMatchesIdentity(
  referenceRecord: DetailViewRecord,
  candidateRecord: DetailViewRecord,
) {
  const referenceId = resolveDetailRecordId(referenceRecord);
  const candidateId = resolveDetailRecordId(candidateRecord);

  if (referenceId !== null && candidateId !== null) {
    return String(referenceId) === String(candidateId);
  }

  const identityEntries = getRecordIdentityEntries(referenceRecord).filter(
    ([key]) => key !== "id",
  );
  if (identityEntries.length === 0) {
    return false;
  }

  return identityEntries.every(([key, value]) => {
    const candidateValue = getComparableRecordValue(candidateRecord[key]);
    return candidateValue !== null && candidateValue === value;
  });
}

function extractRelationRecordFromParent(
  parentRecord: DetailViewRecord,
  relationKey: string,
  currentRecord: DetailViewRecord,
) {
  const relationValue = parentRecord[relationKey];
  if (isPlainObject(relationValue)) {
    return relationValue;
  }

  if (!Array.isArray(relationValue)) {
    return null;
  }

  const exactMatch =
    relationValue.find(
      (item) => isPlainObject(item) && recordMatchesIdentity(currentRecord, item),
    ) ?? null;

  if (exactMatch) {
    return exactMatch;
  }

  return relationValue.find(isPlainObject) ?? null;
}

function getDefaultActionContent<T>(action: RowAction<T>) {
  if (action.label === "Voir") {
    return <TableViewActionLabel label={action.label} />;
  }

  return action.label;
}

function normalizeActionLabel(label: string) {
  return label.trim().toLowerCase();
}

function getViewActionLabel<T>(
  detailView?: DataTableDetailViewConfig<T> | null,
) {
  return detailView?.viewActionLabel ?? "Voir";
}

function isDetailViewAction<T>(
  action: RowAction<T>,
  detailView?: DataTableDetailViewConfig<T> | null,
) {
  if (!detailView) return false;
  if (detailView.isViewAction) return detailView.isViewAction(action);
  if (action.kind === "view") return true;
  return normalizeActionLabel(action.label) === normalizeActionLabel(getViewActionLabel(detailView));
}

function ActionButton<T>({
  action,
  row,
  onExecute,
}: {
  action: RowAction<T>;
  row: T;
  onExecute?: (action: RowAction<T>, row: T) => void | Promise<void>;
}) {
  const onClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (action.confirm) {
      const ok = window.confirm(
        `${action.confirm.title ? `${action.confirm.title}\n\n` : ""}${action.confirm.message ?? "Confirmer ?"}`,
      );
      if (!ok) return;
    }
    if (onExecute) {
      await onExecute(action, row);
      return;
    }
    await action.onClick(row);
  };

  return (
    <TableActionButton variant={action.variant ?? "primary"} onClick={onClick}>
      {action.render ? action.render(row) : getDefaultActionContent(action)}
    </TableActionButton>
  );
}

function DataTableInner<T>(
  props: DataTableProps<T>,
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
    detailView: detailViewProp,
  } = props;

  const detailView = React.useMemo<DataTableDetailViewConfig<T> | null>(() => {
    if (detailViewProp === false) return null;
    return detailViewProp ?? (EMPTY_DETAIL_VIEW as DataTableDetailViewConfig<T>);
  }, [detailViewProp]);
  const hasDetailView = detailView !== null;
  const isDetailSelectionControlled = React.useMemo(() => {
    if (!detailView) return false;
    return (
      Object.prototype.hasOwnProperty.call(detailView, "selectedRow") ||
      typeof detailView.onSelectedRowChange === "function"
    );
  }, [detailView]);

  const table = useTable<T>({ service, initialQuery });
  const { rows, meta, loading, error, query, setPage, setTake, toggleSort } = table;

  const [search, setSearch] = React.useState("");
  const [selectedRow, setSelectedRow] = React.useState<T | null>(null);
  const [detailRecord, setDetailRecord] = React.useState<DetailViewRecord | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const detailRequestRef = React.useRef(0);

  const total = meta?.total ?? rows.length;
  const page = query.page ?? 1;
  const take = query.take ?? 10;
  const pageCount = total ? Math.ceil(total / take) : 1;
  const detailMode = detailView?.mode ?? "replace";
  const detailRenderMode = detailView?.renderMode ?? "exhaustive";
  const rootAutoIncludeDepth =
    detailView?.autoIncludeDepth ?? (detailRenderMode === "exhaustive" ? 3 : 2);
  const nestedAutoIncludeDepth =
    detailRenderMode === "exhaustive"
      ? Math.max(2, rootAutoIncludeDepth - 1)
      : Math.max(1, rootAutoIncludeDepth - 1);
  const defaultAutoIncludeMaxPaths =
    detailView?.autoIncludeMaxPaths ?? (detailRenderMode === "exhaustive" ? 120 : 40);

  const loadAutoDetailRecord = React.useCallback(
    async (
      record: DetailViewRecord,
      options?: {
        fallbackService?: Service;
        depthOverride?: number;
        parentRecord?: DetailViewRecord | null;
        relationKey?: string | null;
        forceIncludeKeys?: string[];
      },
    ) => {
      const hintedRecord = enrichGeneratedDetailModelHints(record, {
        endpoint: resolveServiceEndpoint(options?.fallbackService),
        parentRecord: options?.parentRecord ?? null,
        relationKey: options?.relationKey ?? null,
        maxDepth: 2,
      });
      const id = resolveDetailRecordId(record);
      const currentDepth = Math.max(1, options?.depthOverride ?? rootAutoIncludeDepth);
      const relationPaths = uniqueStrings([
        ...getGeneratedDetailIncludePaths(hintedRecord, {
          maxDepth: currentDepth,
          maxPaths: defaultAutoIncludeMaxPaths,
        }),
        ...(options?.forceIncludeKeys ?? []),
      ]);

      const endpoint =
        getGeneratedDetailModelEndpoint(hintedRecord) ?? resolveServiceEndpoint(options?.fallbackService);
      const ownerResolutionCandidates =
        getGeneratedDetailOwnerResolutionCandidates(hintedRecord);
      let lastRecoverableError: unknown = null;
      let lastUnhandledError: unknown = null;

      if (endpoint || options?.fallbackService) {
        const requestService =
          endpoint && endpoint !== options?.fallbackService?.url
            ? new Service(endpoint)
            : (options?.fallbackService ?? new Service(endpoint ?? service.url));

        if (id !== null && relationPaths.length > 0) {
          try {
            const response = await requestService.getAll(
              tableQueryToParams({
                page: 1,
                take: 1,
                where: { id },
                includes: relationPaths,
              }),
            );
            const enrichedRecord = enrichLoadedDetailRecord(
              extractDetailCollectionPayload(response.data),
              {
                endpoint: resolveServiceEndpoint(requestService),
                parentRecord: options?.parentRecord ?? null,
                relationKey: options?.relationKey ?? null,
              },
            );
            if (enrichedRecord) {
              return enrichedRecord;
            }
          } catch (error) {
            if (isRecoverableAutoDetailError(error)) {
              lastRecoverableError = error;
            } else {
              lastUnhandledError = error;
            }
          }
        }

        if (id !== null) {
          try {
            const response = await requestService.get(id);
            return enrichLoadedDetailRecord(extractDetailPayload(response.data), {
              endpoint: resolveServiceEndpoint(requestService),
              parentRecord: options?.parentRecord ?? null,
              relationKey: options?.relationKey ?? null,
            });
          } catch (error) {
            if (isRecoverableAutoDetailError(error)) {
              lastRecoverableError = error;
            } else {
              lastUnhandledError = error;
            }
          }
        }
      }

      if (ownerResolutionCandidates.length > 0) {
        for (const candidate of ownerResolutionCandidates) {
          const includes = uniqueStrings(
            candidate.inverseRelationKeys.flatMap((inverseRelationKey) => [
              inverseRelationKey,
              ...relationPaths.map((path) => `${inverseRelationKey}.${path}`),
            ]),
          );

          if (includes.length === 0) {
            continue;
          }

          try {
            const ownerService = new Service(candidate.endpoint);
            const response = await ownerService.getAll(
              tableQueryToParams({
                page: 1,
                take: 1,
                where: { id: candidate.foreignValue },
                includes,
              }),
            );
            const ownerRecord = enrichLoadedDetailRecord(
              extractDetailCollectionPayload(response.data),
              {
                endpoint: resolveServiceEndpoint(ownerService),
              },
            );

            if (!ownerRecord) {
              continue;
            }

            for (const inverseRelationKey of candidate.inverseRelationKeys) {
              const relationRecord = extractRelationRecordFromParent(
                ownerRecord,
                inverseRelationKey,
                record,
              );

              if (relationRecord) {
                return enrichLoadedDetailRecord(relationRecord, {
                  parentRecord: ownerRecord,
                  relationKey: inverseRelationKey,
                });
              }
            }
          } catch {
            continue;
          }
        }
      }

      if (id === null && !(options?.parentRecord && options?.relationKey)) {
        return null;
      }

      if (options?.parentRecord && options?.relationKey) {
        const parentId = resolveDetailRecordId(options.parentRecord);
        const parentEndpoint = getGeneratedDetailModelEndpoint(options.parentRecord);

        if (parentId !== null && parentEndpoint) {
          try {
            const parentService = new Service(parentEndpoint);
            const nestedRelationPaths = relationPaths.map(
              (path) => `${options.relationKey}.${path}`,
            );
            const includes = uniqueStrings([options.relationKey, ...nestedRelationPaths]);
            const response = await parentService.getAll(
              tableQueryToParams({
                page: 1,
                take: 1,
                where: { id: parentId },
                includes,
              }),
            );
            const enrichedParentRecord = enrichLoadedDetailRecord(
              extractDetailCollectionPayload(response.data),
              {
                endpoint: resolveServiceEndpoint(parentService),
              },
            );
            if (enrichedParentRecord) {
              const relationRecord = extractRelationRecordFromParent(
                enrichedParentRecord,
                options.relationKey,
                record,
              );
              if (relationRecord) {
                return enrichLoadedDetailRecord(relationRecord, {
                  parentRecord: enrichedParentRecord,
                  relationKey: options.relationKey,
                });
              }
            }
          } catch (error) {
            if (isRecoverableAutoDetailError(error)) {
              lastRecoverableError = error;
            } else {
              lastUnhandledError = error;
            }
          }
        }
      }

      if (lastUnhandledError) {
        throw new Error(extractAutoDetailErrorMessage(lastUnhandledError));
      }

      if (lastRecoverableError) {
        return enrichLoadedDetailRecord(record, {
          endpoint: endpoint ?? resolveServiceEndpoint(options?.fallbackService),
          parentRecord: options?.parentRecord ?? null,
          relationKey: options?.relationKey ?? null,
        });
      }

      return null;
    },
    [defaultAutoIncludeMaxPaths, rootAutoIncludeDepth, service],
  );

  const resolvedActions = React.useMemo<RowAction<T>[]>(() => {
    const baseActions = [...(actions ?? [])];

    if (!hasDetailView) {
      return baseActions;
    }

    if (detailView.autoViewAction === false) {
      return baseActions;
    }

    const hasViewAction = baseActions.some((action) => isDetailViewAction(action, detailView));
    if (hasViewAction) {
      return baseActions;
    }

    return [
      {
        label: getViewActionLabel(detailView),
        kind: "view",
        variant: detailView.viewActionVariant ?? "secondary",
        onClick: async () => {},
      },
      ...baseActions,
    ];
  }, [actions, detailView, hasDetailView]);

  const openDetail = React.useCallback((row: T) => {
    setSelectedRow(row);
    setDetailRecord(
      enrichGeneratedDetailModelHints(resolveBaseDetailRecord(row, detailView), {
        endpoint: resolveServiceEndpoint(service),
        maxDepth: 1,
      }),
    );
    setDetailError(null);
    detailView?.onSelectedRowChange?.(row);
  }, [detailView, service]);

  const closeDetail = React.useCallback(() => {
    setSelectedRow(null);
    setDetailRecord(null);
    setDetailError(null);
    setDetailLoading(false);
    detailView?.onSelectedRowChange?.(null);
  }, [detailView]);

  const doReset = React.useCallback(() => {
    setSearch("");
    closeDetail();
    table.reset();
  }, [closeDetail, table]);

  const applySearch = () => {
    if (!onSearchBuildWhere) return;
    const text = search.trim();

    if (!text) {
      doReset();
      return;
    }

    const where = onSearchBuildWhere(text);
    table.setWhere(where);
  };

  React.useImperativeHandle(
    ref,
    () => ({
      reset: doReset,
      refresh: table.refresh,
    }),
    [doReset, table.refresh],
  );

  React.useEffect(() => {
    if (!hasDetailView || !isDetailSelectionControlled) return;

    const externalRow = detailView.selectedRow ?? null;
    if (!externalRow && selectedRow) {
      setSelectedRow(null);
      return;
    }

    if (!externalRow) return;

    const externalId = String(getRowId(externalRow));
    const currentId = selectedRow ? String(getRowId(selectedRow)) : null;
    if (externalId !== currentId) {
      setSelectedRow(externalRow);
    }
  }, [detailView, getRowId, hasDetailView, isDetailSelectionControlled, selectedRow]);

  React.useEffect(() => {
    if (!selectedRow) return;
    const selectedId = String(getRowId(selectedRow));
    const nextSelectedRow = rows.find((row) => String(getRowId(row)) === selectedId);

    if (nextSelectedRow) {
      if (nextSelectedRow !== selectedRow) {
        setSelectedRow(nextSelectedRow);
        detailView?.onSelectedRowChange?.(nextSelectedRow);
      }
      return;
    }

    if (!loading) {
      closeDetail();
    }
  }, [closeDetail, getRowId, loading, rows, selectedRow]);

  React.useEffect(() => {
    if (!hasDetailView || !detailView || !selectedRow) {
      setDetailLoading(false);
      setDetailError(null);
      setDetailRecord(null);
      return;
    }

    const baseRecord = enrichGeneratedDetailModelHints(
      resolveBaseDetailRecord(selectedRow, detailView),
      {
        endpoint: resolveServiceEndpoint(service),
        maxDepth: 1,
      },
    );
    setDetailRecord(baseRecord);
    setDetailError(null);

    const loadDetailData =
      detailView.loadDetailData ??
      (async (row: T) => {
        const rootId = getRowId(row);
        const rootRecordWithId =
          baseRecord.id === undefined ? { ...baseRecord, id: rootId } : baseRecord;
        return loadAutoDetailRecord(rootRecordWithId, {
          fallbackService: service,
          depthOverride: rootAutoIncludeDepth,
        });
      });

    if (!loadDetailData) {
      setDetailLoading(false);
      return;
    }

    let isCancelled = false;
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setDetailLoading(true);

    void loadDetailData(selectedRow)
      .then((loadedRecord) => {
        if (isCancelled || detailRequestRef.current !== requestId) return;
        setDetailRecord(
          enrichGeneratedDetailModelHints(mergeDetailRecord(baseRecord, loadedRecord), {
            endpoint: resolveServiceEndpoint(service),
            maxDepth: 2,
          }),
        );
        setDetailError(null);
      })
      .catch((caughtError: unknown) => {
        if (isCancelled || detailRequestRef.current !== requestId) return;
        setDetailError(
          caughtError instanceof Error
            ? caughtError.message
            : "Impossible de charger les details complementaires.",
        );
        setDetailRecord(baseRecord);
      })
      .finally(() => {
        if (isCancelled || detailRequestRef.current !== requestId) return;
        setDetailLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [detailView, getRowId, hasDetailView, loadAutoDetailRecord, selectedRow, service]);

  const handleRowClick = React.useCallback(
    (row: T) => {
      if (detailView?.openOnRowClick) {
        openDetail(row);
      }
      onRowClick?.(row);
    },
    [detailView?.openOnRowClick, onRowClick, openDetail],
  );

  const detailTitle = React.useMemo(() => {
    if (!selectedRow || !hasDetailView || !detailView) return title ?? "Detail";
    return detailView.getTitle?.(selectedRow) ?? detailView.title ?? title ?? "Detail";
  }, [detailView, hasDetailView, selectedRow, title]);

  const handleDetailEdit = React.useMemo<
    ((row: DetailViewRecord) => void) | undefined
  >(() => {
    if (!hasDetailView || !detailView?.onEdit || !selectedRow) return undefined;

    return () => {
      detailView.onEdit?.(selectedRow);
    };
  }, [detailView, hasDetailView, selectedRow]);

  const renderDetailContent = React.useCallback(() => {
    if (!hasDetailView || !detailView) return null;

    return (
      <RecursiveDetailView<DetailViewRecord>
        title={detailTitle}
        row={detailRecord}
        onBack={closeDetail}
        onEdit={handleDetailEdit}
        editLabel={detailView.editLabel}
        emptyTitle={detailView.emptyTitle}
        emptyDescription={detailView.emptyDescription}
        hiddenKeys={detailView.hiddenKeys}
        fieldLabels={detailView.fieldLabels}
        fieldGroups={detailView.fieldGroups}
        fieldFormatters={detailView.fieldFormatters}
        renderMode={detailRenderMode}
        loading={detailLoading}
        error={detailError}
        loadNestedDetailData={(record, context) =>
          loadAutoDetailRecord(record, {
            depthOverride:
              context?.mode === "root" ? rootAutoIncludeDepth : nestedAutoIncludeDepth,
            fallbackService: context?.mode === "root" ? service : undefined,
            parentRecord: context?.parentRecord ?? null,
            relationKey: context?.sourceKey ?? null,
            forceIncludeKeys: context?.forceIncludeKeys ?? [],
          })
        }
      />
    );
  }, [
    closeDetail,
    detailError,
    detailLoading,
    detailRecord,
    detailRenderMode,
    detailTitle,
    detailView,
    handleDetailEdit,
    hasDetailView,
    loadAutoDetailRecord,
    nestedAutoIncludeDepth,
    rootAutoIncludeDepth,
    service,
  ]);

  const isRowInteractive = Boolean(onRowClick || detailView?.openOnRowClick);

  const renderTableContent = () => (
    <>
      {title ? <h3 style={{ marginBottom: 12 }}>{title}</h3> : null}

      {showSearch && onSearchBuildWhere ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applySearch();
            }}
            placeholder="Rechercher..."
            style={{ padding: 8, flex: 1 }}
          />

          <TableActionButton
            variant="secondary"
            onClick={() => {
              applySearch();
            }}
            disabled={loading}
          >
            Chercher
          </TableActionButton>

          <TableActionButton
            variant="secondary"
            onClick={() => {
              doReset();
            }}
            disabled={loading}
          >
            Actualiser
          </TableActionButton>
        </div>
      ) : null}

      {error ? (
        <div style={{ padding: 10, marginBottom: 10, border: "1px solid #f00" }}>
          {error}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.headerClassName}
                  onClick={() =>
                    column.sortable
                      ? toggleSort(column.sortKey ?? String(column.accessor ?? column.key))
                      : undefined
                  }
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderBottom: "1px solid #ddd",
                    cursor: column.sortable ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {column.header} {column.sortable ? "<>" : null}
                </th>
              ))}
              {resolvedActions.length ? (
                <th style={{ padding: 10, borderBottom: "1px solid #ddd" }}>Actions</th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (resolvedActions.length ? 1 : 0)}
                  style={{ padding: 20, textAlign: "center" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Spin label="Chargement des donnees" showLabel />
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (resolvedActions.length ? 1 : 0)}
                  style={{ padding: 20, textAlign: "center" }}
                >
                  Aucun resultat.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={String(getRowId(row))}
                  onClick={() => handleRowClick(row)}
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    cursor: isRowInteractive ? "pointer" : "default",
                  }}
                >
                  {columns.map((column) => {
                    const value = column.render
                      ? column.render(row)
                      : column.accessor
                        ? (row as any)[column.accessor as any]
                        : (row as any)[column.key];

                    return (
                      <td
                        key={column.key}
                        className={column.className}
                        style={{ padding: 10 }}
                      >
                        {value as any}
                      </td>
                    );
                  })}

                  {resolvedActions.length ? (
                    <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                      <div className="flex flex-wrap gap-2">
                        {resolvedActions
                          .filter((action) => (action.show ? action.show(row) : true))
                          .map((action, index) => (
                            <React.Fragment key={`${action.label}-${index}`}>
                              <ActionButton
                                action={action}
                                row={row}
                                onExecute={
                                  isDetailViewAction(action, detailView)
                                    ? (_, currentRow) => {
                                        openDetail(currentRow);
                                      }
                                    : undefined
                                }
                              />
                            </React.Fragment>
                          ))}
                      </div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TableActionButton
            variant="secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            Precedent
          </TableActionButton>

          <span style={{ margin: "0 10px" }}>
            Page {page} / {pageCount}
          </span>

          <TableActionButton
            variant="secondary"
            disabled={page >= pageCount || loading}
            onClick={() => setPage(page + 1)}
          >
            Suivant
          </TableActionButton>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Par page:</span>
          <select
            value={take}
            onChange={(event) => setTake(Number(event.target.value))}
            disabled={loading}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          <span style={{ marginLeft: 10 }}>Total: {total ?? 0}</span>
        </div>
      </div>
    </>
  );

  return (
    <div>
      {hasDetailView && selectedRow && detailMode === "replace" ? (
        renderDetailContent()
      ) : (
        renderTableContent()
      )}

      {hasDetailView && selectedRow && detailMode === "below" ? (
        <div style={{ marginTop: 24 }}>{renderDetailContent()}</div>
      ) : null}
    </div>
  );
}

export const DataTable = React.forwardRef(DataTableInner) as <T>(
  props: DataTableProps<T> & { ref?: React.Ref<DataTableHandle> },
) => React.ReactElement;
