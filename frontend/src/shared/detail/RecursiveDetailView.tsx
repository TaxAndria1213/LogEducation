import React from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiChevronDown,
  FiChevronRight,
  FiEdit3,
  FiFileText,
  FiGrid,
  FiLayers,
  FiLink2,
  FiList,
  FiSearch,
} from "react-icons/fi";
import TableActionButton, {
  TableViewActionLabel,
} from "../../components/actions/TableActionButton";
import Spin from "../../components/anim/Spin";
import DetailValuePopup from "./DetailValuePopup";
import {
  enrichGeneratedDetailModelHints,
  getGeneratedDetailFieldGroups,
  getGeneratedDetailFieldMeta,
  inferGeneratedDetailModelMeta,
} from "./detail-meta";
import type {
  DetailFieldFormatter,
  DetailFieldGroup,
  DetailRenderMode,
  DetailViewRecord,
} from "./types";
import type { RowAction } from "../table/types";

type DetailNode = {
  id: string;
  title: string;
  sourceKey?: string | null;
  value: DetailViewRecord;
  parentRecord?: DetailViewRecord | null;
  hydrated?: boolean;
  loading?: boolean;
  error?: string | null;
  forceIncludeKeys?: string[] | null;
};

type Props<T extends DetailViewRecord> = {
  title: string;
  row: T | null;
  renderMode?: DetailRenderMode;
  onBack?: () => void;
  onEdit?: (row: T) => void;
  editLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  hiddenKeys?: string[];
  fieldLabels?: Record<string, string>;
  fieldGroups?: DetailFieldGroup[];
  fieldFormatters?: Record<string, DetailFieldFormatter>;
  loading?: boolean;
  error?: string | null;
  loadNestedDetailData?: (
    row: DetailViewRecord,
    context?: {
      mode: "root" | "nested";
      sourceKey?: string | null;
      parentRecord?: DetailViewRecord | null;
      forceIncludeKeys?: string[];
    },
  ) => Promise<DetailViewRecord | null | undefined>;
};

type ObjectSection = {
  key: string;
  label: string;
  value: DetailViewRecord;
};

type ArraySection = {
  key: string;
  label: string;
  rows: unknown[];
};

type StructuredFieldDescriptor = {
  badge: string;
  subtitle: string;
  previewHint: string;
};

type JsonSection = {
  key: string;
  label: string;
  value: unknown;
};

type MissingRelationSection = {
  key: string;
  label: string;
  relatedModel: string | null;
  isArray: boolean;
  availability: "missing" | "empty" | "loaded";
};

type MissingScalarFieldSection = {
  key: string;
  label: string;
  typeText: string;
  kind: string;
  isTechnical: boolean;
};

type ScalarEntry = {
  key: string;
  label: string;
  rawValue: unknown;
  defaultDisplay: string;
  content: React.ReactNode;
};

type ScalarBuckets = {
  businessEntries: ScalarEntry[];
  technicalEntries: ScalarEntry[];
};

type ResolvedFieldGroup = {
  key: string;
  title: string;
  description?: string;
  entries: ScalarEntry[];
};

type HeroBadge = {
  key: string;
  label: string;
  value: string;
  className: string;
};

type AccordionTone = "object" | "array" | "technical";

const DEFAULT_HIDDEN_KEYS = new Set([
  "password",
  "mot_de_passe",
  "password_hash",
  "hash_mot_de_passe",
]);

const PRIORITY_FIELDS = [
  "nom_complet",
  "nom",
  "prenom",
  "libelle",
  "titre",
  "code",
  "reference",
  "numero",
  "numero_facture",
  "statut",
  "etat",
  "type",
  "date",
  "date_effet",
  "montant",
  "solde",
];

const HERO_SPOTLIGHT_FIELDS = [
  "code",
  "reference",
  "numero",
  "numero_facture",
  "montant",
  "solde",
  "date_effet",
  "type",
];

const NESTED_RECORD_PRIORITY_FIELDS = [
  "profil",
  "utilisateur",
  "eleve",
  "personnel",
  "formule",
  "facture",
  "paiement",
  "echeance",
  "annee",
  "classe",
  "site",
  "etablissement",
];

type DetailPreviewSettings = {
  businessPreviewLimit: number;
  technicalPreviewLimit: number;
  heroBadgeLimit: number;
  spotlightLimit: number;
  objectPreviewLimit: number;
  popupObjectPreviewLimit: number;
  popupArrayObjectLimit: number;
  popupArrayScalarLimit: number;
};

function getDetailPreviewSettings(
  renderMode: DetailRenderMode,
  showAll = false,
): DetailPreviewSettings {
  if (showAll) {
    return {
      businessPreviewLimit: Number.MAX_SAFE_INTEGER,
      technicalPreviewLimit: Number.MAX_SAFE_INTEGER,
      heroBadgeLimit: Number.MAX_SAFE_INTEGER,
      spotlightLimit: Number.MAX_SAFE_INTEGER,
      objectPreviewLimit: Number.MAX_SAFE_INTEGER,
      popupObjectPreviewLimit: Number.MAX_SAFE_INTEGER,
      popupArrayObjectLimit: Number.MAX_SAFE_INTEGER,
      popupArrayScalarLimit: Number.MAX_SAFE_INTEGER,
    };
  }

  const isExhaustive = renderMode === "exhaustive";

  return {
    businessPreviewLimit: isExhaustive ? 8 : 4,
    technicalPreviewLimit: isExhaustive ? 5 : 3,
    heroBadgeLimit: isExhaustive ? 6 : 4,
    spotlightLimit: isExhaustive ? 6 : 4,
    objectPreviewLimit: isExhaustive ? 12 : 6,
    popupObjectPreviewLimit: isExhaustive ? 8 : 4,
    popupArrayObjectLimit: isExhaustive ? Number.MAX_SAFE_INTEGER : 3,
    popupArrayScalarLimit: isExhaustive ? Number.MAX_SAFE_INTEGER : 8,
  };
}

function isDecimalLikeValue(value: unknown): value is { valueOf: () => string | number } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { valueOf?: unknown };
  return (
    "valueOf" in candidate &&
    typeof candidate.valueOf === "function" &&
    (typeof candidate.valueOf() === "string" || typeof candidate.valueOf() === "number")
  );
}

function isDateValue(value: unknown) {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && (value.includes("-") || value.includes("T"));
}

function isPlainObject(value: unknown): value is DetailViewRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !isDecimalLikeValue(value)
  );
}

function isScalarValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    isDecimalLikeValue(value) ||
    value instanceof Date ||
    isDateValue(value)
  );
}

function humanizeKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (match) => match.toUpperCase());
}

function toCamelCase(value: string) {
  return value.replace(/[_-]([a-z])/g, (_, character: string) => character.toUpperCase());
}

function toSnakeCase(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function normalizeKey(key: string) {
  return toSnakeCase(key).toLowerCase();
}

function isDefaultHiddenKey(key: string) {
  return DEFAULT_HIDDEN_KEYS.has(normalizeKey(key));
}

function getRelatedObjectKeyCandidates(key: string) {
  const snakeMatch = key.match(/^(.*)_id$/i);
  const camelMatch = key.match(/^(.*)Id$/);
  const rawBase = snakeMatch?.[1] ?? camelMatch?.[1];

  if (!rawBase) return [];

  const base = rawBase.trim();
  return Array.from(
    new Set([
      base,
      toCamelCase(base),
      toSnakeCase(base),
      base.charAt(0).toLowerCase() + base.slice(1),
      base.charAt(0).toUpperCase() + base.slice(1),
    ]),
  );
}

function hasRelatedObjectForForeignKey(record: DetailViewRecord, key: string) {
  return getRelatedObjectKeyCandidates(key).some((candidate) => isPlainObject(record[candidate]));
}

function isStatusKey(key: string) {
  const normalized = normalizeKey(key);
  return (
    normalized.includes("status") ||
    normalized.includes("statut") ||
    normalized.includes("etat") ||
    normalized.includes("state")
  );
}

function isDateLikeKey(key: string) {
  const normalized = normalizeKey(key);
  return (
    normalized.includes("date") ||
    normalized.includes("debut") ||
    normalized.includes("fin") ||
    normalized.includes("echeance") ||
    normalized.includes("expiration") ||
    normalized.includes("validite")
  );
}

function isMoneyLikeKey(key: string) {
  const normalized = normalizeKey(key);
  return (
    normalized.includes("montant") ||
    normalized.includes("solde") ||
    normalized.includes("prix") ||
    normalized.includes("tarif") ||
    normalized.includes("cout") ||
    normalized.includes("total") ||
    normalized.includes("amount")
  );
}

function isTechnicalKey(record: DetailViewRecord, key: string) {
  const normalized = normalizeKey(key);

  if (
    [
      "id",
      "uuid",
      "created_at",
      "updated_at",
      "deleted_at",
      "tenant_id",
      "etablissement_id",
      "organisation_id",
    ].includes(normalized)
  ) {
    return true;
  }

  if (normalized.endsWith("_id")) {
    return true;
  }

  if (["created_at", "updated_at", "deleted_at"].includes(normalized)) {
    return true;
  }

  if (hasRelatedObjectForForeignKey(record, key)) {
    return true;
  }

  return false;
}

function formatDate(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("fr-FR");
}

function formatCompactValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString("fr-FR") : "-";
  if (isDecimalLikeValue(value)) {
    const resolvedValue = value.valueOf();
    const numericValue =
      typeof resolvedValue === "number" ? resolvedValue : Number(resolvedValue);
    if (Number.isFinite(numericValue)) {
      return numericValue.toLocaleString("fr-FR");
    }
    return String(resolvedValue);
  }
  if (value instanceof Date || isDateValue(value)) return formatDate(value as string | Date);
  if (typeof value === "string") return value.trim() || "-";
  if (Array.isArray(value)) {
    if (value.length === 0) return "-";
    if (value.every((item) => isScalarValue(item))) {
      return value.map((item) => formatCompactValue(item)).join(", ");
    }
    return `${value.length} element(s)`;
  }
  if (isPlainObject(value)) {
    const summary = buildRecordSummary(value);
    return summary.length > 0 ? summary.join(" | ") : "Objet";
  }
  return String(value);
}

function getStatusBadgeClasses(value: string) {
  const normalized = value.trim().toLowerCase();

  if (
    [
      "regle",
      "reglee",
      "paye",
      "payee",
      "actif",
      "active",
      "autorise",
      "autorisee",
      "regularise",
      "regularisee",
      "resolue",
      "valide",
      "ok",
    ].includes(normalized)
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    [
      "en_attente",
      "en attente",
      "partiellement_regle",
      "partiellement regle",
      "pending",
      "insuffisant",
      "expire",
      "expirant",
    ].includes(normalized)
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    [
      "impaye",
      "impayee",
      "suspendu",
      "suspendue",
      "refuse",
      "refusee",
      "bloque",
      "bloquee",
      "inactif",
      "inactive",
      "erreur",
    ].includes(normalized)
  ) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function renderJsonPreview(value: unknown) {
  const serialized = JSON.stringify(value, null, 2);
  return (
    <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-xs leading-6 text-slate-100">
      {serialized}
    </pre>
  );
}

function renderDefaultFieldContent(
  record: DetailViewRecord,
  key: string,
  value: unknown,
  defaultDisplay: string,
) {
  const fieldMeta = getGeneratedDetailFieldMeta(record, key, inferGeneratedDetailModelMeta(record));

  if (defaultDisplay === "-") {
    return <span className="text-slate-400">-</span>;
  }

  if (fieldMeta?.kind === "json" && (isPlainObject(value) || Array.isArray(value))) {
    return renderJsonPreview(value);
  }

  if (fieldMeta?.kind === "email" && typeof value === "string") {
    return (
      <a className="text-sky-700 underline underline-offset-2" href={`mailto:${value}`}>
        {value}
      </a>
    );
  }

  if (fieldMeta?.kind === "phone" && typeof value === "string") {
    return (
      <a className="text-sky-700 underline underline-offset-2" href={`tel:${value}`}>
        {value}
      </a>
    );
  }

  if (
    ["url", "document_url", "image_url"].includes(fieldMeta?.kind ?? "") &&
    typeof value === "string"
  ) {
    const isImage = fieldMeta?.kind === "image_url";
    return (
      <div className="space-y-3">
        <a
          className="break-all text-sky-700 underline underline-offset-2"
          href={value}
          target="_blank"
          rel="noreferrer"
        >
          {value}
        </a>
        {isImage ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
            <img src={value} alt={key} className="max-h-48 w-full rounded-xl object-contain" />
          </div>
        ) : null}
      </div>
    );
  }

  if (fieldMeta?.kind === "file_path" && typeof value === "string") {
    return <span className="break-all font-mono text-xs text-slate-700">{value}</span>;
  }

  if (isStatusKey(key) || fieldMeta?.kind === "status") {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getStatusBadgeClasses(defaultDisplay)}`}
      >
        {defaultDisplay}
      </span>
    );
  }

  if (typeof value === "boolean") {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
          value
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-50 text-slate-600"
        }`}
      >
        {defaultDisplay}
      </span>
    );
  }

  if ((value instanceof Date || isDateValue(value) || isDateLikeKey(key)) && defaultDisplay !== "-") {
    return (
      <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
        {defaultDisplay}
      </span>
    );
  }

  if ((typeof value === "number" || isDecimalLikeValue(value)) && (isMoneyLikeKey(key) || fieldMeta?.kind === "money")) {
    return <span className="font-semibold tabular-nums text-slate-900">{defaultDisplay}</span>;
  }

  return <span className="text-slate-900">{defaultDisplay}</span>;
}

function getSortedNestedRecordEntries(value: DetailViewRecord) {
  return Object.entries(value)
    .reduce<Array<[string, DetailViewRecord]>>((entries, [key, entry]) => {
      if (isDefaultHiddenKey(key) || isTechnicalKey(value, key)) return entries;
      if (!isPlainObject(entry)) return entries;
      entries.push([key, entry]);
      return entries;
    }, [])
    .sort(([leftKey], [rightKey]) => {
      const leftIndex = NESTED_RECORD_PRIORITY_FIELDS.indexOf(leftKey);
      const rightIndex = NESTED_RECORD_PRIORITY_FIELDS.indexOf(rightKey);

      if (leftIndex === -1 && rightIndex === -1) {
        return leftKey.localeCompare(rightKey);
      }

      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
}

function buildRecordTitleInternal(
  value: DetailViewRecord,
  depth = 0,
): string | null {
  const modelMeta = inferGeneratedDetailModelMeta(value);
  const preferredKeys = modelMeta?.titleFields?.length
    ? modelMeta.titleFields
    : [
        "nom_complet",
        "nom",
        "libelle",
        "titre",
        "code",
        "reference",
        "numero",
        "numero_facture",
      ];

  for (const key of preferredKeys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  const firstScalar = Object.entries(value).find(([key, entry]) => {
    if (isDefaultHiddenKey(key) || isTechnicalKey(value, key)) return false;
    return typeof entry === "string" && entry.trim();
  })?.[1];

  if (typeof firstScalar === "string" && firstScalar.trim()) return firstScalar.trim();

  if (depth >= 2) {
    return null;
  }

  for (const [, entry] of getSortedNestedRecordEntries(value)) {
    const nestedTitle = buildRecordTitleInternal(entry, depth + 1);
    if (nestedTitle) {
      return nestedTitle;
    }
  }

  const firstObjectArray = Object.entries(value).find(([key, entry]) => {
    if (isDefaultHiddenKey(key) || isTechnicalKey(value, key) || !Array.isArray(entry)) {
      return false;
    }

    return entry.some(isPlainObject);
  })?.[1];

  if (Array.isArray(firstObjectArray)) {
    const firstObject = firstObjectArray.find(isPlainObject);
    if (firstObject) {
      const nestedTitle = buildRecordTitleInternal(firstObject, depth + 1);
      if (nestedTitle) {
        return nestedTitle;
      }
    }
  }

  return null;
}

function buildRecordTitle(value: DetailViewRecord, fallback: string) {
  const resolvedTitle = buildRecordTitleInternal(value);
  if (resolvedTitle) return resolvedTitle;
  return fallback;
}

function buildRecordSummaryInternal(
  value: DetailViewRecord,
  depth = 0,
): string[] {
  const modelMeta = inferGeneratedDetailModelMeta(value);
  const parts: string[] = [];
  const visibleScalarKeys = Object.keys(value).filter((key) => {
    if (isDefaultHiddenKey(key) || isTechnicalKey(value, key)) return false;
    return isScalarValue(value[key]);
  });
  const priorityKeys = (
    modelMeta?.summaryFields?.length ? modelMeta.summaryFields : PRIORITY_FIELDS
  ).filter((key) => visibleScalarKeys.includes(key));
  const additionalKeys = visibleScalarKeys.filter((key) => !priorityKeys.includes(key));

  [...priorityKeys, ...additionalKeys].forEach((key) => {
    if (parts.length >= 4) return;
    const candidate = value[key];
    if (!isScalarValue(candidate)) return;
    const formatted = formatCompactValue(candidate);
    if (formatted === "-") return;
    parts.push(`${humanizeKey(key)}: ${formatted}`);
  });

  if (depth < 1 && parts.length < 4) {
    getSortedNestedRecordEntries(value).forEach(([key, entry]) => {
      if (parts.length >= 4) return;

      const nestedTitle = buildRecordTitleInternal(entry, depth + 1);
      if (nestedTitle) {
        parts.push(`${humanizeKey(key)}: ${nestedTitle}`);
        return;
      }

      const nestedSummary = buildRecordSummaryInternal(entry, depth + 1)[0];
      if (nestedSummary) {
        parts.push(`${humanizeKey(key)}: ${nestedSummary}`);
      }
    });
  }

  return parts;
}

function buildRecordSummary(value: DetailViewRecord) {
  return buildRecordSummaryInternal(value);
}

function getStructuredFieldDescriptor(
  record: DetailViewRecord,
  key: string,
  options?: { isArray?: boolean },
): StructuredFieldDescriptor {
  const fieldMeta = getGeneratedDetailFieldMeta(
    record,
    key,
    inferGeneratedDetailModelMeta(record),
  );

  if (fieldMeta?.isRelation && fieldMeta.relatedModel) {
    return {
      badge: options?.isArray ? "Liste relationnelle" : "Relation typée",
      subtitle: options?.isArray
        ? `Liste rattachee au modele ${fieldMeta.relatedModel}, consultable ligne par ligne.`
        : `Objet rattache au modele ${fieldMeta.relatedModel}, avec lecture recursive disponible.`,
      previewHint: options?.isArray
        ? "Elements relationnels avec apercu rapide."
        : "Objet relationnel disponible pour exploration detaillee.",
    };
  }

  if (fieldMeta?.kind === "unknown" && fieldMeta.typeText.includes("{")) {
    return {
      badge: options?.isArray ? "Liste enrichie" : "Structure enrichie",
      subtitle: options?.isArray
        ? "Tableau d'objets enrichis localement, sans endpoint canonique dedie."
        : "Objet enrichi dans la payload courante, avec lecture recursive locale.",
      previewHint: options?.isArray
        ? "Lignes enrichies detectees automatiquement dans la payload."
        : "Structure enrichie disponible pour exploration detaillee.",
    };
  }

  if (fieldMeta?.isTechnical) {
    return {
      badge: options?.isArray ? "Liste technique" : "Objet technique",
      subtitle: options?.isArray
        ? "Valeurs techniques ou systeme presentes sous forme de liste."
        : "Objet technique rattache a l'enregistrement courant.",
      previewHint: options?.isArray
        ? "Elements techniques detectes automatiquement."
        : "Objet technique disponible pour exploration detaillee.",
    };
  }

  return {
    badge: options?.isArray ? "Liste detectee" : "Objet detecte",
    subtitle: options?.isArray
      ? "Liste detectee automatiquement dans la payload courante."
      : "Objet detecte automatiquement dans la payload courante.",
    previewHint: options?.isArray
      ? "Elements detectes automatiquement."
      : "Objet disponible pour exploration detaillee.",
  };
}

function createNode(
  key: string,
  value: DetailViewRecord,
  label?: string,
  options?: {
    parentRecord?: DetailViewRecord | null;
    hydrated?: boolean;
    loading?: boolean;
    error?: string | null;
  },
): DetailNode {
  const rawRecordId =
    typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : buildRecordTitle(value, humanizeKey(key));

  return {
    id: `${key}-${rawRecordId}`,
    title: buildRecordTitle(value, label ?? humanizeKey(key)),
    sourceKey: key,
    value,
    parentRecord: options?.parentRecord ?? null,
    hydrated: options?.hydrated ?? false,
    loading: options?.loading ?? false,
    error: options?.error ?? null,
    forceIncludeKeys: null,
  };
}

function createScalarEntry(
  record: DetailViewRecord,
  key: string,
  entry: unknown,
  fieldLabels: Record<string, string>,
  fieldFormatters: Record<string, DetailFieldFormatter>,
): ScalarEntry {
  const label = fieldLabels[key] ?? humanizeKey(key);
  const defaultDisplay = formatCompactValue(entry);
  const formatter = fieldFormatters[key];

  return {
    key,
    label,
    rawValue: entry,
    defaultDisplay,
    content: formatter
      ? formatter({
          key,
          label,
          value: entry,
          record,
          defaultDisplay,
        })
      : renderDefaultFieldContent(record, key, entry, defaultDisplay),
  };
}

function deriveScalarEntries(
  value: DetailViewRecord,
  hiddenKeys: Set<string>,
  fieldLabels: Record<string, string>,
  fieldFormatters: Record<string, DetailFieldFormatter>,
): ScalarBuckets {
  return Object.entries(value).reduce<ScalarBuckets>(
    (buckets, [key, entry]) => {
      const isScalarEntry =
        isScalarValue(entry) || (Array.isArray(entry) && entry.every(isScalarValue));

      if (!isScalarEntry || hiddenKeys.has(key) || isDefaultHiddenKey(key)) {
        return buckets;
      }

      const nextEntry = createScalarEntry(value, key, entry, fieldLabels, fieldFormatters);

      if (isTechnicalKey(value, key)) {
        buckets.technicalEntries.push(nextEntry);
      } else {
        buckets.businessEntries.push(nextEntry);
      }

      return buckets;
    },
    { businessEntries: [], technicalEntries: [] },
  );
}

function deriveObjectSections(
  value: DetailViewRecord,
  hiddenKeys: Set<string>,
  fieldLabels: Record<string, string>,
): ObjectSection[] {
  return Object.entries(value).reduce<ObjectSection[]>((sections, [key, entry]) => {
    if (hiddenKeys.has(key) || !isPlainObject(entry)) return sections;
    const fieldMeta = getGeneratedDetailFieldMeta(
      value,
      key,
      inferGeneratedDetailModelMeta(value),
    );
    if (fieldMeta?.kind === "json") return sections;

    sections.push({
      key,
      label: fieldLabels[key] ?? humanizeKey(key),
      value: entry,
    });

    return sections;
  }, []);
}

function deriveJsonSections(
  value: DetailViewRecord,
  hiddenKeys: Set<string>,
  fieldLabels: Record<string, string>,
): JsonSection[] {
  return Object.entries(value)
    .filter(([key, entry]) => {
      if (hiddenKeys.has(key)) return false;
      const fieldMeta = getGeneratedDetailFieldMeta(value, key, inferGeneratedDetailModelMeta(value));
      if (fieldMeta?.kind !== "json") return false;
      return isPlainObject(entry) || Array.isArray(entry);
    })
    .map(([key, entry]) => ({
      key,
      label: fieldLabels[key] ?? humanizeKey(key),
      value: entry,
    }));
}

function deriveArraySections(
  value: DetailViewRecord,
  hiddenKeys: Set<string>,
  fieldLabels: Record<string, string>,
): ArraySection[] {
  return Object.entries(value).reduce<ArraySection[]>((sections, [key, entry]) => {
    if (hiddenKeys.has(key) || !Array.isArray(entry) || entry.length === 0) {
      return sections;
    }

    const fieldMeta = getGeneratedDetailFieldMeta(
      value,
      key,
      inferGeneratedDetailModelMeta(value),
    );
    if (fieldMeta?.kind === "json") {
      return sections;
    }

    sections.push({
      key,
      label: fieldLabels[key] ?? humanizeKey(key),
      rows: entry,
    });

    return sections;
  }, []);
}

function deriveRelationSections(
  value: DetailViewRecord,
  hiddenKeys: Set<string>,
  fieldLabels: Record<string, string>,
): MissingRelationSection[] {
  const modelMeta = inferGeneratedDetailModelMeta(value);
  if (!modelMeta) return [];

  return Object.values(modelMeta.fields)
    .filter((field) => {
      if (!field.isRelation || hiddenKeys.has(field.key)) return false;
      return true;
    })
    .map((field) => ({
      ...(() => {
        const relationValue = value[field.key];
        const availability =
          relationValue === undefined
            ? "missing"
            : relationValue === null ||
                (Array.isArray(relationValue) && relationValue.length === 0)
              ? "empty"
              : "loaded";

        return {
          key: field.key,
          label: fieldLabels[field.key] ?? humanizeKey(field.key),
          relatedModel: field.relatedModel,
          isArray: field.isArray,
          availability,
        };
      })(),
    }));
}

function deriveMissingScalarFieldSections(
  value: DetailViewRecord,
  hiddenKeys: Set<string>,
  fieldLabels: Record<string, string>,
): MissingScalarFieldSection[] {
  const modelMeta = inferGeneratedDetailModelMeta(value);
  if (!modelMeta) return [];

  return Object.values(modelMeta.fields)
    .filter((field) => {
      if (field.isRelation || hiddenKeys.has(field.key) || isDefaultHiddenKey(field.key)) {
        return false;
      }

      return value[field.key] === undefined;
    })
    .map((field) => ({
      key: field.key,
      label: fieldLabels[field.key] ?? humanizeKey(field.key),
      typeText: field.typeText,
      kind: field.kind,
      isTechnical: field.isTechnical,
    }));
}

function resolveRelationSectionDescriptor(
  value: DetailViewRecord,
  key: string,
  fieldLabels: Record<string, string>,
): MissingRelationSection | null {
  const modelMeta = inferGeneratedDetailModelMeta(value);
  const field = modelMeta?.fields[key];
  if (!field?.isRelation) return null;
  const relationValue = value[key];

  return {
    key: field.key,
    label: fieldLabels[field.key] ?? humanizeKey(field.key),
    relatedModel: field.relatedModel,
    isArray: field.isArray,
    availability:
      relationValue === undefined
        ? "missing"
        : relationValue === null || (Array.isArray(relationValue) && relationValue.length === 0)
          ? "empty"
          : "loaded",
  };
}

function getPreferredPreviewKeys(
  row: DetailViewRecord,
  hiddenKeys: Set<string>,
  previewSettings: DetailPreviewSettings,
) {
  const modelMeta = inferGeneratedDetailModelMeta(row);
  const scalarKeys = Object.keys(row).filter(
    (key) => !hiddenKeys.has(key) && !isDefaultHiddenKey(key) && isScalarValue(row[key]),
  );
  const businessKeys = scalarKeys.filter((key) => !isTechnicalKey(row, key));
  const technicalKeys = scalarKeys.filter((key) => isTechnicalKey(row, key));
  const prioritized = (
    modelMeta?.summaryFields?.length ? modelMeta.summaryFields : PRIORITY_FIELDS
  ).filter((key) => businessKeys.includes(key));
  const businessAdditional = businessKeys.filter((key) => !prioritized.includes(key));
  const resolvedKeys = [...prioritized, ...businessAdditional];

  if (resolvedKeys.length > 0) {
    return resolvedKeys.slice(0, previewSettings.businessPreviewLimit);
  }

  return technicalKeys.slice(0, previewSettings.technicalPreviewLimit);
}

function deriveHeroBadges(
  row: DetailViewRecord,
  fieldLabels: Record<string, string>,
  previewSettings: DetailPreviewSettings,
) {
  const modelMeta = inferGeneratedDetailModelMeta(row);
  const statusKeys = modelMeta?.statusFields?.length
    ? modelMeta.statusFields
    : Object.keys(row).filter((key) => isStatusKey(key));

  return statusKeys
    .map((key) => [key, row[key]] as const)
    .filter(([, value]) => isScalarValue(value))
    .slice(0, previewSettings.heroBadgeLimit)
    .map(([key, value]) => {
      const display = formatCompactValue(value);
      return {
        key,
        label: fieldLabels[key] ?? humanizeKey(key),
        value: display,
        className: getStatusBadgeClasses(display),
      } satisfies HeroBadge;
    })
    .filter((badge) => badge.value !== "-");
}

function deriveSpotlightEntries(
  entries: ScalarEntry[],
  record: DetailViewRecord,
  previewSettings: DetailPreviewSettings,
) {
  const modelMeta = inferGeneratedDetailModelMeta(record);
  const entryMap = new Map(entries.map((entry) => [entry.key, entry]));
  const preferredFields = modelMeta?.spotlightFields?.length
    ? modelMeta.spotlightFields
    : HERO_SPOTLIGHT_FIELDS;
  const spotlightEntries = preferredFields
    .map((key) => entryMap.get(key))
    .filter((entry): entry is ScalarEntry => Boolean(entry));

  if (spotlightEntries.length >= Math.min(3, previewSettings.spotlightLimit)) {
    return spotlightEntries.slice(0, previewSettings.spotlightLimit);
  }

  const remainingEntries = entries.filter((entry) => !spotlightEntries.includes(entry));
  return [
    ...spotlightEntries,
    ...remainingEntries.slice(0, previewSettings.spotlightLimit - spotlightEntries.length),
  ].slice(0, previewSettings.spotlightLimit);
}

function resolveFieldGroups(
  record: DetailViewRecord,
  entries: ScalarEntry[],
  fieldGroups: DetailFieldGroup[],
) {
  const modelMeta = inferGeneratedDetailModelMeta(record);
  const entryMap = new Map(entries.map((entry) => [entry.key, entry]));
  const consumedKeys = new Set<string>();
  const generatedGroups = getGeneratedDetailFieldGroups(modelMeta);
  const mergedGroups = [...fieldGroups, ...generatedGroups];

  const configuredGroups = mergedGroups.reduce<ResolvedFieldGroup[]>(
    (groups, group, index) => {
      const groupEntries = group.fields
        .map((field) => entryMap.get(field))
        .filter((entry): entry is ScalarEntry => Boolean(entry));

      if (groupEntries.length === 0) return groups;

      groupEntries.forEach((entry) => consumedKeys.add(entry.key));

      const resolvedGroup: ResolvedFieldGroup = {
        key: group.key ?? `${group.title}-${index}`,
        title: group.title,
        entries: groupEntries,
      };

      if (group.description) {
        resolvedGroup.description = group.description;
      }

      groups.push(resolvedGroup);
      return groups;
    },
    [],
  );

  const remainingEntries = entries.filter((entry) => !consumedKeys.has(entry.key));

  const automaticGroups: ResolvedFieldGroup[] = [];
  const automaticGroupDefinitions = [
    {
      key: "status",
      title: "Statuts et decisions",
      description: "Lecture rapide de la situation metier et operationnelle.",
      match: (entry: ScalarEntry) => isStatusKey(entry.key),
    },
    {
      key: "financial",
      title: "Montants et droits",
      description: "Indicateurs financiers et valeurs chiffrees importantes.",
      match: (entry: ScalarEntry) =>
        isMoneyLikeKey(entry.key) ||
        (typeof entry.rawValue === "number" &&
          ["montant", "solde", "total"].some((token) => entry.key.includes(token))),
    },
    {
      key: "dates",
      title: "Dates et validite",
      description: "Repere les bornes temporelles importantes du dossier.",
      match: (entry: ScalarEntry) => isDateLikeKey(entry.key) || isDateValue(entry.rawValue),
    },
  ];

  automaticGroupDefinitions.forEach((definition) => {
    const groupEntries = remainingEntries.filter(definition.match);
    if (groupEntries.length === 0) return;

    groupEntries.forEach((entry) => consumedKeys.add(entry.key));
    automaticGroups.push({
      key: definition.key,
      title: definition.title,
      description: definition.description,
      entries: groupEntries,
    });
  });

  return {
    groups: [...configuredGroups, ...automaticGroups],
    remainingEntries: entries.filter((entry) => !consumedKeys.has(entry.key)),
  };
}

function getAccordionToneClasses(tone: AccordionTone) {
  if (tone === "array") {
    return {
      wrapper: "border-sky-200/80 bg-white",
      icon: "border-sky-200 bg-sky-50 text-sky-700",
      badge: "border-sky-200 bg-sky-50 text-sky-700",
      toggle: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  if (tone === "technical") {
    return {
      wrapper: "border-slate-200 bg-white",
      icon: "border-slate-200 bg-slate-50 text-slate-700",
      badge: "border-slate-200 bg-slate-50 text-slate-700",
      toggle: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  return {
    wrapper: "border-emerald-200/80 bg-white",
    icon: "border-emerald-200 bg-emerald-50 text-emerald-700",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    toggle: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function SectionBadge({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </span>
  );
}

function InfoBanner({
  tone,
  title,
  description,
}: {
  tone: "loading" | "error";
  title: string;
  description: string;
}) {
  const classes =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <section className={`rounded-[24px] border px-5 py-4 shadow-sm ${classes}`}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-current/20 bg-white/70">
          <FiAlertCircle />
        </span>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em]">{title}</h3>
          <p className="mt-2 text-sm leading-6">{description}</p>
        </div>
      </div>
    </section>
  );
}

function AccordionSection({
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
  tone,
  icon,
  badge,
}: {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  tone: AccordionTone;
  icon: React.ReactNode;
  badge?: string;
}) {
  const toneClasses = getAccordionToneClasses(tone);

  return (
    <section
      className={`overflow-hidden rounded-[26px] border shadow-sm ${toneClasses.wrapper}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50/70"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${toneClasses.icon}`}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              {badge ? (
                <SectionBadge label={badge} className={toneClasses.badge} />
              ) : null}
            </div>
            {subtitle ? (
              <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${toneClasses.toggle}`}
        >
          {isOpen ? <FiChevronDown /> : <FiChevronRight />}
        </span>
      </button>
      {isOpen ? <div className="border-t border-slate-100 px-5 py-5">{children}</div> : null}
    </section>
  );
}

function ScalarEntryCard({ entry }: { entry: ScalarEntry }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {entry.label}
      </p>
      <div className="mt-3 break-words text-sm font-medium leading-6">{entry.content}</div>
    </article>
  );
}

function ScalarChipList({
  values,
  limit,
  baseKey,
}: {
  values: unknown[];
  limit?: number;
  baseKey: string;
}) {
  const visibleValues =
    typeof limit === "number" && Number.isFinite(limit) ? values.slice(0, limit) : values;

  return (
    <div className="flex flex-wrap gap-2">
      {visibleValues.map((value, index) => (
        <span
          key={`${baseKey}-scalar-${index}`}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          {formatCompactValue(value)}
        </span>
      ))}
    </div>
  );
}

function LinkedRecordPreviewCard({
  record,
  label,
  sourceKey,
  parentRecord,
  hiddenKeys,
  fieldLabels,
  fieldFormatters,
  previewLimit,
  badge,
  description,
  onOpenRecord,
}: {
  record: DetailViewRecord;
  label: string;
  sourceKey: string;
  parentRecord?: DetailViewRecord | null;
  hiddenKeys: Set<string>;
  fieldLabels: Record<string, string>;
  fieldFormatters: Record<string, DetailFieldFormatter>;
  previewLimit: number;
  badge?: string;
  description?: string;
  onOpenRecord: (
    value: DetailViewRecord,
    sourceKey: string,
    label?: string,
    parentRecord?: DetailViewRecord | null,
  ) => void;
}) {
  const summary = buildRecordSummary(record);
  const previewEntries = deriveScalarEntries(
    record,
    hiddenKeys,
    fieldLabels,
    fieldFormatters,
  ).businessEntries.slice(0, previewLimit);

  return (
    <article className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{label}</p>
            {badge ? (
              <SectionBadge
                label={badge}
                className="border-slate-200 bg-white text-slate-700"
              />
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {summary.length > 0
              ? summary.join(" | ")
              : (description ?? "Objet disponible pour exploration detaillee.")}
          </p>
        </div>
        <TableActionButton
          variant="secondary"
          onClick={() => onOpenRecord(record, sourceKey, label, parentRecord)}
        >
          <TableViewActionLabel />
        </TableActionButton>
      </div>

      {previewEntries.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {previewEntries.map((entry) => (
            <ScalarEntryCard key={`${sourceKey}-${label}-${entry.key}`} entry={entry} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function RelationArrayPreview({
  sectionLabel,
  sourceKey,
  rows,
  parentRecord,
  hiddenKeys,
  fieldLabels,
  fieldFormatters,
  previewLimit,
  objectFieldPreviewLimit,
  scalarLimit,
  objectBadge,
  objectDescription,
  onOpenRecord,
}: {
  sectionLabel: string;
  sourceKey: string;
  rows: unknown[];
  parentRecord?: DetailViewRecord | null;
  hiddenKeys: Set<string>;
  fieldLabels: Record<string, string>;
  fieldFormatters: Record<string, DetailFieldFormatter>;
  previewLimit: number;
  objectFieldPreviewLimit: number;
  scalarLimit?: number;
  objectBadge?: string;
  objectDescription?: string;
  onOpenRecord: (
    value: DetailViewRecord,
    sourceKey: string,
    label?: string,
    parentRecord?: DetailViewRecord | null,
  ) => void;
}) {
  const objectRows = rows.filter(isPlainObject);
  const scalarRows = rows.filter((row) => !isPlainObject(row));
  const visibleObjectRows =
    Number.isFinite(previewLimit) ? objectRows.slice(0, previewLimit) : objectRows;

  return (
    <div className="space-y-3">
      {visibleObjectRows.map((row, index) => {
        const rowTitle = buildRecordTitle(row, `${sectionLabel} ${index + 1}`);
        return (
          <LinkedRecordPreviewCard
            key={`${sourceKey}-linked-${rowTitle}-${index}`}
            record={row}
            label={rowTitle}
            sourceKey={sourceKey}
            parentRecord={parentRecord}
            hiddenKeys={hiddenKeys}
            fieldLabels={fieldLabels}
            fieldFormatters={fieldFormatters}
            previewLimit={objectFieldPreviewLimit}
            badge={objectBadge}
            description={objectDescription}
            onOpenRecord={onOpenRecord}
          />
        );
      })}

      {scalarRows.length > 0 ? (
        <ScalarChipList values={scalarRows} limit={scalarLimit} baseKey={sourceKey} />
      ) : null}
    </div>
  );
}

function RelationSidebarButton({
  section,
  isLoading,
  onClick,
}: {
  section: MissingRelationSection;
  isLoading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={[
        "w-full rounded-[24px] border px-4 py-4 text-left transition",
        "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50",
        isLoading ? "cursor-progress opacity-90" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
              section.availability === "loaded"
                ? section.isArray
                  ? "border-sky-200 bg-sky-50 text-sky-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
                : section.availability === "empty"
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {section.isArray ? <FiList /> : <FiLink2 />}
          </span>
          <div className="min-w-0">
            <p className="min-w-0 text-sm font-semibold">{section.label}</p>
            <p className="mt-1 text-xs text-slate-500">
              {section.availability === "missing"
                ? "Non chargee dans la vue courante"
                : section.availability === "empty"
                  ? section.isArray
                    ? "Liste chargee mais actuellement vide"
                    : "Relation chargee mais sans valeur"
                  : section.isArray
                    ? "Liste chargee"
                    : "Relation chargee"}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center ${
            isLoading ? "text-slate-500" : "text-slate-300"
          }`}
        >
          {isLoading ? <Spin inline size={16} thickness={2} label="Chargement" /> : <FiChevronRight />}
        </span>
      </div>
    </button>
  );
}

function MissingScalarFieldCard({
  field,
}: {
  field: MissingScalarFieldSection;
}) {
  return (
    <article className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{field.label}</p>
        <SectionBadge
          label={field.isTechnical ? "Technique" : "Attendu"}
          className={
            field.isTechnical
              ? "border-slate-200 bg-white text-slate-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }
        />
      </div>
      <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {field.key}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Ce champ est defini dans le modele genere, mais il n'est pas present dans la payload
        actuellement chargee.
      </p>
      <p className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600">
        {field.typeText}
      </p>
    </article>
  );
}

function PopupContentSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
          <FiGrid />
        </span>
        <div className="min-w-0">
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function LoadingSkeletonCard({ compact = false }: { compact?: boolean }) {
  return (
    <article
      className={`rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm ${
        compact ? "" : ""
      }`}
    >
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-24 rounded-full bg-slate-200" />
        <div className="h-4 w-3/4 rounded-full bg-slate-200" />
        {!compact ? <div className="h-4 w-2/3 rounded-full bg-slate-200" /> : null}
      </div>
    </article>
  );
}

function RelationLoadingState({ relationLabel }: { relationLabel: string }) {
  return (
    <PopupContentSection
      title="Chargement en cours"
      description="La relation ciblee est en train d'etre hydratee automatiquement."
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-[20px] border border-sky-200 bg-sky-50 px-4 py-4 text-sky-700">
          <Spin inline size={18} thickness={2.5} label="Chargement de la relation" />
          <div>
            <p className="text-sm font-semibold">Chargement de {relationLabel}</p>
            <p className="mt-1 text-sm leading-6 text-sky-700/80">
              Les donnees detaillees vont apparaitre ici des qu'elles seront disponibles.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <LoadingSkeletonCard />
          <LoadingSkeletonCard />
          <LoadingSkeletonCard compact />
          <LoadingSkeletonCard compact />
        </div>
      </div>
    </PopupContentSection>
  );
}

function RelationValuePreview({
  relation,
  value,
  isLoading,
  loadError,
  ownerRecord,
  hiddenKeys,
  fieldLabels,
  fieldFormatters,
  previewSettings,
  onOpenRecord,
}: {
  relation: MissingRelationSection;
  value: unknown;
  isLoading: boolean;
  loadError?: string | null;
  ownerRecord: DetailViewRecord;
  hiddenKeys: Set<string>;
  fieldLabels: Record<string, string>;
  fieldFormatters: Record<string, DetailFieldFormatter>;
  previewSettings: DetailPreviewSettings;
  onOpenRecord: (
    value: DetailViewRecord,
    sourceKey: string,
    label?: string,
    parentRecord?: DetailViewRecord | null,
  ) => void;
}) {
  if (value === undefined) {
    if (isLoading) {
      return <RelationLoadingState relationLabel={relation.label} />;
    }

    return (
      <PopupContentSection
        title="Aucune donnee retournee"
        description={
          loadError
            ? "Le chargement automatique n'a pas abouti pour cette relation."
            : "Le chargement automatique a ete lance, mais aucune valeur n'a ete renvoyee pour cette relation."
        }
      >
        <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
          {loadError
            ? loadError
            : "Aucune valeur exploitable n'a ete chargee pour cette relation."}
        </div>
      </PopupContentSection>
    );
  }

  if (value === null) {
    return (
      <PopupContentSection
        title="Relation vide"
        description="La relation a bien ete chargee, mais aucune valeur n'est rattachee a cet enregistrement."
      >
        <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
          Aucune donnee exploitable n'a ete retournee pour cette relation.
        </div>
      </PopupContentSection>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <PopupContentSection
          title="Liste chargee"
          description="La relation a bien ete chargee mais la liste associee est vide."
        >
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            Aucun element n'est actuellement rattache a cette liste.
          </div>
        </PopupContentSection>
      );
    }

    const objectRows = value.filter(isPlainObject);
    const scalarRows = value.filter((item) => !isPlainObject(item));

    return (
      <div className="space-y-5">
        <PopupContentSection
          title={`Liste de donnees (${value.length})`}
          description="Les elements charges pour cette relation sont affiches ci-dessous."
        >
          <RelationArrayPreview
            sectionLabel={relation.label}
            sourceKey={relation.key}
            rows={value}
            parentRecord={ownerRecord}
            hiddenKeys={hiddenKeys}
            fieldLabels={fieldLabels}
            fieldFormatters={fieldFormatters}
            previewLimit={previewSettings.popupArrayObjectLimit}
            objectFieldPreviewLimit={previewSettings.popupObjectPreviewLimit}
            scalarLimit={previewSettings.popupArrayScalarLimit}
            onOpenRecord={onOpenRecord}
          />
        </PopupContentSection>
      </div>
    );
  }

  if (!isPlainObject(value)) {
    return (
      <PopupContentSection
        title="Valeur chargee"
        description="La relation a renvoye une valeur simple."
      >
        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm font-medium leading-6 text-slate-900">
          {formatCompactValue(value)}
        </div>
      </PopupContentSection>
    );
  }

  const { businessEntries, technicalEntries } = deriveScalarEntries(
    value,
    hiddenKeys,
    fieldLabels,
    fieldFormatters,
  );
  const jsonSections = deriveJsonSections(value, hiddenKeys, fieldLabels);
  const objectSections = deriveObjectSections(value, hiddenKeys, fieldLabels);
  const arraySections = deriveArraySections(value, hiddenKeys, fieldLabels);

  return (
    <div className="space-y-5">
      <PopupContentSection
        title="Champs principaux"
        description="Les valeurs simples detectees sur l'objet charge."
      >
        {businessEntries.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {businessEntries.map((entry) => (
              <ScalarEntryCard key={`${relation.key}-business-${entry.key}`} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            Aucun champ simple metier n'a ete detecte sur cet objet.
          </div>
        )}
      </PopupContentSection>

      {objectSections.length > 0 ? (
        <PopupContentSection
          title="Objets lies"
          description="Relations directes deja presentes sur cet objet."
        >
          <div className="space-y-3">
            {objectSections.map((section) => {
              const sectionDescriptor = getStructuredFieldDescriptor(value, section.key);
              return (
                <LinkedRecordPreviewCard
                  key={`${relation.key}-object-${section.key}`}
                  record={section.value}
                  label={section.label}
                  sourceKey={section.key}
                  parentRecord={value}
                  hiddenKeys={hiddenKeys}
                  fieldLabels={fieldLabels}
                  fieldFormatters={fieldFormatters}
                  previewLimit={previewSettings.popupObjectPreviewLimit}
                  badge={sectionDescriptor.badge}
                  description={sectionDescriptor.previewHint}
                  onOpenRecord={onOpenRecord}
                />
              );
            })}
          </div>
        </PopupContentSection>
      ) : null}

      {arraySections.length > 0 ? (
        <PopupContentSection
          title="Tableaux rattaches"
          description="Listes detectees sur cet objet avec un apercu rapide."
        >
          <div className="space-y-3">
            {arraySections.map((section) => {
              return (
                <article
                  key={`${relation.key}-array-${section.key}`}
                  className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                    <SectionBadge
                      label={`${section.rows.length} element(s)`}
                      className="border-slate-200 bg-white text-slate-700"
                    />
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-600">
                    <RelationArrayPreview
                      sectionLabel={section.label}
                      sourceKey={section.key}
                      rows={section.rows}
                      parentRecord={value}
                      hiddenKeys={hiddenKeys}
                      fieldLabels={fieldLabels}
                      fieldFormatters={fieldFormatters}
                      previewLimit={previewSettings.popupArrayObjectLimit}
                      objectFieldPreviewLimit={previewSettings.popupObjectPreviewLimit}
                      scalarLimit={previewSettings.popupArrayScalarLimit}
                      objectBadge={getStructuredFieldDescriptor(value, section.key, { isArray: true }).badge}
                      objectDescription={getStructuredFieldDescriptor(
                        value,
                        section.key,
                        { isArray: true },
                      ).previewHint}
                      onOpenRecord={onOpenRecord}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </PopupContentSection>
      ) : null}

      {jsonSections.length > 0 ? (
        <PopupContentSection
          title="Blocs JSON"
          description="Structures libres detectees sur cette relation."
        >
          <div className="space-y-3">
            {jsonSections.map((section) => (
              <article key={`${relation.key}-json-${section.key}`} className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                {renderJsonPreview(section.value)}
              </article>
            ))}
          </div>
        </PopupContentSection>
      ) : null}

      {technicalEntries.length > 0 ? (
        <PopupContentSection
          title="Informations techniques"
          description="Identifiants et traces systeme egalement presentes sur cette relation."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {technicalEntries.map((entry) => (
              <ScalarEntryCard key={`${relation.key}-technical-${entry.key}`} entry={entry} />
            ))}
          </div>
        </PopupContentSection>
      ) : null}
    </div>
  );
}

function buildPopupDetailRow(
  relation: MissingRelationSection,
  value: unknown,
): DetailViewRecord | null {
  if (isPlainObject(value)) {
    return value;
  }

  if (Array.isArray(value) && value.some(isPlainObject)) {
    return {
      titre: relation.label,
      total_elements: value.length,
      [relation.key]: value,
    };
  }

  return null;
}

function ScalarGroupSection({
  title,
  description,
  entries,
}: {
  title: string;
  description?: string;
  entries: ScalarEntry[];
}) {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
          <FiGrid />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {entries.length > 0 ? (
          entries.map((entry) => <ScalarEntryCard key={`${title}-${entry.key}`} entry={entry} />)
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-5 text-sm text-slate-500">
            Aucune information supplementaire a afficher pour cette section.
          </div>
        )}
      </div>
    </section>
  );
}

function JsonSectionPanel({
  title,
  value,
  isOpen,
  onToggle,
}: {
  title: string;
  value: unknown;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <AccordionSection
      title={title}
      subtitle="Bloc JSON ou structure libre associee a cet enregistrement."
      badge="JSON"
      tone="technical"
      icon={<FiFileText />}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {renderJsonPreview(value)}
    </AccordionSection>
  );
}

function getPreferredPreviewKeysForRows(
  rows: DetailViewRecord[],
  hiddenKeys: Set<string>,
  previewSettings: DetailPreviewSettings,
) {
  const frequency = new Map<string, number>();
  const firstSeenRank = new Map<string, number>();

  rows.slice(0, 12).forEach((row, rowIndex) => {
    getPreferredPreviewKeys(row, hiddenKeys, previewSettings).forEach((key, keyIndex) => {
      frequency.set(key, (frequency.get(key) ?? 0) + 1);
      if (!firstSeenRank.has(key)) {
        firstSeenRank.set(key, rowIndex * 100 + keyIndex);
      }
    });
  });

  if (frequency.size === 0) {
    const fallbackRow = rows.find((row) =>
      Object.keys(row).some((key) => isScalarValue(row[key])),
    );

    if (!fallbackRow) {
      return [];
    }

    return Object.keys(fallbackRow)
      .filter((key) => !isDefaultHiddenKey(key) && isScalarValue(fallbackRow[key]))
      .slice(0, 4);
  }

  const columnLimit = Math.max(3, Math.min(6, previewSettings.businessPreviewLimit));

  return Array.from(frequency.keys())
    .sort((left, right) => {
      const frequencyDelta = (frequency.get(right) ?? 0) - (frequency.get(left) ?? 0);
      if (frequencyDelta !== 0) return frequencyDelta;
      return (firstSeenRank.get(left) ?? 0) - (firstSeenRank.get(right) ?? 0);
    })
    .slice(0, columnLimit);
}

function ArraySectionTable({
  title,
  sourceRecord,
  sourceKey,
  rows,
  hiddenKeys,
  fieldLabels,
  previewSettings,
  isOpen,
  onToggle,
  onViewRow,
}: {
  title: string;
  sourceRecord: DetailViewRecord;
  sourceKey: string;
  rows: unknown[];
  hiddenKeys: Set<string>;
  fieldLabels: Record<string, string>;
  previewSettings: DetailPreviewSettings;
  isOpen: boolean;
  onToggle: () => void;
  onViewRow: (row: DetailViewRecord, label: string) => void;
}) {
  const objectRows = rows.filter(isPlainObject);
  const scalarRows = rows.filter((row) => !isPlainObject(row));
  const descriptor = getStructuredFieldDescriptor(sourceRecord, sourceKey, { isArray: true });

  if (objectRows.length === 0) {
    return (
      <AccordionSection
        title={title}
        subtitle={descriptor.subtitle}
        badge={descriptor.badge}
        tone="array"
        icon={<FiList />}
        isOpen={isOpen}
        onToggle={onToggle}
      >
        <div className="flex flex-wrap gap-2">
          {scalarRows.map((value, index) => (
            <span
              key={`${title}-scalar-${index}`}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              {formatCompactValue(value)}
            </span>
          ))}
        </div>
      </AccordionSection>
    );
  }

  const columns = getPreferredPreviewKeysForRows(objectRows, hiddenKeys, previewSettings);

  return (
    <AccordionSection
      title={title}
      subtitle={descriptor.subtitle}
      badge={`${descriptor.badge} · ${rows.length} ligne(s)`}
      tone="array"
      icon={<FiList />}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50/70">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-white">
                {columns.map((key) => (
                  <th
                    key={`${title}-${key}`}
                    className="border-b border-slate-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    {fieldLabels[key] ?? humanizeKey(key)}
                  </th>
                ))}
                <th className="border-b border-slate-200 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {objectRows.map((nestedRow, index) => {
                const rowTitle = buildRecordTitle(nestedRow, `${title} ${index + 1}`);
                return (
                  <tr
                    key={`${title}-${rowTitle}-${index}`}
                    className="border-b border-slate-200/70 bg-white last:border-b-0"
                  >
                    {columns.map((key) => (
                      <td
                        key={`${title}-${rowTitle}-${key}`}
                        className="px-4 py-3 text-sm text-slate-700"
                      >
                        {formatCompactValue(nestedRow[key])}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <TableActionButton
                        variant="secondary"
                        onClick={() => onViewRow(nestedRow, rowTitle)}
                      >
                        <TableViewActionLabel />
                      </TableActionButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AccordionSection>
  );
}

export function createViewRowAction<T>(
  onView: (row: T) => void,
  label = "Voir",
): RowAction<T> {
  return {
    label,
    kind: "view",
    variant: "secondary",
    render: () => <TableViewActionLabel label={label} />,
    onClick: (row) => onView(row),
  };
}

export default function RecursiveDetailView<T extends DetailViewRecord>({
  title,
  row,
  renderMode = "exhaustive",
  onBack,
  onEdit,
  editLabel = "Modifier",
  emptyTitle = "Vue indisponible",
  emptyDescription = "Selectionne une ligne depuis le tableau pour afficher ses details.",
  hiddenKeys = [],
  fieldLabels = {},
  fieldGroups = [],
  fieldFormatters = {},
  loading = false,
  error = null,
  loadNestedDetailData,
}: Props<T>) {
  const [showAllContent, setShowAllContent] = React.useState(false);
  const previewSettings = React.useMemo(
    () => getDetailPreviewSettings(renderMode, showAllContent),
    [renderMode, showAllContent],
  );
  const hiddenKeySet = React.useMemo(
    () => new Set([...DEFAULT_HIDDEN_KEYS, ...hiddenKeys]),
    [hiddenKeys],
  );

  const rootNode = React.useMemo<DetailNode | null>(() => {
    if (!row) return null;
    return createNode(
      "root",
      enrichGeneratedDetailModelHints(row, { maxDepth: 2 }),
      title,
      { hydrated: true },
    );
  }, [row, title]);

  const [stack, setStack] = React.useState<DetailNode[]>(rootNode ? [rootNode] : []);
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
  const [selectedReloadRelationKey, setSelectedReloadRelationKey] = React.useState<string | null>(null);
  const [pendingRelationLoadKey, setPendingRelationLoadKey] = React.useState<string | null>(null);
  const [relationSearch, setRelationSearch] = React.useState("");
  const detailRequestRef = React.useRef(0);
  const viewRootRef = React.useRef<HTMLDivElement | null>(null);
  const mainScrollPaneRef = React.useRef<HTMLDivElement | null>(null);
  const sidebarScrollPaneRef = React.useRef<HTMLElement | null>(null);
  const previousNodeIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setStack(rootNode ? [rootNode] : []);
  }, [rootNode]);

  const currentNode = stack[stack.length - 1] ?? null;
  const currentRow = currentNode?.value ?? null;
  const resolvedCurrentRow = (currentRow ?? {}) as DetailViewRecord;
  const currentNodeId = currentNode?.id ?? "detail-root";
  const fallbackParentRecord = React.useMemo(
    () => (stack.length > 1 ? stack[stack.length - 2]?.value ?? null : null),
    [stack],
  );

  React.useEffect(() => {
    setSelectedReloadRelationKey(null);
    setPendingRelationLoadKey(null);
    setRelationSearch("");
  }, [currentNode?.id]);

  React.useEffect(() => {
    setShowAllContent(false);
  }, [currentNode?.id]);

  React.useEffect(() => {
    const nodeId = currentNode?.id ?? null;

    if (!nodeId) {
      previousNodeIdRef.current = null;
      return;
    }

    if (previousNodeIdRef.current === null) {
      previousNodeIdRef.current = nodeId;
      return;
    }

    if (previousNodeIdRef.current === nodeId) {
      return;
    }

    previousNodeIdRef.current = nodeId;

    const frameId = window.requestAnimationFrame(() => {
      viewRootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      mainScrollPaneRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      sidebarScrollPaneRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [currentNode?.id]);

  React.useEffect(() => {
    if (!currentNode || !loadNestedDetailData || currentNode.hydrated || currentNode.loading) {
      return;
    }

    const nodeId = currentNode.id;
    const nodeValue = currentNode.value;
    const nodeSourceKey = currentNode.sourceKey ?? null;
    const nodeParentRecord = currentNode.parentRecord ?? fallbackParentRecord;
    const nodeForceIncludeKeys = currentNode.forceIncludeKeys ?? undefined;
    const nodeMode = stack.length > 1 ? "nested" : "root";

    let isCancelled = false;
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;

    setStack((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              loading: true,
              error: null,
            }
          : node,
      ),
    );

    const loadContext = {
      mode: nodeMode,
      sourceKey: nodeSourceKey,
      parentRecord: nodeParentRecord,
      forceIncludeKeys: nodeForceIncludeKeys,
    } as const;

    void Promise.resolve()
      .then(() => loadNestedDetailData(nodeValue, loadContext))
      .then((loadedRecord) => {
        if (isCancelled || detailRequestRef.current !== requestId) return;

        setStack((current) =>
          current.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  value:
                    loadedRecord && isPlainObject(loadedRecord)
                      ? enrichGeneratedDetailModelHints(
                          {
                            ...node.value,
                            ...loadedRecord,
                          },
                          {
                            parentRecord: loadContext.parentRecord ?? null,
                            relationKey: loadContext.sourceKey ?? null,
                            maxDepth: 2,
                          },
                        )
                      : node.value,
                  hydrated: true,
                  loading: false,
                  error: null,
                  forceIncludeKeys: null,
                }
              : node,
          ),
        );
        setPendingRelationLoadKey(null);
      })
      .catch((caughtError: unknown) => {
        if (isCancelled || detailRequestRef.current !== requestId) return;

        setStack((current) =>
          current.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  hydrated: true,
                  loading: false,
                  error:
                    caughtError instanceof Error
                      ? caughtError.message
                      : "Impossible de charger les details complementaires.",
                  forceIncludeKeys: null,
                }
              : node,
          ),
        );
        setPendingRelationLoadKey(null);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    fallbackParentRecord,
    currentNode?.id,
    currentNode?.hydrated,
    currentNode?.forceIncludeKeys,
    currentNode?.parentRecord,
    currentNode?.sourceKey,
    currentNode?.value,
    loadNestedDetailData,
    stack.length,
  ]);

  const toggleSection = React.useCallback((sectionId: string) => {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: current[sectionId] === undefined ? true : !current[sectionId],
    }));
  }, []);

  const isSectionOpen = React.useCallback(
    (sectionId: string) => openSections[sectionId] ?? false,
    [openSections],
  );

  const openNestedRecord = React.useCallback(
    (
      value: DetailViewRecord,
      sourceKey: string,
      label?: string,
      parentRecord?: DetailViewRecord | null,
    ) => {
      const resolvedParentRecord = parentRecord ?? currentNode?.value ?? null;
      setStack((current) => [
        ...current,
        createNode(
          sourceKey,
          enrichGeneratedDetailModelHints(value, {
            parentRecord: resolvedParentRecord,
            relationKey: sourceKey,
            maxDepth: 2,
          }),
          label,
          {
            parentRecord: resolvedParentRecord,
            hydrated: !loadNestedDetailData,
          },
        ),
      ]);
    },
    [currentNode?.value, loadNestedDetailData],
  );

  const reloadCurrentNode = React.useCallback((forceIncludeKey?: string) => {
    if (!currentNode || !loadNestedDetailData) return;

    setStack((current) =>
      current.map((node) =>
        node.id === currentNode.id
          ? {
              ...node,
              hydrated: false,
              loading: false,
              error: null,
              forceIncludeKeys: forceIncludeKey ? [forceIncludeKey] : null,
            }
          : node,
      ),
    );
  }, [currentNode, loadNestedDetailData]);

  const openReloadRelationPopup = React.useCallback(
    (section: MissingRelationSection) => {
      setSelectedReloadRelationKey(section.key);

      if (
        section.availability !== "missing" ||
        !loadNestedDetailData ||
        currentNode?.loading
      ) {
        setPendingRelationLoadKey(null);
        return;
      }

      setPendingRelationLoadKey(section.key);
      reloadCurrentNode(section.key);
    },
    [currentNode?.loading, loadNestedDetailData, reloadCurrentNode],
  );

  const handleBack = () => {
    if (stack.length > 1) {
      setStack((current) => current.slice(0, -1));
      return;
    }
    onBack?.();
  };

  const { businessEntries, technicalEntries } = deriveScalarEntries(
    resolvedCurrentRow,
    hiddenKeySet,
    fieldLabels,
    fieldFormatters,
  );
  const jsonSections = deriveJsonSections(resolvedCurrentRow, hiddenKeySet, fieldLabels);
  const objectSections = deriveObjectSections(resolvedCurrentRow, hiddenKeySet, fieldLabels);
  const arraySections = deriveArraySections(resolvedCurrentRow, hiddenKeySet, fieldLabels);
  const relationSections = deriveRelationSections(
    resolvedCurrentRow,
    hiddenKeySet,
    fieldLabels,
  );
  const missingScalarFieldSections = deriveMissingScalarFieldSections(
    resolvedCurrentRow,
    hiddenKeySet,
    fieldLabels,
  );
  const selectedReloadRelation = selectedReloadRelationKey
    ? resolveRelationSectionDescriptor(resolvedCurrentRow, selectedReloadRelationKey, fieldLabels)
    : null;
  const selectedReloadRelationValue = selectedReloadRelation
    ? resolvedCurrentRow[selectedReloadRelation.key]
    : undefined;
  const selectedReloadRelationDetailRow =
    selectedReloadRelation
      ? buildPopupDetailRow(selectedReloadRelation, selectedReloadRelationValue)
      : null;
  const selectedReloadRelationIsLoading =
    Boolean(selectedReloadRelation) &&
    pendingRelationLoadKey === selectedReloadRelation.key &&
    Boolean(
      currentNode?.loading || currentNode?.forceIncludeKeys?.includes(selectedReloadRelation.key),
    );
  const { groups: groupedEntries, remainingEntries } = resolveFieldGroups(
    resolvedCurrentRow,
    businessEntries,
    fieldGroups,
  );
  const heroBadges = deriveHeroBadges(resolvedCurrentRow, fieldLabels, previewSettings);
  const spotlightEntries = deriveSpotlightEntries(
    remainingEntries.length > 0 ? remainingEntries : businessEntries,
    resolvedCurrentRow,
    previewSettings,
  );
  const canGoBack = stack.length > 1 || Boolean(onBack);
  const breadcrumbItems = stack.map((item) => item.title);
  const isNestedNode = stack.length > 1;
  const resolvedLoading = isNestedNode ? Boolean(currentNode?.loading) : loading;
  const resolvedError = isNestedNode ? currentNode?.error ?? null : error;
  const hasReloadSidebar = relationSections.length > 0;
  const normalizedRelationSearch = relationSearch.trim().toLowerCase();
  const filteredRelationSections = React.useMemo(
    () =>
      relationSections.filter((section) => {
        if (!normalizedRelationSearch) return true;

        const haystack = [section.label, section.key, section.relatedModel ?? ""]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedRelationSearch);
      }),
    [relationSections, normalizedRelationSearch],
  );
  const splitLayoutClass = hasReloadSidebar
    ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]"
    : "";
  const scrollPaneClass =
    "xl:min-h-0 xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto xl:pr-2";
  const sidebarScrollPaneClass =
    "xl:min-h-0 xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto xl:pl-1";
  const currentSectionIds = React.useMemo(
    () => [
      ...jsonSections.map((section) => `json-${currentNodeId}-${section.key}`),
      ...objectSections.map((section) => `object-${currentNodeId}-${section.key}`),
      ...arraySections.map((section) => `array-${currentNodeId}-${section.key}`),
      ...(missingScalarFieldSections.length > 0 ? [`missing-scalars-${currentNodeId}`] : []),
      ...(technicalEntries.length > 0 ? [`technical-${currentNodeId}`] : []),
    ],
    [
      arraySections,
      currentNodeId,
      jsonSections,
      missingScalarFieldSections.length,
      objectSections,
      technicalEntries.length,
    ],
  );
  const collapseAllSections = React.useCallback(() => {
    setOpenSections((current) => ({
      ...current,
      ...Object.fromEntries(currentSectionIds.map((sectionId) => [sectionId, false])),
    }));
  }, [currentSectionIds]);
  const expandAllSections = React.useCallback(() => {
    setOpenSections((current) => ({
      ...current,
      ...Object.fromEntries(currentSectionIds.map((sectionId) => [sectionId, true])),
    }));
  }, [currentSectionIds]);

  React.useEffect(() => {
    if (!showAllContent || currentSectionIds.length === 0) return;
    expandAllSections();
  }, [currentSectionIds, expandAllSections, showAllContent]);

  if (!currentRow) {
    return (
      <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">{emptyTitle}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div ref={viewRootRef} className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {canGoBack ? (
                <TableActionButton
                  variant="secondary"
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={handleBack}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <FiArrowLeft className="text-[13px]" />
                    <span>Retour</span>
                  </span>
                </TableActionButton>
              ) : null}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SectionBadge
                    label={stack.length > 1 ? "Vue imbriquee" : "Vue detail"}
                    className="border-slate-200 bg-slate-50 text-slate-700"
                  />
                  {currentNode.sourceKey && currentNode.sourceKey !== "root" ? (
                    <SectionBadge
                      label={humanizeKey(currentNode.sourceKey)}
                      className="border-slate-200 bg-slate-50 text-slate-600"
                    />
                  ) : null}
                  {heroBadges.map((badge) => (
                    <SectionBadge
                      key={`hero-badge-${badge.key}`}
                      label={`${badge.label}: ${badge.value}`}
                      className={badge.className}
                    />
                  ))}
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                  {currentNode.title}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Vue synthetique de l'enregistrement courant, avec ses champs, ses relations et ses
                  listes rattachees.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {currentSectionIds.length > 0 ? (
                <>
                  <TableActionButton
                    variant="secondary"
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    onClick={expandAllSections}
                  >
                    Tout deplier
                  </TableActionButton>
                  <TableActionButton
                    variant="secondary"
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    onClick={collapseAllSections}
                  >
                    Tout replier
                  </TableActionButton>
                </>
              ) : null}
              <TableActionButton
                variant="secondary"
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => setShowAllContent((current) => !current)}
              >
                {showAllContent ? "Vue synthetique" : "Tout afficher"}
              </TableActionButton>
              {stack.length === 1 && row && onEdit ? (
                <TableActionButton
                  variant="secondary"
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => onEdit(row)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <FiEdit3 className="text-[13px]" />
                    <span>{editLabel}</span>
                  </span>
                </TableActionButton>
              ) : null}
            </div>
          </div>

          {breadcrumbItems.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {breadcrumbItems.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          {spotlightEntries.length > 0 || businessEntries.length > 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Reperes rapides</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Quelques informations cles mises en avant pour faciliter la lecture.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SectionBadge
                    label={`${businessEntries.length} champ(s) metier`}
                    className="border-slate-200 bg-white text-slate-700"
                  />
                  <SectionBadge
                    label={`${objectSections.length} objet(s) lie(s)`}
                    className="border-slate-200 bg-white text-slate-700"
                  />
                  <SectionBadge
                    label={`${arraySections.length} tableau(x)`}
                    className="border-slate-200 bg-white text-slate-700"
                  />
                  {jsonSections.length > 0 ? (
                    <SectionBadge
                      label={`${jsonSections.length} bloc(s) JSON`}
                      className="border-slate-200 bg-white text-slate-700"
                    />
                  ) : null}
                  {relationSections.length > 0 ? (
                    <SectionBadge
                      label={`${relationSections.length} relation(s) du modele`}
                      className="border-slate-200 bg-white text-slate-700"
                    />
                  ) : null}
                  {missingScalarFieldSections.length > 0 ? (
                    <SectionBadge
                      label={`${missingScalarFieldSections.length} champ(s) non charge(s)`}
                      className="border-amber-200 bg-amber-50 text-amber-700"
                    />
                  ) : null}
                </div>
              </div>

              {spotlightEntries.length > 0 ? (
                <dl className="mt-4 grid gap-3 md:grid-cols-2">
                  {spotlightEntries.map((entry) => (
                    <div
                      key={`spotlight-${entry.key}`}
                      className="rounded-[20px] border border-slate-200 bg-white px-4 py-3"
                    >
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {entry.label}
                      </dt>
                      <dd className="mt-2 text-sm font-medium leading-6 text-slate-900">
                        {entry.content}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {resolvedLoading ? (
        <InfoBanner
          tone="loading"
          title="Chargement en cours"
          description="Le systeme complete la fiche avec des donnees plus riches et des relations detaillees."
        />
      ) : null}

      {resolvedError ? (
        <InfoBanner
          tone="error"
          title="Chargement partiel"
          description={resolvedError}
        />
      ) : null}

      <div className={splitLayoutClass}>
        <div
          ref={mainScrollPaneRef}
          className={`space-y-6 ${hasReloadSidebar ? scrollPaneClass : ""}`}
        >
          {remainingEntries.length > 0 || groupedEntries.length === 0 ? (
            <ScalarGroupSection
              title="Informations principales"
              description="Les valeurs directement portees par la ligne selectionnee, sans les identifiants et champs systeme."
              entries={remainingEntries}
            />
          ) : null}

          {groupedEntries.map((group) => (
            <ScalarGroupSection
              key={`group-${group.key}`}
              title={group.title}
              description={group.description}
              entries={group.entries}
            />
          ))}

          {missingScalarFieldSections.length > 0 ? (
            <AccordionSection
              title="Champs attendus non charges"
              subtitle="Ces proprietes existent dans le modele genere, mais elles ne sont pas encore presentes dans la payload actuellement affichee."
              badge={`${missingScalarFieldSections.length} champ(s)`}
              tone="technical"
              icon={<FiFileText />}
              isOpen={isSectionOpen(`missing-scalars-${currentNode.id}`)}
              onToggle={() => toggleSection(`missing-scalars-${currentNode.id}`)}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {missingScalarFieldSections.map((field) => (
                  <MissingScalarFieldCard
                    key={`missing-scalar-${currentNode.id}-${field.key}`}
                    field={field}
                  />
                ))}
              </div>
            </AccordionSection>
          ) : null}

          {jsonSections.map((section) => {
            const sectionId = `json-${currentNode.id}-${section.key}`;
            return (
              <JsonSectionPanel
                key={sectionId}
                title={section.label}
                value={section.value}
                isOpen={isSectionOpen(sectionId)}
                onToggle={() => toggleSection(sectionId)}
              />
            );
          })}

          {objectSections.map((section) => {
            const sectionId = `object-${currentNode.id}-${section.key}`;
            const summary = buildRecordSummary(section.value);
            const sectionDescriptor = getStructuredFieldDescriptor(currentRow, section.key);

            return (
              <AccordionSection
                key={sectionId}
                title={section.label}
                subtitle={
                  summary.length > 0
                    ? summary.join(" | ")
                    : sectionDescriptor.subtitle
                }
                badge={sectionDescriptor.badge}
                tone="object"
                icon={<FiLink2 />}
                isOpen={isSectionOpen(sectionId)}
                onToggle={() => toggleSection(sectionId)}
              >
                <LinkedRecordPreviewCard
                  record={section.value}
                  label={section.label}
                  sourceKey={section.key}
                  parentRecord={currentRow}
                  hiddenKeys={hiddenKeySet}
                  fieldLabels={fieldLabels}
                  fieldFormatters={fieldFormatters}
                  previewLimit={previewSettings.objectPreviewLimit}
                  badge={sectionDescriptor.badge}
                  description={sectionDescriptor.previewHint}
                  onOpenRecord={openNestedRecord}
                />
              </AccordionSection>
            );
          })}

          {arraySections.map((section) => {
            const sectionId = `array-${currentNode.id}-${section.key}`;
            return (
            <ArraySectionTable
              key={sectionId}
              title={section.label}
              sourceRecord={currentRow}
              sourceKey={section.key}
              rows={section.rows}
              hiddenKeys={hiddenKeySet}
              fieldLabels={fieldLabels}
              previewSettings={previewSettings}
                isOpen={isSectionOpen(sectionId)}
                onToggle={() => toggleSection(sectionId)}
                onViewRow={(nestedRow, nestedLabel) =>
                  openNestedRecord(nestedRow, section.key, nestedLabel)
                }
              />
            );
          })}

          {objectSections.length === 0 &&
          arraySections.length === 0 &&
          jsonSections.length === 0 &&
          relationSections.length === 0 &&
          missingScalarFieldSections.length === 0 ? (
            <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                  <FiGrid />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Aucune relation supplementaire
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Cet element ne contient pas d'objet lie ni de tableau imbrique a explorer.
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {technicalEntries.length > 0 ? (
            <AccordionSection
              title="Informations techniques"
              subtitle="Identifiants internes, cles de liaison et horodatages systeme."
              badge={`${technicalEntries.length} champ(s)`}
              tone="technical"
              icon={<FiGrid />}
              isOpen={isSectionOpen(`technical-${currentNode.id}`)}
              onToggle={() => toggleSection(`technical-${currentNode.id}`)}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {technicalEntries.map((entry) => (
                  <article
                    key={`technical-${currentNode.id}-${entry.key}`}
                    className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {entry.label}
                    </p>
                    <div className="mt-2 break-words text-sm leading-6">{entry.content}</div>
                  </article>
                ))}
              </div>
            </AccordionSection>
          ) : null}

        </div>

        {hasReloadSidebar ? (
          <aside
            ref={sidebarScrollPaneRef}
            className={`self-start ${sidebarScrollPaneClass}`}
          >
            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                  <FiLayers />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Relations du modele
                  </h3>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {relationSections.length > 6 ? (
                  <div className="space-y-3">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Rechercher une relation
                      </label>
                      <div className="mt-2 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                        <FiSearch className="shrink-0 text-slate-400" />
                        <input
                          value={relationSearch}
                          onChange={(event) => setRelationSearch(event.target.value)}
                          placeholder="Nom, cle ou modele..."
                          className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <p className="px-1 text-xs font-medium text-slate-500">
                      {filteredRelationSections.length} relation(s) affichee(s) sur{" "}
                      {relationSections.length}
                    </p>
                  </div>
                ) : null}

                {filteredRelationSections.length > 0 ? (
                  filteredRelationSections.map((section) => (
                    <RelationSidebarButton
                      key={`sidebar-${currentNode.id}-${section.key}`}
                      section={section}
                      isLoading={
                        pendingRelationLoadKey === section.key &&
                        Boolean(
                          currentNode?.loading ||
                          currentNode?.forceIncludeKeys?.includes(section.key),
                        )
                      }
                      onClick={() => openReloadRelationPopup(section)}
                    />
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
                    Aucune relation ne correspond au filtre courant.
                  </div>
                )}
              </div>
            </section>
          </aside>
        ) : null}
      </div>

      {selectedReloadRelation ? (
        <DetailValuePopup
          isOpen={Boolean(selectedReloadRelation)}
          title={selectedReloadRelation.label}
          badge={
            selectedReloadRelation.isArray
              ? selectedReloadRelationValue === undefined
                ? "Liste a charger"
                : "Liste relationnelle"
              : selectedReloadRelationValue === undefined
                ? "Objet a charger"
                : "Objet relationnel"
          }
          onClose={() => setSelectedReloadRelationKey(null)}
        >
          {selectedReloadRelationDetailRow ? (
            <RecursiveDetailView<DetailViewRecord>
              title={selectedReloadRelation.label}
              row={selectedReloadRelationDetailRow}
              renderMode={renderMode}
              onBack={() => setSelectedReloadRelationKey(null)}
              emptyTitle={emptyTitle}
              emptyDescription={emptyDescription}
              hiddenKeys={hiddenKeys}
              fieldLabels={fieldLabels}
              fieldGroups={fieldGroups}
              fieldFormatters={fieldFormatters}
              loading={selectedReloadRelationIsLoading}
              error={selectedReloadRelationValue === undefined ? resolvedError : null}
              loadNestedDetailData={loadNestedDetailData}
            />
          ) : (
            <RelationValuePreview
              relation={selectedReloadRelation}
              value={selectedReloadRelationValue}
              isLoading={selectedReloadRelationIsLoading}
              loadError={selectedReloadRelationValue === undefined ? resolvedError : null}
              ownerRecord={currentRow}
              hiddenKeys={hiddenKeySet}
              fieldLabels={fieldLabels}
              fieldFormatters={fieldFormatters}
              previewSettings={previewSettings}
              onOpenRecord={(value, sourceKey, label, parentRecord) => {
                openNestedRecord(value, sourceKey, label, parentRecord);
                setSelectedReloadRelationKey(null);
              }}
            />
          )}
        </DetailValuePopup>
      ) : null}
    </div>
  );
}
