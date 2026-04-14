import {
  generatedDetailModelEndpointMap,
  generatedDetailModelMeta,
} from "./detail-meta.generated";

const DETAIL_ENDPOINT_OVERRIDES: Record<string, string> = {};

function normalizeEndpoint(endpoint: string) {
  return endpoint.replace(/^\/+|\/+$/g, "").toLowerCase();
}

function stripGeneratedModelSuffix(modelName: string) {
  return modelName.replace(/(WithRelations|Row)$/, "");
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildModelNameCandidates(modelName: string) {
  const baseModelName = stripGeneratedModelSuffix(modelName);
  return uniqueStrings([
    modelName,
    baseModelName,
    `${baseModelName}WithRelations`,
    `${baseModelName}Row`,
  ]);
}

const canonicalModelEndpointEntries = Object.entries({
  ...generatedDetailModelEndpointMap,
  ...DETAIL_ENDPOINT_OVERRIDES,
});

export const canonicalDetailModelEndpointMap = canonicalModelEndpointEntries.reduce<
  Record<string, string>
>((accumulator, [modelName, endpoint]) => {
  for (const candidate of buildModelNameCandidates(modelName)) {
    accumulator[candidate] = endpoint;
  }

  return accumulator;
}, {});

export const canonicalDetailEndpointModelMap = canonicalModelEndpointEntries.reduce<
  Record<string, string>
>((accumulator, [modelName, endpoint]) => {
  const normalizedEndpoint = normalizeEndpoint(endpoint);

  if (!accumulator[normalizedEndpoint]) {
    accumulator[normalizedEndpoint] =
      generatedDetailModelMeta[modelName]?.name ?? stripGeneratedModelSuffix(modelName);
  }

  return accumulator;
}, {});

export function getCanonicalDetailEndpointByModelName(
  modelName?: string | null,
) {
  if (!modelName) return null;

  const candidates = buildModelNameCandidates(modelName);
  for (const candidate of candidates) {
    const endpoint = canonicalDetailModelEndpointMap[candidate];
    if (endpoint) {
      return endpoint;
    }
  }

  return null;
}

export function getCanonicalDetailModelNameByEndpoint(
  endpoint?: string | null,
) {
  if (!endpoint) return null;
  return canonicalDetailEndpointModelMap[normalizeEndpoint(endpoint)] ?? null;
}

