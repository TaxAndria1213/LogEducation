/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { z } from "zod";
import Service from "../../app/api/Service";
import type { TableQuery } from "../../shared/table/types";
import {
  BigIntField,
  BooleanField,
  BytesField,
  DateField,
  DateTimeField,
  DecimalField,
  EmailField,
  EnumArrayField,
  EnumSelectField,
  FloatField,
  IntField,
  JsonField,
  NumberArrayField,
  PasswordField,
  RelationMultiSelectField,
  RelationSelectField,
  StringArrayField,
  TextAreaField,
  TextField,
  TimeField,
  UrlField,
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

type FieldMeta = {
  widget?: "password" | "textarea" | "text" | "json" | "bytes";
  relation?: {
    multiple?: boolean;
    options?: Array<{ value: string | number; label: string; disabled?: boolean }>;
    service?: Service;
    initialQuery?: TableQuery;
    onSearchBuildWhere?: (text: string) => Record<string, unknown>;
    mapOption?: (row: Record<string, unknown>) => {
      value: string | number;
      label: string;
      disabled?: boolean;
    };
    getOptionLabel?: (row: Record<string, unknown>) => string;
    getOptionValue?: (row: Record<string, unknown>) => string | number;
    emptyLabel?: string;
    searchPlaceholder?: string;
    noResultsLabel?: string;
    loadingLabel?: string;
  };
  enumLabels?: Record<string, string>;
  dateMode?: "date" | "datetime" | "time";
  decimalMode?: "decimal";
  bigintMode?: "bigint";
  fieldProps?: Record<string, any>;
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
  const tn = anyS?._def?.typeName;
  if (typeof tn === "string" && tn.length) return tn;

  const traits: any = anyS?._zod?.traits;
  if (traits && typeof traits.has === "function") {
    for (const pref of [
      "ZodLazy",
      "ZodOptional",
      "ZodNullable",
      "ZodDefault",
      "ZodEffects",
      "ZodPipeline",
    ]) {
      if (traits.has(pref)) return pref;
    }
    for (const t of traits) {
      if (typeof t === "string" && t.startsWith("Zod")) return t;
    }
    for (const t of traits) {
      if (typeof t === "string" && t.startsWith("$Zod")) return t.slice(1);
    }
  }

  const type = anyS?._def?.type;
  if (typeof type === "string" && type.length) {
    return `Zod${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  }

  return "Unknown";
}

function unwrapZodSchema(input: z.ZodTypeAny): UnwrapInfo {
  let required = true;
  let nullable = false;
  let hadDefault = false;

  while (true) {
    const tn = typeNameOf(input);

    if (tn === "ZodOptional") {
      required = false;
      input = ((input as any)._def?.innerType ??
        (input as any)._def?.type) as z.ZodTypeAny;
      continue;
    }

    if (tn === "ZodNullable") {
      nullable = true;
      required = false;
      input = ((input as any)._def?.innerType ??
        (input as any)._def?.type) as z.ZodTypeAny;
      continue;
    }

    if (tn === "ZodDefault") {
      hadDefault = true;
      required = false;
      input = ((input as any)._def?.innerType ??
        (input as any)._def?.type) as z.ZodTypeAny;
      continue;
    }

    if (tn === "ZodEffects") {
      const next = (input as any)._def?.schema as z.ZodTypeAny | undefined;
      if (next) {
        input = next;
        continue;
      }
      break;
    }

    if (tn === "ZodPipeline") {
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
  meta?: FieldMeta,
): Omit<DynamicField, "name"> {
  const { schema: s, required, nullable } = unwrapZodSchema(fieldSchema);
  const tn = typeNameOf(s);
  const extraProps = meta?.fieldProps ?? {};

  if (meta?.widget === "password") {
    return { Component: PasswordField, required, nullable, props: extraProps };
  }
  if (meta?.widget === "textarea") {
    return { Component: TextAreaField, required, nullable, props: extraProps };
  }
  if (meta?.widget === "json") {
    return { Component: JsonField, required, nullable, props: extraProps };
  }
  if (meta?.widget === "bytes") {
    return { Component: BytesField, required, nullable, props: extraProps };
  }

  if (meta?.relation) {
    const multiple = Boolean(meta.relation.multiple);
    return {
      Component: multiple ? RelationMultiSelectField : RelationSelectField,
      required,
      nullable,
      props: {
        options: meta.relation.options ?? [],
        service: meta.relation.service,
        initialQuery: meta.relation.initialQuery,
        onSearchBuildWhere: meta.relation.onSearchBuildWhere,
        mapOption: meta.relation.mapOption,
        getOptionLabel: meta.relation.getOptionLabel,
        getOptionValue: meta.relation.getOptionValue,
        emptyLabel: meta.relation.emptyLabel,
        searchPlaceholder: meta.relation.searchPlaceholder,
        noResultsLabel: meta.relation.noResultsLabel,
        loadingLabel: meta.relation.loadingLabel,
        ...extraProps,
      },
    };
  }

  if (tn === "ZodString") {
    const checks = getStringChecks(s);

    if (checks.has("email")) {
      return { Component: EmailField, required, nullable, props: extraProps };
    }
    if (checks.has("url")) {
      return { Component: UrlField, required, nullable, props: extraProps };
    }
    if (meta?.dateMode === "time") {
      return { Component: TimeField, required, nullable, props: extraProps };
    }
    if (meta?.decimalMode === "decimal") {
      return { Component: DecimalField, required, nullable, props: extraProps };
    }
    if (meta?.bigintMode === "bigint") {
      return { Component: BigIntField, required, nullable, props: extraProps };
    }

    return { Component: TextField, required, nullable, props: extraProps };
  }

  if (tn === "ZodNumber") {
    return {
      Component: hasNumberIntCheck(s) ? IntField : FloatField,
      required,
      nullable,
      props: extraProps,
    };
  }

  if (tn === "ZodBoolean") {
    return { Component: BooleanField, required, nullable, props: extraProps };
  }

  if (tn === "ZodDate") {
    if (meta?.dateMode === "date") {
      return { Component: DateField, required, nullable, props: extraProps };
    }
    if (meta?.dateMode === "datetime") {
      return { Component: DateTimeField, required, nullable, props: extraProps };
    }
    if (meta?.dateMode === "time") {
      return { Component: TimeField, required, nullable, props: extraProps };
    }
    return {
      Component: pickDateComponent(fieldName),
      required,
      nullable,
      props: extraProps,
    };
  }

  if (tn === "ZodEnum") {
    const values = ((s as any)._def?.values ?? []) as string[];
    return {
      Component: EnumSelectField,
      required,
      nullable,
      props: { values, labels: meta?.enumLabels, ...extraProps },
    };
  }

  if (tn === "ZodNativeEnum") {
    const enumObj = (s as any)._def?.values ?? {};
    const values = Object.values(enumObj).filter((v) => typeof v === "string") as string[];
    return {
      Component: EnumSelectField,
      required,
      nullable,
      props: { values, labels: meta?.enumLabels, ...extraProps },
    };
  }

  if (tn === "ZodArray") {
    const inner = unwrapZodSchema(
      ((s as any)._def?.type ?? (s as any)._def?.innerType) as z.ZodTypeAny,
    ).schema;
    const itn = typeNameOf(inner);

    if (itn === "ZodString") {
      return { Component: StringArrayField, required, nullable, props: extraProps };
    }
    if (itn === "ZodNumber") {
      return { Component: NumberArrayField, required, nullable, props: extraProps };
    }

    if (itn === "ZodEnum" || itn === "ZodNativeEnum") {
      const enumObj = (inner as any)._def?.values ?? [];
      const values = Array.isArray(enumObj)
        ? enumObj
        : Object.values(enumObj).filter((v) => typeof v === "string");
      const options = values.map((v) => ({
        value: v,
        label: meta?.enumLabels?.[v as string] ?? String(v),
      }));
      return {
        Component: EnumArrayField,
        required,
        nullable,
        props: { options, ...extraProps },
      };
    }

    return { Component: JsonField, required, nullable, props: extraProps };
  }

  if (tn === "ZodBigInt") {
    return { Component: BigIntField, required, nullable, props: extraProps };
  }

  if (
    tn === "ZodObject" ||
    tn === "ZodRecord" ||
    tn === "ZodAny" ||
    tn === "ZodUnknown" ||
    tn === "ZodUnion" ||
    tn === "ZodDiscriminatedUnion" ||
    tn === "ZodIntersection"
  ) {
    return { Component: JsonField, required, nullable, props: extraProps };
  }

  return { Component: TextField, required, nullable, props: extraProps };
}

export function getFieldsFromZodObjectSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  opts?: {
    omit?: string[];
    metaByField?: Record<string, FieldMeta>;
    labelByField?: Record<string, string>;
  },
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
