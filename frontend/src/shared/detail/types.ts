import type React from "react";

export type DetailViewRecord = Record<string, unknown>;
export type DetailRenderMode = "balanced" | "exhaustive";

export type DetailFieldFormatterContext = {
  key: string;
  label: string;
  value: unknown;
  record: DetailViewRecord;
  defaultDisplay: string;
};

export type DetailFieldFormatter = (
  context: DetailFieldFormatterContext,
) => React.ReactNode;

export type DetailFieldGroup = {
  key?: string;
  title: string;
  description?: string;
  fields: string[];
};
