import {
  BackendModelConfigError,
  type BackendModelConfig,
} from "./types";

type UpdateWithConfigArgs<TRecord> = {
  config: BackendModelConfig;
  id: string;
  payload: Record<string, unknown>;
  user?: unknown;
  loadExisting: (id: string) => Promise<TRecord | null>;
  persistUpdate: (
    id: string,
    data: Record<string, unknown>,
  ) => Promise<TRecord>;
};

export async function updateWithConfig<TRecord extends Record<string, unknown>>({
  config,
  id,
  payload,
  user,
  loadExisting,
  persistUpdate,
}: UpdateWithConfigArgs<TRecord>) {
  const existing = await loadExisting(id);

  if (!existing) {
    throw new BackendModelConfigError("Element introuvable.", 404);
  }

  const payloadKeys = Object.keys(payload);
  if (payloadKeys.length === 0) {
    throw new BackendModelConfigError("Donnees invalides.", 400);
  }

  const protectedFields = new Set(config.protectedFields ?? []);

  const disallowedField = payloadKeys.find(
    (key) =>
      protectedFields.has(key) || !config.allowedUpdateFields.includes(key),
  );

  if (disallowedField) {
    throw new BackendModelConfigError("Ce champ ne peut pas etre modifie.", 400);
  }

  if (config.permissions?.canEdit) {
    const canEdit = await config.permissions.canEdit({
      user,
      existing,
      payload,
    });

    if (!canEdit) {
      throw new BackendModelConfigError(
        "Vous n'avez pas l'autorisation de modifier cet element.",
        403,
      );
    }
  }

  const filteredPayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) =>
      config.allowedUpdateFields.includes(key),
    ),
  );

  if (config.validationSchema) {
    const parsedPayload = config.validationSchema.safeParse(filteredPayload);
    if (!parsedPayload.success) {
      throw new BackendModelConfigError("Donnees invalides.", 400);
    }

    return persistUpdate(id, parsedPayload.data as Record<string, unknown>);
  }

  return persistUpdate(id, filteredPayload);
}
