import { z } from "zod";
import type { BackendModelConfig } from "../../../common/model-config/types";

const eleveUpdateSchema = z
  .object({
    code_eleve: z.string().trim().max(80).nullable().optional(),
    statut: z.string().trim().max(60).nullable().optional(),
    date_entree: z.coerce.date().nullable().optional(),
  })
  .strict();

export const eleveUpdateConfig: BackendModelConfig = {
  modelName: "eleve",
  allowedUpdateFields: ["code_eleve", "statut", "date_entree"],
  protectedFields: [
    "id",
    "etablissement_id",
    "utilisateur_id",
    "created_at",
    "updated_at",
  ],
  validationSchema: eleveUpdateSchema,
};
