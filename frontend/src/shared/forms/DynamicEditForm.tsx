import { useMemo } from "react";
import { z } from "zod";
import { Http } from "../../app/api/Http";
import { Form } from "../../components/Form/Form";
import { getFieldsFromZodObjectSchema } from "../../components/Form/fields";
import { useInfo } from "../../hooks/useInfo";
import {
  createRelationService,
  resolveModelApiPath,
} from "../model-config/runtime";
import type { FormField, ModelConfig } from "../model-config/types";

type DynamicEditFormProps<T extends object> = {
  modelConfig: ModelConfig<T>;
  record: T;
  onSuccess?: (updated: T) => void;
  onCancel?: () => void;
};

function buildSchemaMeta(field: FormField<any>) {
  const sharedProps = {
    placeholder: field.placeholder,
    description: field.description,
    disabled: field.disabled || field.type === "readOnly" || field.editable === false,
  };

  if (field.type === "textarea") {
    return {
      widget: "textarea" as const,
      fieldProps: sharedProps,
    };
  }

  if (field.type === "password") {
    return {
      widget: "password" as const,
      fieldProps: sharedProps,
    };
  }

  if (field.type === "enum" || field.type === "select") {
    return {
      widget: "select" as const,
      fieldProps: {
        ...sharedProps,
        options: field.options ?? [],
      },
    };
  }

  if (
    (field.type === "relation-select" || field.type === "multi-select") &&
    field.relation
  ) {
    const defaultGetOptionLabel = (row: Record<string, unknown>) => {
      const value = row[field.relation?.labelField ?? "label"];
      return typeof value === "string" && value.trim()
        ? value.trim()
        : String(row[field.relation?.valueField ?? "id"] ?? "");
    };

    const defaultGetOptionValue = (row: Record<string, unknown>) => {
      const value = row[field.relation?.valueField ?? "id"];
      return typeof value === "number" || typeof value === "string"
        ? value
        : "";
    };

    return {
      relation: {
        multiple: field.type === "multi-select",
        service: createRelationService(field.relation.endpoint),
        initialQuery: field.relation.initialQuery,
        onSearchBuildWhere: field.relation.onSearchBuildWhere,
        getOptionLabel:
          field.relation.getOptionLabel ?? defaultGetOptionLabel,
        getOptionValue:
          field.relation.getOptionValue ?? defaultGetOptionValue,
      },
      fieldProps: sharedProps,
    };
  }

  if (field.type === "date") {
    return {
      dateMode: "date" as const,
      fieldProps: sharedProps,
    };
  }

  if (field.type === "datetime") {
    return {
      dateMode: "datetime" as const,
      fieldProps: sharedProps,
    };
  }

  return {
    fieldProps: sharedProps,
  };
}

export default function DynamicEditForm<T extends object>({
  modelConfig,
  record,
  onSuccess,
  onCancel,
}: DynamicEditFormProps<T>) {
  const { info } = useInfo();

  const schema = modelConfig.form.schema;

  const configuredFields = useMemo(
    () =>
      modelConfig.form.fields.filter((field) => field.type !== "hidden"),
    [modelConfig.form.fields],
  );

  const fieldsByName = useMemo(
    () =>
      new Map<string, FormField<any>>(
        modelConfig.form.fields.map((field) => [
          field.name,
          field,
        ]),
      ),
    [modelConfig.form.fields],
  );

  const dynamicFields = useMemo(() => {
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    const allowedFields = new Set<string>(configuredFields.map((field) => field.name));
    const omit = Object.keys(shape).filter((key) => !allowedFields.has(key));

    const generatedFields = getFieldsFromZodObjectSchema(
      schema as z.ZodObject<z.ZodRawShape>,
      {
        omit,
        labelByField: Object.fromEntries(
          configuredFields.map((field) => [field.name, field.label]),
        ),
        metaByField: Object.fromEntries(
          configuredFields.map((field) => [field.name, buildSchemaMeta(field)]),
        ),
      },
    );

    return generatedFields.map((generatedField) => {
      const configuredField = fieldsByName.get(generatedField.name);
      return {
        ...generatedField,
        props: {
          ...(generatedField.props ?? {}),
          disabled:
            generatedField.props?.disabled ||
            configuredField?.disabled ||
            configuredField?.editable === false ||
            configuredField?.type === "readOnly",
        },
      };
    });
  }, [configuredFields, fieldsByName, schema]);

  const initialValues = useMemo(
    () => {
      const sourceRecord = record as Record<string, unknown>;
      return Object.fromEntries(
        modelConfig.form.fields.map((field) => [field.name, sourceRecord[field.name]]),
      ) as Partial<z.infer<typeof schema>>;
    },
    [modelConfig.form.fields, record, schema],
  );

  const handleSubmit = async (values: Partial<T>) => {
    const sourceValues = values as Record<string, unknown>;
    const payload = Object.fromEntries(
      modelConfig.form.fields
        .filter(
          (field) =>
            field.type !== "hidden" &&
            field.type !== "readOnly" &&
            field.editable !== false,
        )
        .map((field) => {
          const rawValue = sourceValues[field.name];
          const finalValue = field.transformBeforeSubmit
            ? field.transformBeforeSubmit(rawValue, values)
            : rawValue;

          return [field.name, finalValue];
        }),
    );

    const endpoint = resolveModelApiPath(modelConfig, modelConfig.api.update, record);
    const result =
      modelConfig.api.updateMethod === "put"
        ? await Http.put(endpoint, payload)
        : await Http.patch(endpoint, payload);

    info(
      result?.status?.message ??
        modelConfig.form.successMessage ??
        "Modification enregistree avec succes.",
      "success",
    );
    onSuccess?.(result.data as T);
  };

  return (
    <Form
      schema={schema}
      fields={dynamicFields}
      labelMessage={modelConfig.label}
      initialValues={initialValues}
      dataOnly={handleSubmit}
      submitLabel="Enregistrer"
      submitAlign="end"
      cancelLabel="Annuler"
      onCancel={onCancel}
    />
  );
}
