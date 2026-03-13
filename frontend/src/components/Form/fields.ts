/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { z } from "zod";

// Tes composants
import {
  TextField,
  PasswordField,
  TextAreaField,
  EmailField,
  UrlField,
  IntField,
  FloatField,
  DecimalField,
  BigIntField,
  BooleanField,
  DateField,
  DateTimeField,
  EnumSelectField,
  JsonField,
  BytesField,
  StringArrayField,
  NumberArrayField,
  EnumArrayField,
  RelationSelectField,
  RelationMultiSelectField,
} from "./fields/index";

export type DynamicField = {
  name: string;
  label?: string;
  Component: React.ComponentType<any>;
  props?: Record<string, any>;
  required?: boolean;
  nullable?: boolean;
};

type UnwrapInfo = {
  schema: z.ZodTypeAny;
  required: boolean;
  nullable: boolean;
  hadDefault: boolean;
};

type TypeName =
  | "ZodString"
  | "ZodNumber"
  | "ZodBoolean"
  | "ZodDate"
  | "ZodEnum"
  | "ZodNativeEnum"
  | "ZodArray"
  | "ZodObject"
  | "ZodRecord"
  | "ZodAny"
  | "ZodUnknown"
  | "ZodOptional"
  | "ZodNullable"
  | "ZodDefault"
  | "ZodEffects"
  | "ZodPipeline"
  | "ZodUnion"
  | "ZodDiscriminatedUnion"
  | "ZodIntersection"
  | "ZodBigInt"
  | string;

function typeNameOf(s: z.ZodTypeAny): TypeName {
  const anyS: any = s;

  // 1) Ancien / certains builds
  const tn = anyS?._def?.typeName;
  if (typeof tn === "string" && tn.length) return tn;

  // 2) Zod v4 : traits (Set)
  const traits: any = anyS?._zod?.traits;
  if (traits && typeof traits.has === "function") {
    // On préfère le nom sans "$"
    for (const pref of ["ZodLazy", "ZodOptional", "ZodNullable", "ZodDefault", "ZodEffects", "ZodPipeline"]) {
      if (traits.has(pref)) return pref;
    }
    // Sinon, premier trait "ZodXxx"
    for (const t of traits) {
      if (typeof t === "string" && t.startsWith("Zod")) return t;
    }
    // Sinon, on enlève le "$" si besoin
    for (const t of traits) {
      if (typeof t === "string" && t.startsWith("$Zod")) return t.slice(1);
    }
  }

  // 3) Zod v4 : def.type (ex: "lazy", "string", "number"...)
  const type = anyS?._def?.type;
  if (typeof type === "string" && type.length) {
    // normalise: "lazy" -> "ZodLazy"
    return `Zod${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  }

  return "Unknown";
}


// function innerTypeOf(s: z.ZodTypeAny): z.ZodTypeAny | null {
//   // ZodOptional / ZodNullable / ZodDefault / ZodArray / etc ont souvent innerType ou type
//   const def: any = (s as any)._def;
//   return def?.innerType ?? def?.type ?? def?.schema ?? def?.in ?? null;
// }

/**
 * unwrap compatible zod v4:
 * - optional/nullable/default
 * - effects/pipeline (coerce/transform/preprocess/pipe)
 */
function unwrapZodSchema(input: z.ZodTypeAny): UnwrapInfo {
  // let input: z.ZodTypeAny = input;
  let required = true;
  let nullable = false;
  let hadDefault = false;

  while (true) {
    const tn = typeNameOf(input);

    if (tn === "ZodOptional") {
      required = false;
      input = ((input as any)._def?.innerType ?? (input as any)._def?.type) as z.ZodTypeAny;
      continue;
    }

    if (tn === "ZodNullable") {
      nullable = true;
      required = false; // <-- ici
      input = ((input as any)._def?.innerType ?? (input as any)._def?.type) as z.ZodTypeAny;
      continue;
    }

    if (tn === "ZodDefault") {
      hadDefault = true;
      required = false;
      input = ((input as any)._def?.innerType ?? (input as any)._def?.type) as z.ZodTypeAny;
      continue;
    }

    // ZodEffects : coerce/transform/preprocess
    if (tn === "ZodEffects") {
      // v4: souvent _def.schema
      const next = (input as any)._def?.schema as z.ZodTypeAny | undefined;
      if (next) {
        input = next;
        continue;
      }
      break;
    }

    // ZodPipeline : z.string().pipe(z.coerce.date()) etc.
    if (tn === "ZodPipeline") {
      // v4: _def.in / _def.out selon versions
      const out = (input as any)._def?.out as z.ZodTypeAny | undefined;
      const inn = (input as any)._def?.in as z.ZodTypeAny | undefined;
      input = out ?? inn ?? input;
      continue;
    }



    break;
  }

  return { schema: input, required, nullable, hadDefault };
}

function getStringChecks(s: z.ZodTypeAny): Set<string> {
  const checks = new Set<string>();
  const def: any = (s as any)._def;
  const arr = def?.checks;
  if (Array.isArray(arr)) {
    for (const c of arr) if (c?.kind) checks.add(String(c.kind));
  }
  return checks;
}

function hasNumberIntCheck(s: z.ZodTypeAny): boolean {
  const def: any = (s as any)._def;
  const checks = def?.checks;
  if (!Array.isArray(checks)) return false;
  return checks.some((c: any) => c?.kind === "int");
}

function pickDateComponent(fieldName: string): React.ComponentType<any> {
  if (/_at$/i.test(fieldName)) return DateTimeField;
  if (/^date_/i.test(fieldName) || /_date$/i.test(fieldName)) return DateField;
  return DateTimeField;
}

export function resolveFieldComponent(
  fieldName: string,
  fieldSchema: z.ZodTypeAny,
  meta?: {
    widget?: "password" | "textarea" | "text" | "json" | "bytes";
    relation?: { multiple?: boolean; options?: Array<{ value: string; label: string }> };
    enumLabels?: Record<string, string>;
    dateMode?: "date" | "datetime";
    decimalMode?: "decimal";
    bigintMode?: "bigint";
  }
): Omit<DynamicField, "name"> {
  const { schema: s, required, nullable } = unwrapZodSchema(fieldSchema);
  const tn = typeNameOf(s);

  // overrides
  if (meta?.widget === "password") return { Component: PasswordField, required, nullable };
  if (meta?.widget === "textarea") return { Component: TextAreaField, required, nullable };
  if (meta?.widget === "json") return { Component: JsonField, required, nullable };
  if (meta?.widget === "bytes") return { Component: BytesField, required, nullable };

  if (meta?.relation) {
    const multiple = Boolean(meta.relation.multiple);
    return {
      Component: multiple ? RelationMultiSelectField : RelationSelectField,
      required,
      nullable,
      props: { options: meta.relation.options ?? [] },
    };
  }

  // primitives
  if (tn === "ZodString") {
    const checks = getStringChecks(s);

    if (checks.has("email")) return { Component: EmailField, required, nullable };
    if (checks.has("url")) return { Component: UrlField, required, nullable };

    if (meta?.decimalMode === "decimal") return { Component: DecimalField, required, nullable };
    if (meta?.bigintMode === "bigint") return { Component: BigIntField, required, nullable };

    return { Component: TextField, required, nullable };
  }

  if (tn === "ZodNumber") {
    const isInt = hasNumberIntCheck(s);
    return { Component: isInt ? IntField : FloatField, required, nullable };
  }

  if (tn === "ZodBoolean") {
    return { Component: BooleanField, required, nullable };
  }

  if (tn === "ZodDate") {
    if (meta?.dateMode === "date") return { Component: DateField, required, nullable };
    if (meta?.dateMode === "datetime") return { Component: DateTimeField, required, nullable };
    return { Component: pickDateComponent(fieldName), required, nullable };
  }

  if (tn === "ZodEnum") {
    const values = ((s as any)._def?.values ?? []) as string[];
    return {
      Component: EnumSelectField,
      required,
      nullable,
      props: { values, labels: meta?.enumLabels },
    };
  }

  // Zod v4 nativeEnum existe mais parfois typeName différent selon build.
  // On supporte les deux: "ZodNativeEnum" et "ZodEnum" fallback.
  if (tn === "ZodNativeEnum") {
    const enumObj = (s as any)._def?.values ?? {};
    const values = Object.values(enumObj).filter((v) => typeof v === "string") as string[];
    return {
      Component: EnumSelectField,
      required,
      nullable,
      props: { values, labels: meta?.enumLabels },
    };
  }

  if (tn === "ZodArray") {
    const inner = unwrapZodSchema(((s as any)._def?.type ?? (s as any)._def?.innerType) as z.ZodTypeAny).schema;
    const itn = typeNameOf(inner);

    if (itn === "ZodString") return { Component: StringArrayField, required, nullable };
    if (itn === "ZodNumber") return { Component: NumberArrayField, required, nullable };

    if (itn === "ZodEnum") {
      const values = ((inner as any)._def?.values ?? []) as string[];
      const options = values.map((v) => ({ value: v, label: meta?.enumLabels?.[v] ?? v }));
      return { Component: EnumArrayField, required, nullable, props: { options } };
    }

    if (itn === "ZodNativeEnum") {
      const enumObj = (inner as any)._def?.values ?? {};
      const values = Object.values(enumObj).filter((v) => typeof v === "string") as string[];
      const options = values.map((v) => ({ value: v, label: meta?.enumLabels?.[v] ?? v }));
      return { Component: EnumArrayField, required, nullable, props: { options } };
    }

    return { Component: JsonField, required, nullable };
  }

  // BigInt natif (si utilisé)
  if (tn === "ZodBigInt") {
    return { Component: BigIntField, required, nullable };
  }

  // objects/records/unknown/any/etc => Json
  if (
    tn === "ZodObject" ||
    tn === "ZodRecord" ||
    tn === "ZodAny" ||
    tn === "ZodUnknown" ||
    tn === "ZodUnion" ||
    tn === "ZodDiscriminatedUnion" ||
    tn === "ZodIntersection"
  ) {
    return { Component: JsonField, required, nullable };
  }

  return { Component: TextField, required, nullable };
}

export function getFieldsFromZodObjectSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  opts?: {
    omit?: string[];
    metaByField?: Record<string, Parameters<typeof resolveFieldComponent>[2]>;
    labelByField?: Record<string, string>;
  }
): DynamicField[] {
  const shape = schema.shape;
  const omit = new Set(opts?.omit ?? []);

  return Object.keys(shape)
    .filter((k) => !omit.has(k))
    .map((name) => {
      const zodField = (shape as any)[name] as z.ZodTypeAny;
      const meta = opts?.metaByField?.[name];
      const resolved = resolveFieldComponent(name, zodField, meta);

      return {
        name,
        label: opts?.labelByField?.[name] ?? humanize(name),
        Component: resolved.Component,
        props: resolved.props,
        required: resolved.required,
        nullable: resolved.nullable,
      };
    });
}

function humanize(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}