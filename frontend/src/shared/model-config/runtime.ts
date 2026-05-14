import Service from "../../app/api/Service";
import { getRegisteredModelConfig } from "./registry";
import type {
  ModelConfig,
  ModelPermission,
  ModelPermissionContext,
} from "./types";

export function resolveModelPermission<T>(
  permission: ModelPermission<T> | undefined,
  context: ModelPermissionContext<T>,
) {
  if (permission === undefined) {
    return true;
  }

  if (typeof permission === "function") {
    return permission(context);
  }

  return permission;
}

export function getModelFieldLabels<T>(modelConfig: ModelConfig<T>) {
  return Object.fromEntries(
    (modelConfig.detail.fields ?? []).map((field) => [field.key, field.label]),
  ) as Record<string, string>;
}

export function getEditableModelFields<T>(modelConfig: ModelConfig<T>) {
  return modelConfig.form.fields.filter(
    (field) => field.type !== "hidden" && field.editable !== false,
  );
}

export function createRelationService(endpoint: string) {
  return new Service(endpoint.replace(/^\/api\//, "").replace(/^\//, ""));
}

export function resolveModelApiPath<T>(
  modelConfig: ModelConfig<T>,
  endpoint: string,
  record: T,
) {
  const idValue = record[modelConfig.idField];
  return endpoint.replace(":id", String(idValue));
}

export function resolveModelConfigFromService<T extends object>(
  service?: Service | null,
) {
  if (!service?.url) return null;
  return getRegisteredModelConfig(service.url) as ModelConfig<T> | null;
}
