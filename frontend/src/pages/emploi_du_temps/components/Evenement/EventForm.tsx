import { useEffect } from "react";
import { useAuth } from "../../../../auth/AuthContext";
import Spin from "../../../../components/anim/Spin";
import { Form } from "../../../../components/Form/Form";
import { getFieldsFromZodObjectSchema } from "../../../../components/Form/fields";
import { EvenementCalendrierSchema } from "../../../../generated/zod";
import EvenementCalendrierService from "../../../../services/evenementCalendrier.service";
import { useEvenementCreateStore } from "../../store/EvenementCreateStore";
import type { EventFormInput } from "../../types";

function EventForm() {
  const { etablissement_id } = useAuth();
  const service = new EvenementCalendrierService();

  const loading = useEvenementCreateStore((state) => state.loading);
  const siteOptions = useEvenementCreateStore((state) => state.siteOptions);
  const initialValues = useEvenementCreateStore((state) => state.initialValues);
  const setInitialValues = useEvenementCreateStore((state) => state.setInitialValues);
  const getOptions = useEvenementCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (!etablissement_id) return;
    setInitialValues({ etablissement_id });
    getOptions(etablissement_id);
  }, [etablissement_id, getOptions, setInitialValues]);

  const eventFields = getFieldsFromZodObjectSchema(EvenementCalendrierSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id"],
    metaByField: {
      site_id: { relation: { options: siteOptions } },
      debut: { dateMode: "datetime" },
      fin: { dateMode: "datetime" },
      type: {
        relation: {
          options: [
            { value: "Cours", label: "Cours" },
            { value: "Examen", label: "Examen" },
            { value: "Reunion", label: "Reunion" },
            { value: "Activite", label: "Activite" },
          ],
        },
      },
      description: { widget: "textarea" },
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
    },
    labelByField: {
      site_id: "Site",
      titre: "Titre",
      debut: "Debut",
      fin: "Fin",
      type: "Type",
      description: "Description",
    },
  });

  const eventSchema = EvenementCalendrierSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  const ready = !etablissement_id || Boolean(initialValues?.etablissement_id);

  return (
    <div className="w-[100%]">
      {loading || !ready ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <Form
          schema={eventSchema}
          fields={eventFields}
          service={service}
          labelMessage={"Evenement"}
          initialValues={initialValues as Partial<EventFormInput>}
        />
      )}
    </div>
  );
}

export default EventForm;
