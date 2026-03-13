import { getFieldsFromZodObjectSchema } from "../../../../../../components/Form/fields";
import { EtablissementSchema } from "../../../../../../generated/zod";

export const etablissementFields = getFieldsFromZodObjectSchema(EtablissementSchema, {
    omit: ["id", "code", "created_at", "updated_at", "parametres_json", "fuseau_horaire"],
    
    metaByField: {
    created_at: { dateMode: "datetime" },
    updated_at: { dateMode: "datetime" },
    // relation example:
    // etablissement_id: { relation: { options: etabs.map(e => ({value:e.id,label:e.nom})) } }
  },
})

export const etablissementSchema = EtablissementSchema.omit({ id: true, code: true, created_at: true, updated_at: true, parametres_json: true, fuseau_horaire: true });