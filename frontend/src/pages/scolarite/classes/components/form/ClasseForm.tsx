import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { ClasseSchema } from "../../../../../generated/zod";
import ClasseService from "../../../../../services/classe.service";
import { useClasseCreateStore } from "../../store/ClasseCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";
import type { Classe } from "../../../../../types/models";
import { useEffect } from "react";

function ClasseForm() {
  const { etablissement_id } = useAuth();
  console.log("🚀 ~ ClasseForm ~ etablissement_id:", etablissement_id);
  const service = new ClasseService();
  const loading = useClasseCreateStore((state) => state.loading);
  const etablissementOptions = useClasseCreateStore(
    (state) => state.etablissementOptions,
  );

  const initialData = useClasseCreateStore((state) => state.initialData);
  const anneeScolaireOptions = useClasseCreateStore(
    (state) => state.anneeScolaireOptions,
  );
  const niveauOptions = useClasseCreateStore((state) => state.niveauOptions);
  const siteOptions = useClasseCreateStore((state) => state.siteOptions);

  const setInitialData = useClasseCreateStore((state) => state.setInitialData);

  const getEtablissementOptions = useClasseCreateStore(
    (state) => state.getEtablissementOptions,
  );

  useEffect(() => {
    getEtablissementOptions();
    if (etablissement_id) {
      setInitialData({ etablissement_id: etablissement_id });
    }
  }, [getEtablissementOptions, etablissement_id, setInitialData]);

  useEffect(() => {
    console.log(etablissementOptions);
  }, [etablissementOptions]);

  const ClasseFields = getFieldsFromZodObjectSchema(ClasseSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id"],

    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      etablissement_id: {
        relation: {
          options: etablissementOptions,
        },
      },
      annee_scolaire_id: {
        relation: {
          options: anneeScolaireOptions,
        },
      },
      niveau_scolaire_id: {
        relation: {
          options: niveauOptions,
        },
      },
      site_id: {
        relation: {
          options: siteOptions,
        },
      },
    },

    labelByField: {
      nom: "Nom",
      annee_scolaire_id: "Année scolaire",
      niveau_scolaire_id: "Niveau scolaire",
      site_id: "Site",
      enseignant_principal_id: "Enseignant principal",
    },
  });

  const classeSchema = ClasseSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <Form
          schema={classeSchema}
          fields={ClasseFields}
          initialValues={initialData as Partial<Classe>}
          service={service}
          labelMessage={"Classe"}
        />
      )}
    </div>
  );
}

export default ClasseForm;
