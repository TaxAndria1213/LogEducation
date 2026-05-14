import type React from "react";
import type { ZodObject, ZodRawShape } from "zod";

export type FieldType =
  | "text"
  | "number"
  | "textarea"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "enum"
  | "relation-select"
  | "multi-select"
  | "email"
  | "phone"
  | "password"
  | "hidden"
  | "readOnly";

export type ModelOptionValue = string | number | boolean;

export type FormField<T> = {
  name: keyof T & string;
  label: string;
  type: FieldType;
  required?: boolean;
  editable?: boolean;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  options?: Array<{ label: string; value: ModelOptionValue }>;
  relation?: {
    modelName: string;
    labelField: string;
    valueField: string;
    endpoint: string;
    initialQuery?: Record<string, unknown>;
    getOptionLabel?: (row: Record<string, unknown>) => string;
    getOptionValue?: (row: Record<string, unknown>) => string | number;
    onSearchBuildWhere?: (text: string) => Record<string, unknown>;
  };
  validate?: (value: unknown, values: Partial<T>) => string | null;
  transformBeforeSubmit?: (value: unknown, values: Partial<T>) => unknown;
};

export type DetailField<T> = {
  key: keyof T & string;
  label: string;
  type?: "text" | "date" | "boolean" | "relation" | "json";
};

export type ModelPermissionContext<T> = {
  row?: T;
  user?: unknown;
};

export type ModelPermission<T> =
  | boolean
  | ((context: ModelPermissionContext<T>) => boolean);

export type ModelConfig<T> = {
  modelName: string;
  label: string;
  idField: keyof T & string;
  api: {
    list: string;
    detail: string;
    update: string;
    updateMethod?: "patch" | "put";
    create?: string;
    delete?: string;
  };
  table: {
    columns: Array<{
      key: string;
      header: React.ReactNode;
      accessor?: keyof T | string;
      render?: (row: T) => React.ReactNode;
      sortable?: boolean;
      sortKey?: string;
    }>;
  };
  detail: {
    title?: (row: T) => string;
    fields?: DetailField<T>[];
    hiddenKeys?: string[];
  };
  form: {
    schema: ZodObject<ZodRawShape>;
    fields: FormField<T>[];
    successMessage?: string;
  };
  permissions?: {
    canView?: ModelPermission<T>;
    canEdit?: ModelPermission<T>;
    canDelete?: ModelPermission<T>;
  };
};
