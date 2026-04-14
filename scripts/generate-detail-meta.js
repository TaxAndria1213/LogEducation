/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, "frontend", "src", "types", "models.ts");
const outputPath = path.join(
  projectRoot,
  "frontend",
  "src",
  "shared",
  "detail",
  "detail-meta.generated.ts",
);
const servicesPath = path.join(projectRoot, "frontend", "src", "services");
const routesPath = path.join(projectRoot, "src", "app", "api", "routes.ts");

const TITLE_FIELD_PRIORITY = [
  "nom_complet",
  "nom",
  "prenom",
  "libelle",
  "titre",
  "code",
  "reference",
  "numero",
  "numero_facture",
  "type",
];

const SUMMARY_FIELD_PRIORITY = [
  "statut",
  "etat",
  "finance_status",
  "access_status",
  "montant",
  "solde",
  "total_montant",
  "date",
  "date_effet",
  "date_debut",
  "date_fin",
];

const SPOTLIGHT_FIELD_PRIORITY = [
  "code",
  "reference",
  "numero",
  "numero_facture",
  "montant",
  "solde",
  "total_montant",
  "date_effet",
  "date_debut",
  "date_fin",
  "type",
];

function toSnakeCase(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function normalizeKey(value) {
  return toSnakeCase(value).toLowerCase();
}

function stripOuterParentheses(value) {
  let result = value.trim();
  while (result.startsWith("(") && result.endsWith(")")) {
    result = result.slice(1, -1).trim();
  }
  return result;
}

function splitTopLevel(value, separator) {
  const parts = [];
  let current = "";
  let depthAngle = 0;
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === "<") depthAngle += 1;
    if (character === ">") depthAngle = Math.max(0, depthAngle - 1);
    if (character === "(") depthParen += 1;
    if (character === ")") depthParen = Math.max(0, depthParen - 1);
    if (character === "{") depthBrace += 1;
    if (character === "}") depthBrace = Math.max(0, depthBrace - 1);
    if (character === "[") depthBracket += 1;
    if (character === "]") depthBracket = Math.max(0, depthBracket - 1);

    if (
      character === separator &&
      depthAngle === 0 &&
      depthParen === 0 &&
      depthBrace === 0 &&
      depthBracket === 0
    ) {
      parts.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  if (current) {
    parts.push(current);
  }

  return parts.map((part) => part.trim()).filter(Boolean);
}

function extractGenericBase(value) {
  const match = value.match(/^(?:Pick|Partial|Required|Readonly|Omit)\<([^,>]+)/);
  return match?.[1]?.trim() ?? null;
}

function extractNamedTypeReference(typeText) {
  const sanitized = stripOuterParentheses(typeText.replace(/\s+/g, ""));
  if (!sanitized) return null;

  const genericBase = extractGenericBase(sanitized);
  if (genericBase) {
    return extractNamedTypeReference(genericBase);
  }

  if (sanitized.startsWith("Array<") && sanitized.endsWith(">")) {
    return extractNamedTypeReference(sanitized.slice(6, -1));
  }

  const unionParts = splitTopLevel(sanitized, "|").filter(
    (part) => !["null", "undefined"].includes(part),
  );
  if (unionParts.length > 1) {
    for (const part of unionParts) {
      const candidate = extractNamedTypeReference(part);
      if (candidate) return candidate;
    }
  }

  const intersectionParts = splitTopLevel(sanitized, "&");
  if (intersectionParts.length > 1) {
    for (const part of intersectionParts) {
      const candidate = extractNamedTypeReference(part);
      if (candidate) return candidate;
    }
  }

  const leadingNamedReferenceMatch = sanitized.match(/^\(?([A-Z][A-Za-z0-9_]*)/);
  const leadingNamedReference = leadingNamedReferenceMatch?.[1] ?? null;
  if (
    leadingNamedReference &&
    ![
      "Date",
      "Decimal",
      "JsonValue",
      "Record",
      "Array",
      "Pick",
      "Partial",
      "Required",
      "Readonly",
      "Omit",
    ].includes(leadingNamedReference)
  ) {
    return leadingNamedReference;
  }

  const base = sanitized.replace(/\[\]/g, "");
  const match = base.match(/^[A-Z][A-Za-z0-9_]*/);
  if (!match) return null;

  const candidate = match[0];
  if (["Date", "Decimal", "JsonValue", "Record", "Array"].includes(candidate)) {
    return null;
  }

  return candidate;
}

function extractRelatedModel(typeText, relationModelNames) {
  const candidate = extractNamedTypeReference(typeText);
  if (!candidate) return null;
  return relationModelNames.has(candidate) ? candidate : null;
}

function extractScalarAlias(typeText, scalarAliasNames) {
  const candidate = extractNamedTypeReference(typeText);
  if (!candidate) return null;
  return scalarAliasNames.has(candidate) ? candidate : null;
}

function isStatusAlias(aliasName) {
  return /^(Statut|Status|Etat)/.test(aliasName);
}

function isStringLiteralUnionType(typeText) {
  const sanitized = stripOuterParentheses(typeText.replace(/\s+/g, ""));
  if (!sanitized) return false;

  const unionParts = splitTopLevel(sanitized, "|").filter(
    (part) => !["null", "undefined"].includes(part),
  );
  if (unionParts.length === 0) return false;

  return unionParts.every(
    (part) =>
      /^"[^"]*"$/.test(part) || /^'[^']*'$/.test(part),
  );
}

function inferFieldKind(key, typeText, relationModelNames, scalarAliasNames) {
  const normalized = normalizeKey(key);
  const compactType = typeText.replace(/\s+/g, "");
  const unionParts = splitTopLevel(stripOuterParentheses(compactType), "|").filter(
    (part) => !["null", "undefined"].includes(part),
  );

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
    ].includes(normalized) ||
    normalized.endsWith("_id")
  ) {
    return "technical";
  }

  if (normalized.endsWith("_json") || compactType.includes("JsonValue")) {
    return "json";
  }

  if (normalized.includes("email")) return "email";
  if (normalized.includes("telephone") || normalized.includes("phone")) return "phone";
  if (normalized.includes("photo_url")) return "image_url";
  if (normalized.includes("document_url")) return "document_url";
  if (normalized === "chemin" || normalized.includes("path")) return "file_path";
  if (normalized.includes("url")) return "url";

  if (extractRelatedModel(compactType, relationModelNames)) {
    return "relation";
  }

  if (compactType.includes("{")) {
    return "unknown";
  }

  if (compactType.includes("Date")) return "date";
  if (compactType.includes("Decimal")) return "money";
  if (compactType === "boolean" || compactType === "boolean|null") return "boolean";

  if (isStringLiteralUnionType(compactType)) {
    if (
      normalized.includes("status") ||
      normalized.includes("statut") ||
      normalized.includes("etat")
    ) {
      return "status";
    }
    return "enum";
  }

  const scalarAlias = extractScalarAlias(compactType, scalarAliasNames);
  if (scalarAlias) {
    if (
      normalized.includes("status") ||
      normalized.includes("statut") ||
      normalized.includes("etat") ||
      isStatusAlias(scalarAlias)
    ) {
      return "status";
    }

    return "enum";
  }

  if (
    normalized.includes("status") ||
    normalized.includes("statut") ||
    normalized.includes("etat") ||
    compactType.startsWith("Statut")
  ) {
    return "status";
  }

  if (compactType === "number" || compactType === "number|null") {
    if (
      normalized.includes("montant") ||
      normalized.includes("solde") ||
      normalized.includes("prix") ||
      normalized.includes("tarif") ||
      normalized.includes("cout") ||
      normalized.includes("total")
    ) {
      return "money";
    }
    return "number";
  }

  if (
    unionParts.length > 1 &&
    unionParts.every((part) => ["string", "number"].includes(part))
  ) {
    if (
      normalized.includes("montant") ||
      normalized.includes("solde") ||
      normalized.includes("prix") ||
      normalized.includes("tarif") ||
      normalized.includes("cout") ||
      normalized.includes("total")
    ) {
      return "money";
    }

    return unionParts.includes("number") ? "number" : "text";
  }

  if (compactType === "string" || compactType === "string|null") {
    return "text";
  }

  return "unknown";
}

function inferFieldGroup(key, kind) {
  const normalized = normalizeKey(key);

  if (kind === "technical") return "technical";
  if (kind === "status") return "status";
  if (kind === "money") return "financial";
  if (kind === "date") return "dates";
  if (kind === "json") return "structured";
  if (["email", "phone"].includes(kind)) return "contact";
  if (["url", "document_url", "image_url", "file_path"].includes(kind)) return "media";
  if (kind === "relation") return "relations";

  if (
    normalized.includes("adresse") ||
    normalized.includes("contact") ||
    normalized.includes("urgence")
  ) {
    return "contact";
  }

  if (
    normalized.includes("description") ||
    normalized.includes("motif") ||
    normalized.includes("raison") ||
    normalized.includes("note")
  ) {
    return "context";
  }

  if (
    normalized.includes("type") ||
    normalized.includes("mode") ||
    normalized.includes("scope") ||
    normalized.includes("fournisseur")
  ) {
    return "classification";
  }

  return "general";
}

function buildGroupTitle(groupKey) {
  const titles = {
    general: "Informations principales",
    status: "Statuts et decisions",
    financial: "Montants et droits",
    dates: "Dates et validite",
    contact: "Contacts et coordination",
    media: "Fichiers et liens",
    structured: "Donnees structurees",
    relations: "Relations",
    classification: "Types et categories",
    context: "Contexte et commentaires",
    technical: "Informations techniques",
  };

  return titles[groupKey] ?? "Informations";
}

function buildGroupDescription(groupKey) {
  const descriptions = {
    general: "Lecture rapide des donnees principales de l'entite.",
    status: "Etat courant, decisions et synchronisation metier.",
    financial: "Montants, soldes, tarifs et valeurs chiffrees.",
    dates: "Repere temporel du dossier et de sa validite.",
    contact: "Coordonnees et informations de communication.",
    media: "Ressources externes, fichiers et liens utiles.",
    structured: "Blocs JSON et configurations structurees.",
    relations: "Relations vers les autres entites du systeme.",
    classification: "Types, modes et dimensions de classement.",
    context: "Notes, motifs, descriptions et contexte fonctionnel.",
    technical: "Clefs internes et donnees systeme.",
  };

  return descriptions[groupKey] ?? "Informations detaillees.";
}

function unique(values) {
  return Array.from(new Set(values));
}

function normalizeAlias(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function kebabCase(value) {
  return toSnakeCase(value).replace(/_/g, "-");
}

function buildModelAliases(modelName) {
  const camel = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const baseAliases = unique([
    modelName,
    camel,
    toSnakeCase(modelName),
    kebabCase(modelName),
    modelName.replace(/(WithRelations|Row)$/, ""),
  ]).map(normalizeAlias);

  return unique(
    baseAliases.flatMap((alias) => [
      alias,
      alias.endsWith("s") ? alias.slice(0, -1) : `${alias}s`,
      alias.endsWith("e") ? alias.slice(0, -1) : `${alias}e`,
    ]),
  );
}

function selectExistingFields(priorityList, fields) {
  const fieldNames = fields.map((field) => field.key);
  return priorityList.filter((key) => fieldNames.includes(key));
}

function buildFieldMeta(
  name,
  typeText,
  isOptional,
  relationModelNames,
  scalarAliasNames,
) {
  const kind = inferFieldKind(name, typeText, relationModelNames, scalarAliasNames);
  const relatedModel =
    kind === "relation"
      ? extractRelatedModel(typeText, relationModelNames)
      : null;

  return {
    key: name,
    typeText,
    kind,
    group: inferFieldGroup(name, kind),
    isOptional,
    isArray: typeText.includes("[]") || typeText.replace(/\s+/g, "").startsWith("Array<"),
    isRelation: kind === "relation",
    isTechnical: kind === "technical",
    relatedModel,
  };
}

function parsePropertyMembers(
  members,
  sourceFile,
  relationModelNames,
  scalarAliasNames,
) {
  return members
    .filter(ts.isPropertySignature)
    .map((member) => {
      const name = member.name.getText(sourceFile).replace(/['"]/g, "");
      const typeText = member.type ? member.type.getText(sourceFile) : "unknown";
      return buildFieldMeta(
        name,
        typeText,
        Boolean(member.questionToken),
        relationModelNames,
        scalarAliasNames,
      );
    });
}

function buildModelMeta(name, fields) {
  const titleFields = selectExistingFields(TITLE_FIELD_PRIORITY, fields);
  const summaryFields = unique([
    ...selectExistingFields(SUMMARY_FIELD_PRIORITY, fields),
    ...fields
      .filter((field) => ["status", "money", "date"].includes(field.kind))
      .map((field) => field.key)
      .slice(0, 4),
  ]).slice(0, 6);
  const spotlightFields = unique([
    ...selectExistingFields(SPOTLIGHT_FIELD_PRIORITY, fields),
    ...fields
      .filter((field) => ["money", "date", "status"].includes(field.kind))
      .map((field) => field.key),
  ]).slice(0, 6);
  const statusFields = fields
    .filter((field) => field.kind === "status")
    .map((field) => field.key)
    .slice(0, 6);

  const groups = unique(fields.map((field) => field.group))
    .filter((groupKey) => groupKey !== "relations" && groupKey !== "technical")
    .map((groupKey) => ({
      key: groupKey,
      title: buildGroupTitle(groupKey),
      description: buildGroupDescription(groupKey),
      fields: fields
        .filter((field) => field.group === groupKey && !field.isRelation && !field.isTechnical)
        .map((field) => field.key),
    }))
    .filter((group) => group.fields.length > 0);

  return {
    name,
    titleFields,
    summaryFields,
    spotlightFields,
    statusFields,
    groups,
    fields: Object.fromEntries(fields.map((field) => [field.key, field])),
  };
}

function mergeFields(fieldGroups) {
  const fieldMap = {};

  for (const fields of fieldGroups) {
    for (const field of fields) {
      fieldMap[field.key] = field;
    }
  }

  return Object.values(fieldMap);
}

function collectFieldsFromTypeNode(
  typeNode,
  sourceFile,
  knownModels,
  relationModelNames,
  scalarAliasNames,
) {
  if (!typeNode) return [];

  if (ts.isTypeLiteralNode(typeNode)) {
    return parsePropertyMembers(
      typeNode.members,
      sourceFile,
      relationModelNames,
      scalarAliasNames,
    );
  }

  if (ts.isParenthesizedTypeNode(typeNode)) {
    return collectFieldsFromTypeNode(
      typeNode.type,
      sourceFile,
      knownModels,
      relationModelNames,
      scalarAliasNames,
    );
  }

  if (ts.isIntersectionTypeNode(typeNode)) {
    return mergeFields(
      typeNode.types.map((innerType) =>
        collectFieldsFromTypeNode(
          innerType,
          sourceFile,
          knownModels,
          relationModelNames,
          scalarAliasNames,
        ),
      ),
    );
  }

  if (ts.isUnionTypeNode(typeNode)) {
    return mergeFields(
      typeNode.types
        .filter(
          (innerType) =>
            innerType.kind !== ts.SyntaxKind.NullKeyword &&
            innerType.kind !== ts.SyntaxKind.UndefinedKeyword,
        )
        .map((innerType) =>
          collectFieldsFromTypeNode(
            innerType,
            sourceFile,
            knownModels,
            relationModelNames,
            scalarAliasNames,
          ),
        ),
    );
  }

  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName.getText(sourceFile);
    if (
      ["Pick", "Partial", "Required", "Readonly", "Omit"].includes(typeName) &&
      Array.isArray(typeNode.typeArguments) &&
      typeNode.typeArguments[0]
    ) {
      return collectFieldsFromTypeNode(
        typeNode.typeArguments[0],
        sourceFile,
        knownModels,
        relationModelNames,
        scalarAliasNames,
      );
    }

    if (knownModels[typeName]) {
      return Object.values(knownModels[typeName].fields);
    }
  }

  return [];
}

function parseBaseModels() {
  const sourceText = fs.readFileSync(sourcePath, "utf8");
  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const relationModelNames = new Set();
  const scalarAliasNames = new Set();
  const models = [];

  sourceFile.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node)) {
      relationModelNames.add(node.name.text);
      return;
    }

    if (ts.isTypeAliasDeclaration(node)) {
      scalarAliasNames.add(node.name.text);
    }
  });

  sourceFile.forEachChild((node) => {
    if (!ts.isInterfaceDeclaration(node)) return;
    const fields = parsePropertyMembers(
      node.members,
      sourceFile,
      relationModelNames,
      scalarAliasNames,
    );
    models.push(buildModelMeta(node.name.text, fields));
  });

  return {
    models,
    relationModelNames,
    scalarAliasNames,
  };
}

function parseServiceTypeModels(
  baseModels,
  baseRelationModelNames,
  scalarAliasNames,
) {
  const models = [];
  const endpointMap = {};
  const knownModels = Object.fromEntries(baseModels.map((model) => [model.name, model]));
  const serviceTypeEntries = [];

  if (!fs.existsSync(servicesPath)) {
    return { models, endpointMap };
  }

  const serviceFiles = fs
    .readdirSync(servicesPath)
    .filter((fileName) => fileName.endsWith(".service.ts"));

  for (const fileName of serviceFiles) {
    const filePath = path.join(servicesPath, fileName);
    const content = fs.readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const endpoint = content.match(/super\(\s*["'`]([^"'`]+)["'`]\s*\)/)?.[1]?.trim() ?? null;

    sourceFile.forEachChild((node) => {
      if (!ts.isTypeAliasDeclaration(node)) return;

      const name = node.name.text;
      if (!/^[A-Z]/.test(name) || !/(WithRelations|Row)$/.test(name)) return;
      serviceTypeEntries.push({
        endpoint,
        name,
        node,
        sourceFile,
      });
    });
  }

  const relationModelNames = new Set([
    ...baseRelationModelNames,
    ...serviceTypeEntries.map((entry) => entry.name),
  ]);

  for (const entry of serviceTypeEntries) {
    const fields = collectFieldsFromTypeNode(
      entry.node.type,
      entry.sourceFile,
      knownModels,
      relationModelNames,
      scalarAliasNames,
    );
    if (fields.length === 0) continue;

    const modelMeta = buildModelMeta(entry.name, fields);
    models.push(modelMeta);
    knownModels[entry.name] = modelMeta;

    if (entry.endpoint) {
      endpointMap[entry.name] = entry.endpoint;
    }
  }

  return { models, endpointMap };
}

function buildFieldIndex(models) {
  const fieldIndex = {};

  for (const model of models) {
    for (const [key, field] of Object.entries(model.fields)) {
      if (!fieldIndex[key]) {
        fieldIndex[key] = {
          ...field,
          models: [model.name],
        };
        continue;
      }

      const current = fieldIndex[key];
      current.models = unique([...current.models, model.name]);

      const shouldOverrideKind =
        current.kind === "unknown" ||
        current.kind === "text" ||
        (current.kind === "number" && field.kind === "money");

      if (shouldOverrideKind) {
        current.kind = field.kind;
        current.group = field.group;
        current.typeText = field.typeText;
        current.isArray = field.isArray;
        current.isRelation = field.isRelation;
        current.isTechnical = field.isTechnical;
        current.relatedModel = field.relatedModel;
      }
    }
  }

  return fieldIndex;
}

function parseServiceEndpoints(models) {
  const endpointMap = {};

  if (!fs.existsSync(servicesPath)) {
    return endpointMap;
  }

  const modelAliasMap = new Map(
    models.map((model) => [
      model.name,
      unique([
        ...buildModelAliases(model.name),
        normalizeAlias(model.name.replace(/(Execution|Eleve|Cantine|Transport)$/g, "$1")),
      ]),
    ]),
  );

  const serviceFiles = fs
    .readdirSync(servicesPath)
    .filter((fileName) => fileName.endsWith(".service.ts"));

  for (const fileName of serviceFiles) {
    const filePath = path.join(servicesPath, fileName);
    const content = fs.readFileSync(filePath, "utf8");
    const endpointMatch = content.match(/super\(\s*["'`]([^"'`]+)["'`]\s*\)/);
    if (!endpointMatch) continue;

    const endpoint = endpointMatch[1].trim();
    const fileStem = fileName.replace(/\.service\.ts$/, "");
    const candidates = unique([
      normalizeAlias(fileStem),
      normalizeAlias(endpoint),
    ]);

    const matchedModels = models
      .filter((model) => {
        const aliases = modelAliasMap.get(model.name) ?? [];
        return candidates.some((candidate) => aliases.includes(candidate));
      })
      .map((model) => model.name);

    if (matchedModels.length === 1) {
      endpointMap[matchedModels[0]] = endpoint;
    }
  }

  return endpointMap;
}

function parseRouteEndpoints(models) {
  const endpointMap = {};

  if (!fs.existsSync(routesPath)) {
    return endpointMap;
  }

  const content = fs.readFileSync(routesPath, "utf8");
  const routePaths = unique(
    Array.from(content.matchAll(/this\.router\.use\("\/([^"]+)"/g)).map((match) =>
      match[1].trim(),
    ),
  );

  const normalizedRouteIndex = new Map(
    routePaths.map((routePath) => [normalizeAlias(routePath), routePath]),
  );

  for (const model of models) {
    const aliases = buildModelAliases(model.name);
    const matches = unique(
      aliases
        .map((alias) => normalizedRouteIndex.get(alias))
        .filter(Boolean),
    );

    if (matches.length === 1) {
      endpointMap[model.name] = matches[0];
    }
  }

  return endpointMap;
}

function printGeneratedFile(models, fieldIndex, endpointMap) {
  return `/* eslint-disable */
// This file is auto-generated by scripts/generate-detail-meta.js
// Do not edit manually.

export type GeneratedDetailFieldKind =
  | "technical"
  | "json"
  | "email"
  | "phone"
  | "image_url"
  | "document_url"
  | "file_path"
  | "url"
  | "date"
  | "money"
  | "boolean"
  | "enum"
  | "status"
  | "relation"
  | "number"
  | "text"
  | "unknown";

export type GeneratedDetailFieldMeta = {
  key: string;
  typeText: string;
  kind: GeneratedDetailFieldKind;
  group: string;
  isOptional: boolean;
  isArray: boolean;
  isRelation: boolean;
  isTechnical: boolean;
  relatedModel: string | null;
};

export type GeneratedDetailGroupMeta = {
  key: string;
  title: string;
  description: string;
  fields: string[];
};

export type GeneratedDetailModelMeta = {
  name: string;
  titleFields: string[];
  summaryFields: string[];
  spotlightFields: string[];
  statusFields: string[];
  groups: GeneratedDetailGroupMeta[];
  fields: Record<string, GeneratedDetailFieldMeta>;
};

export const generatedDetailModelMeta: Record<string, GeneratedDetailModelMeta> = ${JSON.stringify(
    Object.fromEntries(models.map((model) => [model.name, model])),
    null,
    2,
  )};

export const generatedDetailFieldMetaIndex: Record<
  string,
  GeneratedDetailFieldMeta & { models: string[] }
> = ${JSON.stringify(fieldIndex, null, 2)};

export const generatedDetailModelEndpointMap: Record<string, string> = ${JSON.stringify(
    endpointMap,
    null,
    2,
  )};
`;
}

function main() {
  const {
    models: baseModels,
    relationModelNames,
    scalarAliasNames,
  } = parseBaseModels();
  const { models: serviceModels, endpointMap: serviceTypeEndpointMap } =
    parseServiceTypeModels(baseModels, relationModelNames, scalarAliasNames);
  const models = [...baseModels, ...serviceModels];
  const fieldIndex = buildFieldIndex(models);
  const endpointMap = {
    ...parseRouteEndpoints(models),
    ...parseServiceEndpoints(models),
    ...serviceTypeEndpointMap,
  };
  const output = printGeneratedFile(models, fieldIndex, endpointMap);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, "utf8");
  console.log(`Generated detail metadata: ${path.relative(projectRoot, outputPath)}`);
}

main();
