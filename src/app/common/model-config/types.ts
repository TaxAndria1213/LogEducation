import type { ZodSchema } from "zod";

export class BackendModelConfigError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "BackendModelConfigError";
    this.statusCode = statusCode;
  }
}

export type BackendModelPermissionContext = {
  user?: unknown;
  existing: Record<string, unknown>;
  payload: Record<string, unknown>;
};

export type BackendModelConfig = {
  modelName: string;
  allowedUpdateFields: string[];
  protectedFields?: string[];
  validationSchema?: ZodSchema;
  permissions?: {
    canEdit?: (
      context: BackendModelPermissionContext,
    ) => boolean | Promise<boolean>;
  };
};
