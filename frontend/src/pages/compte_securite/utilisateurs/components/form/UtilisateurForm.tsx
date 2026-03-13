import { useEffect } from "react";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { UtilisateurSchema } from "../../../../../generated/zod";
import UtilisateurService from "../../../../../services/utilisateur.service";
import { useUtilisateurCreateStore } from "../../store/UtilisateurCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";
import type { Utilisateur } from "../../../../../types/models";

function UtilisateurForm() {
  const {etablissement_id} = useAuth();
  const service = new UtilisateurService();
  const loading = useUtilisateurCreateStore((state) => state.loading);
  const etablissementOptions = useUtilisateurCreateStore(
    (state) => state.etablissementOptions,
  );
  const initialValues = useUtilisateurCreateStore(
    (state) => state.initialValues,
  );
  const setInitialValues = useUtilisateurCreateStore(
    (state) => state.setInitialValues,
  );

  useEffect(() => {
    if(etablissement_id) {
      setInitialValues({ etablissement_id: etablissement_id, statut: "ACTIF" });
    }
  }, [etablissement_id, setInitialValues]);

  const utilisateurFields = getFieldsFromZodObjectSchema(UtilisateurSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id", "dernier_login", "statut", "scope_json"],

    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      // relation example:
      etablissement_id: {
        relation: {
          options: etablissementOptions,
        },
      },
    },

    labelByField: {
      nom: "Nom",
      telephone: "Téléphone",
      mot_de_passe_hash: "Mot de passe",
    },
  });

  const utilisateurSchema = UtilisateurSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    etablissement_id: true,
    dernier_login: true,
    statut: true,
    scope_json: true,
    

  });

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <Form
          schema={utilisateurSchema}
          fields={utilisateurFields}
          initialValues={initialValues as Partial<Utilisateur>}
          service={service}
          labelMessage={"Utilisateur"}
        />
      )}
    </div>
  );
}

export default UtilisateurForm;
