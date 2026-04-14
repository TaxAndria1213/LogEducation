import {
  generatedDetailFieldMetaIndex,
  generatedDetailModelMeta,
  type GeneratedDetailFieldMeta,
  type GeneratedDetailModelMeta,
} from "./detail-meta.generated";
import {
  getCanonicalDetailEndpointByModelName,
  getCanonicalDetailModelNameByEndpoint,
} from "./detail-endpoint-registry";
import type { DetailFieldGroup, DetailViewRecord } from "./types";

export const GENERATED_DETAIL_MODEL_HINT_KEY = "__generatedDetailModel";
const GENERATED_DETAIL_MODEL_SUFFIX_PATTERN = /(WithRelations|Row)$/;

export type GeneratedDetailOwnerResolutionCandidate = {
  relationKey: string;
  relatedModel: string;
  foreignKey: string;
  foreignValue: string | number;
  inverseRelationKeys: string[];
  endpoint: string;
  score: number;
};

function isPlainObject(value: unknown): value is DetailViewRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSnakeCase(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function tokenizeGeneratedDetailIdentifier(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split("_")
    .filter(Boolean);
}

function stripGeneratedDetailModelSuffix(modelName: string) {
  return modelName.replace(GENERATED_DETAIL_MODEL_SUFFIX_PATTERN, "");
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

function generatedDetailModelNamesMatch(left?: string | null, right?: string | null) {
  if (!left || !right) return false;

  const leftCandidates = buildGeneratedDetailModelNameCandidates(left);
  const rightCandidates = new Set(buildGeneratedDetailModelNameCandidates(right));
  return leftCandidates.some((candidate) => rightCandidates.has(candidate));
}

function getGeneratedDetailModelMetaByName(
  modelName?: string | null,
): GeneratedDetailModelMeta | null {
  if (!modelName) return null;
  return generatedDetailModelMeta[modelName] ?? null;
}

function getGeneratedDetailModelMetaByEndpoint(
  endpoint?: string | null,
): GeneratedDetailModelMeta | null {
  if (!endpoint) return null;
  const modelName = getCanonicalDetailModelNameByEndpoint(endpoint);
  return getGeneratedDetailModelMetaByName(modelName);
}

function getExplicitGeneratedDetailModelMeta(
  record: DetailViewRecord,
): GeneratedDetailModelMeta | null {
  const explicitModelName = record[GENERATED_DETAIL_MODEL_HINT_KEY];
  return typeof explicitModelName === "string"
    ? getGeneratedDetailModelMetaByName(explicitModelName)
    : null;
}

function getGeneratedDetailRelationModelMeta(
  parentRecord?: DetailViewRecord | null,
  relationKey?: string | null,
): GeneratedDetailModelMeta | null {
  if (!parentRecord || !relationKey) return null;

  const parentMeta = inferGeneratedDetailModelMeta(parentRecord);
  const relatedModelName = parentMeta?.fields[relationKey]?.relatedModel ?? null;
  return getGeneratedDetailModelMetaByName(relatedModelName);
}

function defineGeneratedDetailModelHint(
  record: DetailViewRecord,
  modelName: string,
) {
  const currentHint = record[GENERATED_DETAIL_MODEL_HINT_KEY];
  if (currentHint === modelName) return record;

  try {
    Object.defineProperty(record, GENERATED_DETAIL_MODEL_HINT_KEY, {
      value: modelName,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  } catch {
    record[GENERATED_DETAIL_MODEL_HINT_KEY] = modelName;
  }

  return record;
}

export function enrichGeneratedDetailModelHints(
  record: DetailViewRecord,
  options?: {
    modelName?: string | null;
    endpoint?: string | null;
    parentRecord?: DetailViewRecord | null;
    relationKey?: string | null;
    maxDepth?: number;
  },
): DetailViewRecord {
  const maxDepth = Math.max(0, options?.maxDepth ?? 2);
  const modelMeta =
    getGeneratedDetailModelMetaByName(options?.modelName) ??
    getGeneratedDetailModelMetaByEndpoint(options?.endpoint) ??
    getGeneratedDetailRelationModelMeta(options?.parentRecord, options?.relationKey) ??
    inferGeneratedDetailModelMeta(record);

  if (!modelMeta) {
    return record;
  }

  defineGeneratedDetailModelHint(record, modelMeta.name);

  if (maxDepth <= 0) {
    return record;
  }

  for (const field of Object.values(modelMeta.fields)) {
    if (!field.isRelation || !field.relatedModel) continue;

    const relationValue = record[field.key];
    if (isPlainObject(relationValue)) {
      enrichGeneratedDetailModelHints(relationValue, {
        modelName: field.relatedModel,
        parentRecord: record,
        relationKey: field.key,
        maxDepth: maxDepth - 1,
      });
      continue;
    }

    if (!Array.isArray(relationValue)) continue;
    relationValue.forEach((entry) => {
      if (!isPlainObject(entry)) return;
      enrichGeneratedDetailModelHints(entry, {
        modelName: field.relatedModel,
        parentRecord: record,
        relationKey: field.key,
        maxDepth: maxDepth - 1,
      });
    });
  }

  return record;
}

function scoreModel(record: DetailViewRecord, modelMeta: GeneratedDetailModelMeta) {
  const keys = Object.keys(record);
  if (keys.length === 0) return 0;

  let score = 0;

  for (const key of keys) {
    const fieldMeta = modelMeta.fields[key];
    if (!fieldMeta) continue;

    score += 2;

    const value = record[key];
    if (fieldMeta.isRelation && (Array.isArray(value) || isPlainObject(value))) {
      score += 1;
    } else if (!fieldMeta.isRelation && !Array.isArray(value)) {
      score += 1;
    }
  }

  const titleFieldMatch = modelMeta.titleFields.some((field) => {
    const value = record[field];
    return typeof value === "string" && value.trim().length > 0;
  });

  if (titleFieldMatch) {
    score += 2;
  }

  return score;
}

export function inferGeneratedDetailModelMeta(
  record: DetailViewRecord,
): GeneratedDetailModelMeta | null {
  const keys = Object.keys(record);
  const explicitModelMeta = getExplicitGeneratedDetailModelMeta(record);
  if (explicitModelMeta) return explicitModelMeta;
  if (keys.length === 0) return null;

  let bestMatch: GeneratedDetailModelMeta | null = null;
  let bestScore = 0;

  for (const modelMeta of Object.values(generatedDetailModelMeta)) {
    const score = scoreModel(record, modelMeta);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = modelMeta;
    }
  }

  const minimumScore = Math.max(4, Math.min(keys.length * 2, 8));
  return bestScore >= minimumScore ? bestMatch : null;
}

export function getGeneratedDetailFieldMeta(
  record: DetailViewRecord,
  key: string,
  modelMeta?: GeneratedDetailModelMeta | null,
): (GeneratedDetailFieldMeta & { models?: string[] }) | null {
  if (modelMeta?.fields[key]) {
    return modelMeta.fields[key];
  }

  return generatedDetailFieldMetaIndex[key] ?? null;
}

export function getGeneratedDetailFieldGroups(
  modelMeta?: GeneratedDetailModelMeta | null,
): DetailFieldGroup[] {
  if (!modelMeta) return [];
  return modelMeta.groups.map((group) => ({
    key: group.key,
    title: group.title,
    description: group.description,
    fields: group.fields,
  }));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getGeneratedDetailInverseRelationKeys(
  ownerModelName: string,
  targetModelName: string,
) {
  const ownerMeta = getGeneratedDetailModelMetaByName(ownerModelName);
  if (!ownerMeta) return [];

  return uniqueStrings(
    Object.values(ownerMeta.fields)
      .filter(
        (field) =>
          field.isRelation &&
          generatedDetailModelNamesMatch(field.relatedModel, targetModelName),
      )
      .map((field) => field.key),
  );
}

function inferGeneratedDetailRelationForeignKeys(
  modelMeta: GeneratedDetailModelMeta,
  relationKey: string,
  relatedModel: string,
) {
  const relationTokens = tokenizeGeneratedDetailIdentifier(relationKey);
  const relatedModelTokens = tokenizeGeneratedDetailIdentifier(
    stripGeneratedDetailModelSuffix(relatedModel),
  );

  const scoredKeys = Object.values(modelMeta.fields)
    .filter((field) => field.isTechnical)
    .map((field) => {
      const normalizedFieldKey = toSnakeCase(field.key);
      if (
        !normalizedFieldKey.endsWith("_id") &&
        field.key !== "id" &&
        !field.key.endsWith("Id")
      ) {
        return null;
      }

      const fieldBase = normalizedFieldKey.replace(/_id$/, "");
      const fieldTokens = tokenizeGeneratedDetailIdentifier(fieldBase);
      if (fieldTokens.length === 0) return null;

      const relationOverlap = relationTokens.filter((token) =>
        fieldTokens.includes(token),
      ).length;
      const modelOverlap = relatedModelTokens.filter((token) =>
        fieldTokens.includes(token),
      ).length;

      let score = 0;
      if (fieldBase === toSnakeCase(relationKey)) score += 8;
      if (
        relationTokens.length > 0 &&
        relationTokens.every((token) => fieldTokens.includes(token))
      ) {
        score += 5;
      }
      if (
        fieldTokens.length > 0 &&
        fieldTokens.every((token) => relatedModelTokens.includes(token))
      ) {
        score += 4;
      }
      if (
        relatedModelTokens.length > 0 &&
        relatedModelTokens.every((token) => fieldTokens.includes(token))
      ) {
        score += 3;
      }

      score += relationOverlap + modelOverlap;

      if (score < 4) return null;

      return {
        key: field.key,
        score,
      };
    })
    .filter(
      (entry): entry is { key: string; score: number } => Boolean(entry),
    )
    .sort((left, right) => right.score - left.score);

  if (scoredKeys.length === 0) return [];

  const bestScore = scoredKeys[0]?.score ?? 0;
  const minimumAcceptedScore = Math.max(4, bestScore - 1);

  return scoredKeys
    .filter((entry) => entry.score >= minimumAcceptedScore)
    .map((entry) => entry.key);
}

export function getGeneratedDetailRelationFields(
  modelMeta?: GeneratedDetailModelMeta | null,
): string[] {
  if (!modelMeta) return [];

  return uniqueStrings(
    Object.values(modelMeta.fields)
      .filter((field) => field.isRelation)
      .map((field) => field.key),
  );
}

function collectGeneratedIncludePaths(
  modelMeta: GeneratedDetailModelMeta,
  maxDepth: number,
  prefix: string,
  lineage: Set<string>,
  paths: string[],
) {
  if (maxDepth <= 0) return;

  for (const field of Object.values(modelMeta.fields)) {
    if (!field.isRelation) continue;

    const nextPath = prefix ? `${prefix}.${field.key}` : field.key;
    paths.push(nextPath);

    if (maxDepth <= 1 || !field.relatedModel) {
      continue;
    }

    const relatedMeta = generatedDetailModelMeta[field.relatedModel];
    if (!relatedMeta || lineage.has(relatedMeta.name)) {
      continue;
    }

    const nextLineage = new Set(lineage);
    nextLineage.add(relatedMeta.name);

    collectGeneratedIncludePaths(
      relatedMeta,
      maxDepth - 1,
      nextPath,
      nextLineage,
      paths,
    );
  }
}

export function getGeneratedDetailIncludePaths(
  input: DetailViewRecord | GeneratedDetailModelMeta | null | undefined,
  options?: {
    maxDepth?: number;
    maxPaths?: number;
  },
): string[] {
  const modelMeta = isPlainObject(input)
    ? inferGeneratedDetailModelMeta(input)
    : input ?? null;

  if (!modelMeta) return [];

  const maxDepth = Math.max(1, options?.maxDepth ?? 1);
  const maxPaths = Math.max(1, options?.maxPaths ?? 40);
  const paths: string[] = [];
  const lineage = new Set<string>([modelMeta.name]);

  collectGeneratedIncludePaths(modelMeta, maxDepth, "", lineage, paths);

  return uniqueStrings(paths).slice(0, maxPaths);
}

export function getGeneratedDetailModelEndpoint(
  input: DetailViewRecord | GeneratedDetailModelMeta | null | undefined,
): string | null {
  const modelMeta = isPlainObject(input)
    ? inferGeneratedDetailModelMeta(input)
    : input ?? null;

  if (!modelMeta) return null;
  return getCanonicalDetailEndpointByModelName(modelMeta.name);
}

export function getGeneratedDetailOwnerResolutionCandidates(
  record: DetailViewRecord | null | undefined,
): GeneratedDetailOwnerResolutionCandidate[] {
  if (!record || !isPlainObject(record)) return [];

  const modelMeta = inferGeneratedDetailModelMeta(record);
  if (!modelMeta) return [];

  const candidates = Object.values(modelMeta.fields)
    .filter((field) => field.isRelation && field.relatedModel)
    .flatMap((field) => {
      const relatedModel = field.relatedModel as string;
      const endpoint = getCanonicalDetailEndpointByModelName(relatedModel);
      if (!endpoint) return [];

      const inverseRelationKeys = getGeneratedDetailInverseRelationKeys(
        relatedModel,
        modelMeta.name,
      );
      if (inverseRelationKeys.length === 0) return [];

      const foreignKeys = inferGeneratedDetailRelationForeignKeys(
        modelMeta,
        field.key,
        relatedModel,
      );

      return foreignKeys
        .map((foreignKey) => {
          const foreignValue = record[foreignKey];
          if (
            typeof foreignValue !== "string" &&
            typeof foreignValue !== "number"
          ) {
            return null;
          }

          return {
            relationKey: field.key,
            relatedModel,
            foreignKey,
            foreignValue,
            inverseRelationKeys,
            endpoint,
            score:
              inverseRelationKeys.length * 2 +
              tokenizeGeneratedDetailIdentifier(field.key).length +
              tokenizeGeneratedDetailIdentifier(foreignKey).length,
          };
        })
        .filter(
          (
            entry,
          ): entry is GeneratedDetailOwnerResolutionCandidate => Boolean(entry),
        );
    });

  return candidates
    .sort((left, right) => right.score - left.score)
    .filter(
      (candidate, index, allCandidates) =>
        allCandidates.findIndex(
          (entry) =>
            entry.relationKey === candidate.relationKey &&
            entry.foreignKey === candidate.foreignKey &&
            entry.endpoint === candidate.endpoint,
        ) === index,
    );
}
