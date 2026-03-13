import { useEffect } from "react";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { PeriodeSchema } from "../../../../../generated/zod";
import { usePeriodeCreateStore, type PeriodeCreateInput } from "../../store/PeriodeCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";
import PeriodeService from "../../../../../services/periode.service";

function PeriodeForm() {
  const {etablissement_id} = useAuth();
  const loading = usePeriodeCreateStore((state) => state.loading);
  const anneeScolaireOptions = usePeriodeCreateStore(
    (state) => state.anneeScolaireOptions,
  );

  const initialData = usePeriodeCreateStore((state) => state.initialData);

  // const setInitialData = usePeriodeCreateStore(
  //   (state) => state.setInitialData,
  // );


  const getAnneeScolaireOptions = usePeriodeCreateStore(
    (state) => state.getAnneeScolaireOptions,
  );

  useEffect(() => {
    getAnneeScolaireOptions(etablissement_id as string);
  }, [getAnneeScolaireOptions, etablissement_id]);

  const periodeFields = getFieldsFromZodObjectSchema(PeriodeSchema, {
    omit: ["id", "created_at", "updated_at"],

    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      // relation example:
      annee_scolaire_id: {
        relation: {
          options: anneeScolaireOptions,
        },
      },
    },

    labelByField: {
      annee_scolaire_id: "Année scolaire",
      nom: "Nom",
      date_debut: "Date de debut",
      date_fin: "Date de fin",
      ordre: "Ordre",
    },
  });

  const periodeSchema = PeriodeSchema.omit({
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
          schema={periodeSchema}
          fields={periodeFields}
          service={PeriodeService}
          labelMessage={"Periode"}
          initialValues={initialData as Partial<PeriodeCreateInput>}
        />
      )}
    </div>
  );
}

export default PeriodeForm;
