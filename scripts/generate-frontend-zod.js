const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const backendZodPath = path.join(repoRoot, "generated", "zod", "index.ts");
const frontendZodDir = path.join(repoRoot, "frontend", "src", "generated", "zod");
const frontendZodPath = path.join(frontendZodDir, "index.ts");

const ENUMS_MARKER = `/////////////////////////////////////////
// ENUMS
/////////////////////////////////////////`;

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier introuvable: ${filePath}`);
  }
}

function sanitizeDecimalSchemas(content) {
  return content.replace(
    /z\.instanceof\(Prisma\.Decimal(?:,\s*\{[^)]*\})?\)/g,
    "DecimalValueSchema",
  );
}

function extractFrontendSafeBody(source) {
  const enumsStart = source.indexOf(ENUMS_MARKER);
  if (enumsStart === -1) {
    throw new Error("Impossible de trouver la section ENUMS dans generated/zod/index.ts");
  }

  const body = source.slice(enumsStart);

  const enumSchemas = body.match(/^export const \w+Schema = z\.enum\([^\n]*\);\r?$/gm) ?? [];
  const modelSchemas =
    body.match(
      /^export const (\w+)Schema = z\.object\(\{[\s\S]*?^\}\)\r?\n\r?\nexport type \1 = z\.infer<typeof \1Schema>\r?$/gm,
    ) ?? [];

  if (enumSchemas.length === 0 || modelSchemas.length === 0) {
    throw new Error("Impossible d'extraire les enums et schemas metier frontend-safe.");
  }

  return [...enumSchemas, ...modelSchemas].join("\n\n").trim();
}

function buildFrontendPrelude() {
  return `import { z } from "zod";

// AUTO-GENERATED FILE.
// Source: generated/zod/index.ts
// This frontend-safe build intentionally strips Prisma-specific schemas and helpers.

/////////////////////////////////////////
// FRONTEND HELPER FUNCTIONS
/////////////////////////////////////////

type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(z.string(), z.lazy(() => JsonValueSchema.optional())),
    z.array(z.lazy(() => JsonValueSchema)),
  ]),
);

export type JsonValueType = z.infer<typeof JsonValueSchema>;

export const NullableJsonValue = JsonValueSchema.nullable();
export type NullableJsonValueType = z.infer<typeof NullableJsonValue>;

export const InputJsonValueSchema = JsonValueSchema;
export type InputJsonValueType = z.infer<typeof InputJsonValueSchema>;

export const DecimalJsLikeSchema = z.object({
  d: z.array(z.number()),
  e: z.number(),
  s: z.number(),
  toFixed: z.any(),
});

export const DecimalValueSchema = z.union([
  z.number(),
  z.string(),
  DecimalJsLikeSchema,
]);
`;
}

function main() {
  assertFileExists(backendZodPath);

  const source = fs.readFileSync(backendZodPath, "utf8");
  const frontendBody = extractFrontendSafeBody(source);
  const sanitizedBody = sanitizeDecimalSchemas(frontendBody);
  const output = `${buildFrontendPrelude()}\n\n${sanitizedBody}\n`;

  if (output.includes("@prisma/client") || output.includes("Prisma.")) {
    throw new Error("La sortie frontend contient encore des references Prisma.");
  }

  fs.mkdirSync(frontendZodDir, { recursive: true });
  fs.writeFileSync(frontendZodPath, output, "utf8");
  console.log(`Frontend-safe zod generated: ${path.relative(repoRoot, frontendZodPath)}`);
}

main();
