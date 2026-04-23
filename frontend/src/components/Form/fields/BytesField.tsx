import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import { getFileInputClassName } from "./inputStyles";
import type { BaseFieldProps } from "./types";

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Pour Prisma Bytes : souvent on passe par base64 côté API.
 * Stocke une string base64.
 */
export function BytesField<TFieldValues extends FieldValues>(
  props: BaseFieldProps<TFieldValues>,
) {
  const id = String(props.name);

  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field, fieldState }) => (
        <FieldWrapper
          id={id}
          label={props.label}
          description={props.description ?? "Fichier (base64)"}
          required={props.required}
          error={fieldState.error?.message}
          className={props.className}
        >
          <input
            id={id}
            type="file"
            disabled={props.disabled}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return field.onChange(undefined);
              const b64 = await fileToBase64(file);
              field.onChange(b64);
            }}
            className={getFileInputClassName(Boolean(fieldState.error))}
          />
        </FieldWrapper>
      )}
    />
  );
}
