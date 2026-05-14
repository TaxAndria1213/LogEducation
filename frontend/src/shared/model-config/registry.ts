import { z } from "zod";
import * as GeneratedZod from "../../generated/zod";
import {
  getCanonicalDetailEndpointByModelName,
  getCanonicalDetailModelNameByEndpoint,
} from "../detail/detail-endpoint-registry";
import {
  generatedDetailModelMeta,
  type GeneratedDetailFieldMeta,
  type GeneratedDetailModelMeta,
} from "../detail/detail-meta.generated";
import { eleveModelConfig } from "./configs/eleve.config";
import { evaluationModelConfig } from "./configs/evaluation.config";
import type { FormField, ModelConfig } from "./types";

const registry = new Map<string, ModelConfig<any>>();
const generatedConfigCache = new Map<
  string,
  ModelConfig<any> | null
>();

const SYSTEM_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "created_by",
  "updated_by",
  "deleted_by",
]);

const AUTO_EXCLUDED_RELATION_MODELS = new Set([
  "Utilisateur",
  "Role",
  "Permission",
  "UtilisateurRole",
  "RolePermission",
  "JournalAudit",
  "JetonIntegration",
  "Webhook",
]);

const AUTO_EXCLUDED_RELATION_KEYS = [
  /^created/i,
  /^updated/i,
  /^deleted/i,
  /^validated/i,
  /^published/i,
  /^acteur/i,
  /^verifie/i,
  /permission/i,
  /role/i,
  /token/i,
  /secret/i,
  /audit/i,
];

function normalizeKey(value: string) {
  return value.replace(/^\/api\//, "").replace(/^\//, "").trim().toLowerCase();
}

function stripApiPrefix(value: string) {
  return value.replace(/^\/api\//, "").replace(/^\//, "").trim();
}

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function singularize(value: string) {
  if (value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.endsWith("s")) return value.slice(0, -1);
  return value;
}

function toPascalCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join("");
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function stripGeneratedDetailModelSuffix(modelName: string) {
  return modelName.replace(/(WithRelations|Row)$/, "");
}

function buildGeneratedDetailModelNameCandidates(modelName: string) {
  const baseModelName = stripGeneratedDetailModelSuffix(modelName);
  return uniqueStrings([
    modelName,
    baseModelName,
    `${baseModelName}WithRelations`,
    `${baseModelName}Row`,
  ]);
}

function tokenizeIdentifier(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split("_")
    .filter(Boolean);
}

function normalizeIdentifier(value: string) {
  return tokenizeIdentifier(value).join("");
}

function stripForeignKeySuffix(fieldName: string) {
  if (fieldName.endsWith("_id")) {
    return fieldName.slice(0, -3);
  }

  if (fieldName.endsWith("Id")) {
    return fieldName.slice(0, -2);
  }

  return fieldName;
}

function stripForeignKeyArraySuffix(fieldName: string) {
  if (fieldName.endsWith("_ids")) {
    return fieldName.slice(0, -4);
  }

  if (fieldName.endsWith("Ids")) {
    return fieldName.slice(0, -3);
  }

  return stripForeignKeySuffix(fieldName);
}

function typeNameOf(schema: z.ZodTypeAny) {
  const anySchema = schema as z.ZodTypeAny & {
    _def?: { typeName?: string; innerType?: z.ZodTypeAny; type?: z.ZodTypeAny };
  };
  return anySchema._def?.typeName ?? "Unknown";
}

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;

  while (true) {
    const typeName = typeNameOf(current);
    if (
      typeName === "ZodOptional" ||
      typeName === "ZodNullable" ||
      typeName === "ZodDefault"
    ) {
      const nextSchema = (
        current as z.ZodTypeAny & {
          _def?: { innerType?: z.ZodTypeAny; type?: z.ZodTypeAny };
        }
      )._def?.innerType ??
        (
          current as z.ZodTypeAny & {
            _def?: { innerType?: z.ZodTypeAny; type?: z.ZodTypeAny };
          }
        )._def?.type;

      if (!nextSchema) {
        return current;
      }

      current = nextSchema;
      continue;
    }

    return current;
  }
}

function getEnumOptions(schema: z.ZodTypeAny) {
  const unwrapped = unwrapSchema(schema) as z.ZodTypeAny & {
    _def?: { values?: string[] | Record<string, string> };
  };
  const values = unwrapped._def?.values;
  if (Array.isArray(values)) {
    return values.map((value) => ({
      label: humanize(String(value)),
      value: String(value),
    }));
  }

  if (values && typeof values === "object") {
    return Object.values(values).map((value) => ({
      label: humanize(String(value)),
      value: String(value),
    }));
  }

  return [];
}

function getGeneratedDetailModelMetaByName(
  modelName?: string | null,
): GeneratedDetailModelMeta | null {
  if (!modelName) return null;

  for (const candidate of buildGeneratedDetailModelNameCandidates(modelName)) {
    const meta = generatedDetailModelMeta[candidate];
    if (meta) {
      return meta;
    }
  }

  return null;
}

function resolveGeneratedDetailModelMeta(resourceKey: string) {
  const rawKey = stripApiPrefix(resourceKey);
  const normalizedKey = normalizeKey(resourceKey);
  const candidates = uniqueStrings([
    getCanonicalDetailModelNameByEndpoint(rawKey),
    getCanonicalDetailModelNameByEndpoint(normalizedKey),
    toPascalCase(rawKey),
    toPascalCase(singularize(rawKey)),
    toPascalCase(normalizedKey),
    toPascalCase(singularize(normalizedKey)),
  ]);

  for (const candidate of candidates) {
    const modelMeta = getGeneratedDetailModelMetaByName(candidate);
    if (modelMeta) {
      return modelMeta;
    }
  }

  return null;
}

function inferRelationFieldForForeignKey(
  fieldName: string,
  modelMeta?: GeneratedDetailModelMeta | null,
) {
  if (!modelMeta) return null;

  const foreignKeyBase = stripForeignKeySuffix(fieldName);
  const normalizedForeignKey = normalizeIdentifier(foreignKeyBase);
  const foreignTokens = tokenizeIdentifier(foreignKeyBase);

  const relationCandidates = Object.values(modelMeta.fields)
    .filter((field) => field.isRelation && !field.isArray && field.relatedModel)
    .map((field) => {
      const normalizedRelationKey = normalizeIdentifier(field.key);
      const relationTokens = tokenizeIdentifier(field.key);
      const relatedModelTokens = tokenizeIdentifier(
        stripGeneratedDetailModelSuffix(field.relatedModel ?? ""),
      );

      let score = 0;
      if (normalizedRelationKey === normalizedForeignKey) score += 10;
      if (
        foreignTokens.length > 0 &&
        foreignTokens.every((token) => relationTokens.includes(token))
      ) {
        score += 6;
      }
      if (
        foreignTokens.length > 0 &&
        foreignTokens.every((token) => relatedModelTokens.includes(token))
      ) {
        score += 5;
      }

      score += relationTokens.filter((token) => foreignTokens.includes(token)).length;
      score += relatedModelTokens.filter((token) => foreignTokens.includes(token)).length;

      return {
        field,
        score,
      };
    })
    .filter((entry) => entry.score >= 4)
    .sort((left, right) => right.score - left.score);

  return relationCandidates[0]?.field ?? null;
}

function inferRelationFieldForRelationArray(
  fieldName: string,
  modelMeta?: GeneratedDetailModelMeta | null,
) {
  if (!modelMeta) return null;

  const relationBase = stripForeignKeyArraySuffix(fieldName);
  const normalizedRelationBase = normalizeIdentifier(relationBase);
  const relationTokens = tokenizeIdentifier(relationBase);

  const relationCandidates = Object.values(modelMeta.fields)
    .filter((field) => field.isRelation && field.isArray && field.relatedModel)
    .map((field) => {
      const normalizedRelationKey = normalizeIdentifier(field.key);
      const fieldTokens = tokenizeIdentifier(field.key);
      const relatedModelTokens = tokenizeIdentifier(
        stripGeneratedDetailModelSuffix(field.relatedModel ?? ""),
      );

      let score = 0;
      if (normalizedRelationKey === normalizedRelationBase) score += 10;
      if (
        relationTokens.length > 0 &&
        relationTokens.every((token) => fieldTokens.includes(token))
      ) {
        score += 6;
      }
      if (
        relationTokens.length > 0 &&
        relationTokens.every((token) => relatedModelTokens.includes(token))
      ) {
        score += 4;
      }

      score += fieldTokens.filter((token) => relationTokens.includes(token)).length;
      score += relatedModelTokens.filter((token) => relationTokens.includes(token)).length;

      return {
        field,
        score,
      };
    })
    .filter((entry) => entry.score >= 4)
    .sort((left, right) => right.score - left.score);

  return relationCandidates[0]?.field ?? null;
}

function isSensitiveAutoRelation(
  fieldName: string,
  relationField: GeneratedDetailFieldMeta,
) {
  const relatedModel = stripGeneratedDetailModelSuffix(relationField.relatedModel ?? "");
  if (AUTO_EXCLUDED_RELATION_MODELS.has(relatedModel)) {
    return true;
  }

  const candidates = [fieldName, relationField.key, relatedModel];
  return candidates.some((candidate) =>
    AUTO_EXCLUDED_RELATION_KEYS.some((pattern) => pattern.test(candidate)),
  );
}

function isScalarIdArraySchema(schema: z.ZodTypeAny) {
  const unwrapped = unwrapSchema(schema);
  const typeName = typeNameOf(unwrapped);
  if (typeName !== "ZodArray") {
    return false;
  }

  const inner = unwrapSchema(
    (
      unwrapped as z.ZodTypeAny & {
        _def?: { type?: z.ZodTypeAny; innerType?: z.ZodTypeAny };
      }
    )._def?.type ??
      (
        unwrapped as z.ZodTypeAny & {
          _def?: { type?: z.ZodTypeAny; innerType?: z.ZodTypeAny };
        }
      )._def?.innerType ??
      unwrapped,
  );

  const innerTypeName = typeNameOf(inner);
  return innerTypeName === "ZodString" || innerTypeName === "ZodNumber";
}

function pickRelationDisplayFields(relatedModelMeta?: GeneratedDetailModelMeta | null) {
  if (!relatedModelMeta) {
    return ["nom", "name", "label", "code"];
  }

  const preferredCandidates = uniqueStrings([
    ...relatedModelMeta.titleFields,
    ...relatedModelMeta.summaryFields,
    ...relatedModelMeta.spotlightFields,
    "nom",
    "name",
    "label",
    "code",
    "titre",
    "libelle",
  ]);

  const resolvedFields = preferredCandidates.filter((fieldName) => {
    const fieldMeta = relatedModelMeta.fields[fieldName];
    return fieldMeta && !fieldMeta.isRelation && !fieldMeta.isTechnical;
  });

  return resolvedFields.length > 0 ? resolvedFields.slice(0, 3) : ["id"];
}

function createRelationOptionLabelGetter(displayFields: string[]) {
  return (row: Record<string, unknown>) => {
    const label = displayFields
      .map((fieldName) => row[fieldName])
      .filter(
        (value): value is string | number =>
          (typeof value === "string" && value.trim().length > 0) ||
          typeof value === "number",
      )
      .map((value) => String(value).trim())
      .join(" - ");

    return label || String(row.id ?? "");
  };
}

function buildRelationField(
  fieldName: string,
  relationField: GeneratedDetailFieldMeta,
  options?: {
    multiple?: boolean;
  },
): FormField<Record<string, unknown>> | null {
  const relatedModelName = relationField.relatedModel;
  const endpoint = getCanonicalDetailEndpointByModelName(relatedModelName);
  if (!relatedModelName || !endpoint || isSensitiveAutoRelation(fieldName, relationField)) {
    return null;
  }

  const relatedModelMeta = getGeneratedDetailModelMetaByName(relatedModelName);
  const displayFields = pickRelationDisplayFields(relatedModelMeta);

  return {
    name: fieldName,
    label: humanize(
      options?.multiple ? stripForeignKeyArraySuffix(fieldName) : stripForeignKeySuffix(fieldName),
    ),
    type: options?.multiple ? "multi-select" : "relation-select",
    relation: {
      modelName: endpoint,
      labelField: displayFields[0] ?? "id",
      valueField: "id",
      endpoint: `/api/${endpoint}`,
      getOptionLabel: createRelationOptionLabelGetter(displayFields),
      getOptionValue: (row) => {
        const value = row.id;
        return typeof value === "string" || typeof value === "number" ? value : "";
      },
    },
  };
}

function inferFieldType(
  fieldName: string,
  schema: z.ZodTypeAny,
): FormField<any>["type"] {
  const unwrapped = unwrapSchema(schema);
  const typeName = typeNameOf(unwrapped);

  if (typeName === "ZodString") {
    if (fieldName.toLowerCase().includes("email")) return "email";
    if (fieldName.toLowerCase().includes("telephone")) return "phone";
    if (fieldName.toLowerCase().includes("password")) return "password";
    if (fieldName.endsWith("_json")) return "textarea";
    return "text";
  }

  if (typeName === "ZodNumber" || typeName === "ZodBigInt") return "number";
  if (typeName === "ZodBoolean") return "boolean";
  if (typeName === "ZodDate") {
    return /_at$/i.test(fieldName) ? "datetime" : "date";
  }
  if (typeName === "ZodEnum" || typeName === "ZodNativeEnum") return "enum";

  return "text";
}

function buildGeneratedFormFields(
  schema: z.ZodObject<z.ZodRawShape>,
  modelMeta?: GeneratedDetailModelMeta | null,
): FormField<any>[] {
  const shape = schema.shape as Record<string, z.ZodTypeAny>;

  return Object.entries(shape)
    .map(([fieldName, fieldSchema]) => {
      if (SYSTEM_FIELDS.has(fieldName)) {
        return null;
      }

      const detailFieldMeta = modelMeta?.fields[fieldName];
      if (detailFieldMeta?.isRelation) {
        return null;
      }

      const relationField = /(_id|Id)$/.test(fieldName)
        ? inferRelationFieldForForeignKey(fieldName, modelMeta)
        : null;
      if (relationField) {
        return buildRelationField(fieldName, relationField);
      }

      const relationArrayField =
        /(_ids|Ids)$/.test(fieldName) && isScalarIdArraySchema(fieldSchema)
          ? inferRelationFieldForRelationArray(fieldName, modelMeta)
          : null;
      if (relationArrayField) {
        return buildRelationField(fieldName, relationArrayField, {
          multiple: true,
        });
      }

      if (detailFieldMeta?.isTechnical) {
        return null;
      }

      const fieldType = inferFieldType(fieldName, fieldSchema);

      return {
        name: fieldName,
        label: humanize(fieldName),
        type: fieldType,
        options: fieldType === "enum" ? getEnumOptions(fieldSchema) : undefined,
      };
    })
    .filter(
      (
        field,
      ): field is FormField<any> => Boolean(field),
    );
}

function resolveGeneratedSchema(resourceKey: string) {
  const rawKey = stripApiPrefix(resourceKey);
  const normalizedKey = normalizeKey(resourceKey);
  const candidates = [
    `${toPascalCase(rawKey)}Schema`,
    `${toPascalCase(singularize(rawKey))}Schema`,
    `${toPascalCase(normalizedKey)}Schema`,
    `${toPascalCase(singularize(normalizedKey))}Schema`,
  ];

  for (const candidate of candidates) {
    const maybeSchema = (GeneratedZod as Record<string, unknown>)[candidate];
    if (maybeSchema instanceof z.ZodObject) {
      return maybeSchema as z.ZodObject<z.ZodRawShape>;
    }
  }

  return null;
}

function buildGeneratedModelConfig(resourceKey: string) {
  const rawKey = stripApiPrefix(resourceKey);
  const normalizedKey = normalizeKey(resourceKey);
  const cachedConfig = generatedConfigCache.get(normalizedKey);
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }

  const schema = resolveGeneratedSchema(rawKey);
  if (!schema) {
    generatedConfigCache.set(normalizedKey, null);
    return null;
  }

  const modelMeta = resolveGeneratedDetailModelMeta(rawKey);

  const generatedConfig: ModelConfig<any> = {
    modelName: rawKey,
    label: humanize(singularize(rawKey)).toLowerCase(),
    idField: "id",
    api: {
      list: `/api/${rawKey}`,
      detail: `/api/${rawKey}/:id`,
      update: `/api/${rawKey}/:id`,
      updateMethod: "patch",
    },
    table: {
      columns: [],
    },
    detail: {
      hiddenKeys: Array.from(SYSTEM_FIELDS),
      fields: Object.keys(schema.shape).map((fieldName) => ({
        key: fieldName,
        label: humanize(fieldName),
        type: modelMeta?.fields[fieldName]?.isRelation
          ? "relation"
          : modelMeta?.fields[fieldName]?.kind === "json"
            ? "json"
            : modelMeta?.fields[fieldName]?.kind === "boolean"
              ? "boolean"
              : modelMeta?.fields[fieldName]?.kind === "date"
                ? "date"
                : "text",
      })),
    },
    form: {
      schema,
      successMessage: "L'element a ete modifie avec succes.",
      fields: buildGeneratedFormFields(schema, modelMeta),
    },
    permissions: {
      canView: true,
      canEdit: true,
    },
  };

  generatedConfigCache.set(normalizedKey, generatedConfig);
  return generatedConfig;
}

export function registerModelConfig<T extends object>(
  key: string,
  modelConfig: ModelConfig<T>,
) {
  registry.set(
    normalizeKey(key),
    modelConfig as unknown as ModelConfig<any>,
  );
}

export function getRegisteredModelConfig(key: string) {
  const normalizedKey = normalizeKey(key);
  return registry.get(normalizedKey) ?? buildGeneratedModelConfig(normalizedKey);
}

registerModelConfig("eleve", eleveModelConfig);
registerModelConfig("evaluation", evaluationModelConfig);
