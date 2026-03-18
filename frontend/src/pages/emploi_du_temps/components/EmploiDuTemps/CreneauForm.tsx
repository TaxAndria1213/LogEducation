import { useEffect, useMemo } from "react";
import { useAuth } from "../../../../auth/AuthContext";
import Spin from "../../../../components/anim/Spin";
import { Form } from "../../../../components/Form/Form";
import { getFieldsFromZodObjectSchema } from "../../../../components/Form/fields";
import { CreneauHoraireSchema } from "../../../../generated/zod";
import CreneauHoraireService from "../../../../services/creneauHoraire.service";
import { useCreneauHoraireCreateStore } from "../../store/CreneauHoraireCreateStore";
import type { CreneauFormInput } from "../../types";

type Props = {
  onCreated?: () => void;
};

export default function CreneauForm({ onCreated }: Props) {
  const { etablissement_id } = useAuth();
  const loading = useCreneauHoraireCreateStore((state) => state.loading);
  const initialValues = useCreneauHoraireCreateStore((state) => state.initialValues);
  const setInitialValues = useCreneauHoraireCreateStore(
    (state) => state.setInitialValues,
  );

  useEffect(() => {
    if (etablissement_id) {
      setInitialValues({ etablissement_id });
    }
  }, [etablissement_id, setInitialValues]);

  const creneauFields = getFieldsFromZodObjectSchema(CreneauHoraireSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id"],
    labelByField: {
      nom: "Nom du creneau",
      heure_debut: "Heure de debut",
      heure_fin: "Heure de fin",
      ordre: "Ordre d'affichage",
    },
    metaByField: {
      heure_debut: { dateMode: "time" },
      heure_fin: { dateMode: "time" },
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      // relation example:
    },
  });

  const creneauSchema = CreneauHoraireSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  const service = useMemo(() => {
    const api = new CreneauHoraireService();

    return {
      create: async (data: CreneauFormInput) => {
        const result = await api.create({
          ...data,
          etablissement_id,
        });

        if (result?.status.success) {
          onCreated?.();
        }

        return result;
      },
    };
  }, [etablissement_id, onCreated]);

  const ready = !etablissement_id || Boolean(initialValues?.etablissement_id);

  return (
    <div className="w-full">
      {loading || !ready ? (
        <Spin label="Preparation du formulaire..." showLabel />
      ) : (
        <Form
          schema={creneauSchema}
          fields={creneauFields}
          service={service}
          labelMessage="Creneau horaire"
          initialValues={initialValues as Partial<CreneauFormInput>}
        />
      )}
    </div>
  );
}
