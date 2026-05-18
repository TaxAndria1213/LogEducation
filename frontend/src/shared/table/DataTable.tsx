/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import Service from "../../app/api/Service";
import { useERPPageBackButton } from "../../components/page/ERPPageBackButtonContext";
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
import {
  getModelFieldLabels,
  resolveModelPermission,
  resolveModelConfigFromService,
} from "../model-config/runtime";
import type { ModelConfig } from "../model-config/types";
import EditDrawer from "../forms/EditDrawer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowUp, faSort } from "@fortawesome/free-solid-svg-icons";
import DataTableActions from "./DataTableActions";
import DataTableEmptyState from "./DataTableEmptyState";
import DataTableErrorState from "./DataTableErrorState";
import DataTableLoadingState from "./DataTableLoadingState";
import DataTablePagination from "./DataTablePagination";
import DataTableToolbar from "./DataTableToolbar";
import { formatStatusLabel, getStatusBadgeVariant } from "./statusBadge";
import { getColumnAlignmentClass, isStatusColumn, tableStyles } from "./tableStyles";
import { tableQueryToParams } from "./query";
import { useTable } from "./useTable";
import { type ColumnDef, type RowAction, type SortDir, type TableOrderBy, type TableQuery } from "./types";

export type DataTableHandle = {
  reset: () => void;
  refresh: () => void;
};

const EMPTY_DETAIL_VIEW: DataTableDetailViewConfig<any> = {};

export type DataTableProps<T extends object> = {
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
  modelConfig?: ModelConfig<T>;
};

export type DataTableDetailViewConfig<T extends object> = {
  mode?: "replace" | "below";
  renderMode?: DetailRenderMode;
  editStrategy?: "auto" | "custom" | "hybrid";
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

function resolveBaseDetailRecord<T extends object>(
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

function normalizeActionLabel(label: string) {
  return label.trim().toLowerCase();
}

function getViewActionLabel<T extends object>(
  detailView?: DataTableDetailViewConfig<T> | null,
) {
  return detailView?.viewActionLabel ?? "Voir";
}

function isDetailViewAction<T extends object>(
  action: RowAction<T>,
  detailView?: DataTableDetailViewConfig<T> | null,
) {
  if (!detailView) return false;
  if (detailView.isViewAction) return detailView.isViewAction(action);
  if (action.kind === "view") return true;
  return normalizeActionLabel(action.label) === normalizeActionLabel(getViewActionLabel(detailView));
}

function isEditAction<T extends object>(action: RowAction<T>) {
  if (action.kind === "edit") return true;
  return normalizeActionLabel(action.label) === "modifier";
}

function resolveEditAction<T extends object>(
  actions: RowAction<T>[],
  row: T,
) {
  return actions.find((action) => {
    if (!isEditAction(action)) return false;
    if (action.show && !action.show(row)) return false;
    return true;
  });
}

function normalizeOrderBy(orderBy?: TableOrderBy) {
  if (!orderBy) return [];
  return Array.isArray(orderBy) ? orderBy : [orderBy];
}

function getSortDirection(orderBy: TableOrderBy | undefined, field: string): SortDir | null {
  for (const order of normalizeOrderBy(orderBy)) {
    const direction = order[field];
    if (direction === "asc" || direction === "desc") {
      return direction;
    }
  }

  return null;
}

function getCellValue<T extends object>(row: T, column: ColumnDef<T>) {
  if (column.render) {
    return column.render(row);
  }

  if (column.accessor) {
    return (row as any)[column.accessor as any];
  }

  return (row as any)[column.key];
}

function renderCellValue<T extends object>(row: T, column: ColumnDef<T>) {
  const value = getCellValue(row, column);

  if (
    isStatusColumn(column.key) &&
    (value === null ||
      value === undefined ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean")
  ) {
    return (
      <span
        className={`inline-flex max-w-full items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${getStatusBadgeVariant(value)}`}
        title={formatStatusLabel(value)}
      >
        <span className="truncate">{formatStatusLabel(value)}</span>
      </span>
    );
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return (
      <span className="block truncate" title={String(value ?? "-")}>
        {String(value ?? "-")}
      </span>
    );
  }

  return value as React.ReactNode;
}

function DataTableInner<T extends object>(
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
    modelConfig,
  } = props;

  const detailView = React.useMemo<DataTableDetailViewConfig<T> | null>(() => {
    if (detailViewProp === false) return null;
    return detailViewProp ?? (EMPTY_DETAIL_VIEW as DataTableDetailViewConfig<T>);
  }, [detailViewProp]);
  const resolvedModelConfig = React.useMemo(
    () => modelConfig ?? resolveModelConfigFromService<T>(service),
    [modelConfig, service],
  );
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
  const [editingRow, setEditingRow] = React.useState<T | null>(null);
  const [detailRecord, setDetailRecord] = React.useState<DetailViewRecord | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const detailRequestRef = React.useRef(0);
  const detailHeaderOwnerId = React.useId();
  const erpPageBackButton = useERPPageBackButton();

  const total = meta?.total ?? rows.length;
  const page = query.page ?? 1;
  const take = query.take ?? 10;
  const pageCount = total ? Math.ceil(total / take) : 1;
  const detailMode = detailView?.mode ?? "replace";
  const detailRenderMode = detailView?.renderMode ?? "exhaustive";
  const detailEditStrategy = detailView?.editStrategy ?? "hybrid";
  const shouldUseAutoEdit = detailEditStrategy !== "custom";
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
    let nextActions = [...(actions ?? [])];

    if (hasDetailView && detailView.autoViewAction !== false) {
      const hasViewAction = nextActions.some((action) =>
        isDetailViewAction(action, detailView),
      );

      if (!hasViewAction) {
        nextActions = [
          {
            label: getViewActionLabel(detailView),
            kind: "view",
            variant: detailView.viewActionVariant ?? "secondary",
            onClick: async () => {},
          },
          ...nextActions,
        ];
      }
    }

    if (
      shouldUseAutoEdit &&
      detailView?.onEdit &&
      resolvedModelConfig
    ) {
      const hasEditAction = nextActions.some((action) => isEditAction(action));
      if (!hasEditAction) {
        nextActions = [
          ...nextActions,
          {
            label: "Modifier",
            kind: "edit",
            variant: "primary",
            show: (row) =>
              resolveModelPermission(resolvedModelConfig.permissions?.canEdit, { row }),
            onClick: async (row) => {
              detailView.onEdit?.(row);
            },
          },
        ];
      }
    }

    return nextActions;
  }, [actions, detailView, hasDetailView, resolvedModelConfig, shouldUseAutoEdit]);

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

  React.useEffect(() => {
    if (!erpPageBackButton) return;

    if (hasDetailView && selectedRow && detailMode === "replace") {
      erpPageBackButton.setBackButtonOverride(detailHeaderOwnerId, {
        label: title ? `Retour a ${title}` : "Retour",
        onClick: closeDetail,
      });
      return () => {
        erpPageBackButton.setBackButtonOverride(detailHeaderOwnerId, null);
      };
    }

    erpPageBackButton.setBackButtonOverride(detailHeaderOwnerId, null);
    return () => {
      erpPageBackButton.setBackButtonOverride(detailHeaderOwnerId, null);
    };
  }, [
    closeDetail,
    detailHeaderOwnerId,
    detailMode,
    erpPageBackButton,
    hasDetailView,
    selectedRow,
    title,
  ]);

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
  }, [closeDetail, detailView, getRowId, loading, rows, selectedRow]);

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
  }, [
    detailView,
    getRowId,
    hasDetailView,
    loadAutoDetailRecord,
    rootAutoIncludeDepth,
    selectedRow,
    service,
  ]);

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
    if (!hasDetailView || !selectedRow) return undefined;

    const configuredEditHandler = detailView?.onEdit;
    const fallbackEditAction = shouldUseAutoEdit
      ? resolveEditAction(resolvedActions, selectedRow)
      : undefined;
    const canUseInternalEdit =
      shouldUseAutoEdit &&
      Boolean(resolvedModelConfig) &&
      resolveModelPermission(resolvedModelConfig?.permissions?.canEdit, {
        row: selectedRow,
      });

    if (detailEditStrategy === "custom") {
      if (!configuredEditHandler) {
        return undefined;
      }

      return () => {
        configuredEditHandler(selectedRow);
      };
    }

    if (!configuredEditHandler && !fallbackEditAction && !canUseInternalEdit) {
      return undefined;
    }

    if (configuredEditHandler && resolvedModelConfig) {
      if (
        !resolveModelPermission(resolvedModelConfig.permissions?.canEdit, {
          row: selectedRow,
        })
      ) {
        return undefined;
      }
    }

    return () => {
      if (configuredEditHandler) {
        configuredEditHandler(selectedRow);
        return;
      }

      if (fallbackEditAction) {
        void fallbackEditAction.onClick(selectedRow);
        return;
      }

      setEditingRow(selectedRow);
    };
  }, [
    detailEditStrategy,
    detailView,
    hasDetailView,
    resolvedActions,
    resolvedModelConfig,
    selectedRow,
    shouldUseAutoEdit,
  ]);

  const mergedDetailFieldLabels = React.useMemo(() => {
    if (!resolvedModelConfig) {
      return detailView?.fieldLabels;
    }

    return {
      ...getModelFieldLabels(resolvedModelConfig),
      ...(detailView?.fieldLabels ?? {}),
    };
  }, [detailView?.fieldLabels, resolvedModelConfig]);

  const mergedDetailHiddenKeys = React.useMemo(() => {
    if (!resolvedModelConfig?.detail.hiddenKeys?.length) {
      return detailView?.hiddenKeys;
    }

    return uniqueStrings([
      ...(resolvedModelConfig.detail.hiddenKeys ?? []),
      ...(detailView?.hiddenKeys ?? []),
    ]);
  }, [detailView?.hiddenKeys, resolvedModelConfig]);

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
        hiddenKeys={mergedDetailHiddenKeys}
        fieldLabels={mergedDetailFieldLabels}
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
    mergedDetailFieldLabels,
    mergedDetailHiddenKeys,
    nestedAutoIncludeDepth,
    rootAutoIncludeDepth,
    service,
  ]);

  const isRowInteractive = Boolean(onRowClick || detailView?.openOnRowClick);

  const renderTableContent = () => (
    <div className={tableStyles.shell}>
      <DataTableToolbar
        title={title}
        total={total}
        search={search}
        showSearch={Boolean(showSearch && onSearchBuildWhere)}
        loading={loading}
        onSearchChange={setSearch}
        onSearchSubmit={applySearch}
        onReset={doReset}
      />

      <div className="px-5 pt-4">
        {error ? (
          <DataTableErrorState
            message={error}
            onRetry={() => {
              void table.refresh();
            }}
            disabled={loading}
          />
        ) : null}
      </div>

      <div className={tableStyles.scroll}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              {columns.map((column) => {
                const sortField = column.sortKey ?? String(column.accessor ?? column.key);
                const sortDirection = getSortDirection(query.orderBy, sortField);
                const alignmentClass = getColumnAlignmentClass(column.key);

                return (
                  <th
                    key={column.key}
                    className={[
                      tableStyles.header,
                      alignmentClass,
                      column.sortable ? "cursor-pointer select-none hover:bg-slate-100" : "",
                      column.headerClassName,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      if (column.sortable) toggleSort(sortField);
                    }}
                    scope="col"
                  >
                    <span
                      className={`inline-flex w-full items-center gap-2 ${
                        alignmentClass === "text-right"
                          ? "justify-end"
                          : alignmentClass === "text-center"
                            ? "justify-center"
                            : "justify-start"
                      }`}
                    >
                      <span className="truncate">{column.header}</span>
                      {column.sortable ? (
                        <FontAwesomeIcon
                          icon={
                            sortDirection === "asc"
                              ? faArrowUp
                              : sortDirection === "desc"
                                ? faArrowDown
                                : faSort
                          }
                          className={sortDirection ? "text-sky-600" : "text-slate-300"}
                        />
                      ) : null}
                    </span>
                  </th>
                );
              })}
              {resolvedActions.length ? (
                <th
                  className={`${tableStyles.header} sticky right-0 z-[11] bg-slate-50/95 text-right shadow-[-12px_0_24px_rgba(248,250,252,0.88)]`}
                  scope="col"
                >
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <DataTableLoadingState
                colSpan={columns.length + (resolvedActions.length ? 1 : 0)}
              />
            ) : rows.length === 0 ? (
              <DataTableEmptyState
                colSpan={columns.length + (resolvedActions.length ? 1 : 0)}
              />
            ) : (
              rows.map((row) => (
                <tr
                  key={String(getRowId(row))}
                  onClick={() => handleRowClick(row)}
                  className={`${tableStyles.row} ${isRowInteractive ? "cursor-pointer" : ""}`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={[
                        tableStyles.cell,
                        getColumnAlignmentClass(column.key),
                        column.className,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {renderCellValue(row, column)}
                    </td>
                  ))}

                  {resolvedActions.length ? (
                    <td className={tableStyles.actionCell}>
                      <DataTableActions
                        actions={resolvedActions.filter((action) =>
                          action.show ? action.show(row) : true,
                        )}
                        row={row}
                        onExecute={(action, currentRow) => {
                          if (isDetailViewAction(action, detailView)) {
                            openDetail(currentRow);
                            return true;
                          }
                        }}
                      />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DataTablePagination
        page={page}
        pageCount={pageCount}
        take={take}
        total={total ?? 0}
        pageSizes={pageSizes}
        loading={loading}
        onPageChange={setPage}
        onTakeChange={setTake}
      />
    </div>
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

      {resolvedModelConfig && shouldUseAutoEdit ? (
        <EditDrawer<T>
          open={Boolean(editingRow)}
          record={editingRow}
          modelConfig={resolvedModelConfig}
          onClose={() => setEditingRow(null)}
          onSuccess={(updated) => {
            setEditingRow(null);
            setSelectedRow(updated);
            setDetailRecord(
              enrichGeneratedDetailModelHints(
                resolveBaseDetailRecord(updated, detailView),
                {
                  endpoint: resolveServiceEndpoint(service),
                  maxDepth: 1,
                },
              ),
            );
            void table.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

export const DataTable = React.forwardRef(DataTableInner) as <T extends object>(
  props: DataTableProps<T> & { ref?: React.Ref<DataTableHandle> },
) => React.ReactElement;
