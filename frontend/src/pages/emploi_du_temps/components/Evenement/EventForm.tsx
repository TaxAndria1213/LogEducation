import { useEffect, useMemo } from "react";
import { z } from "zod";
import { useAuth } from "../../../../auth/AuthContext";
import Spin from "../../../../components/anim/Spin";
import { Form } from "../../../../components/Form/Form";
import { getFieldsFromZodObjectSchema } from "../../../../components/Form/fields";
import { EvenementCalendrierSchema } from "../../../../generated/zod";
import EvenementCalendrierService from "../../../../services/evenementCalendrier.service";
import { useEvenementCreateStore } from "../../store/EvenementCreateStore";
import { useEvenementStore } from "../../store/EvenementIndexStore";
import { EVENT_TYPE_OPTIONS, type EventFormInput } from "../../types";

function EventForm() {
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new EvenementCalendrierService(), []);

  const loading = useEvenementCreateStore((state) => state.loading);
  const mode = useEvenementCreateStore((state) => state.mode);
  const editingEventId = useEvenementCreateStore((state) => state.editingEventId);
  const siteOptions = useEvenementCreateStore((state) => state.siteOptions);
  const initialValues = useEvenementCreateStore((state) => state.initialValues);
  const setInitialValues = useEvenementCreateStore((state) => state.setInitialValues);
  const getOptions = useEvenementCreateStore((state) => state.getOptions);
  const resetEditor = useEvenementCreateStore((state) => state.resetEditor);
  const setRenderedComponent = useEvenementStore((state) => state.setRenderedComponent);

  useEffect(() => {
    if (!etablissement_id) return;

    if (!initialValues?.etablissement_id) {
      resetEditor(etablissement_id);
    }

    getOptions(etablissement_id);
  }, [etablissement_id, getOptions, initialValues?.etablissement_id, resetEditor]);

  useEffect(() => {
    if (!etablissement_id) return;
    if (!initialValues?.etablissement_id) {
      setInitialValues({ etablissement_id });
    }
  }, [etablissement_id, initialValues?.etablissement_id, setInitialValues]);

  const eventFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(EvenementCalendrierSchema, {
        omit: ["id", "created_at", "updated_at", "etablissement_id"],
        metaByField: {
          site_id: { relation: { options: siteOptions } },
          debut: { dateMode: "datetime" },
          fin: { dateMode: "datetime" },
          type: {
            relation: {
              options: EVENT_TYPE_OPTIONS,
            },
          },
          description: { widget: "textarea" },
        },
        labelByField: {
          site_id: "Site",
          titre: "Titre",
          debut: "Debut",
          fin: "Fin",
          type: "Type",
          description: "Description",
        },
      }),
    [siteOptions],
  );

  const eventSchema = useMemo(
    () =>
      EvenementCalendrierSchema.omit({
        id: true,
        created_at: true,
        updated_at: true,
      }).superRefine((value, ctx) => {
        if (value.fin <= value.debut) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["fin"],
            message: "La fin doit etre strictement apres le debut.",
          });
        }
      }),
    [],
  );

  const ready = !etablissement_id || Boolean(initialValues?.etablissement_id);
  const formKey = `${mode}-${editingEventId ?? "new"}-${initialValues?.etablissement_id ?? "none"}`;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#fff7ed_46%,_#fffbeb_100%)] px-6 py-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {mode === "edit" ? "Modifier un evenement" : "Nouvel evenement calendrier"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {mode === "edit"
            ? "Ajuste les horaires, le site ou le type de l'evenement, puis republie la version corrigee."
            : "Planifie rapidement un cours special, un examen, une reunion ou une activite dans un calendrier lisible et coherent."}
        </p>
      </section>

      <section className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        {loading || !ready ? (
          <Spin label="Chargement des ressources..." showLabel />
        ) : (
          <Form
            key={formKey}
            schema={eventSchema}
            fields={eventFields}
            labelMessage={mode === "edit" ? "Evenement mis a jour" : "Evenement"}
            initialValues={initialValues as Partial<EventFormInput>}
            service={{
              create: async (data: Partial<EventFormInput>) => {
                const payload = {
                  ...data,
                  etablissement_id: etablissement_id ?? data.etablissement_id,
                };

                const result = editingEventId
                  ? await service.update(editingEventId, payload)
                  : await service.create(payload);

                resetEditor(etablissement_id);
                setRenderedComponent("list");
                return result;
              },
            }}
          />
        )}
      </section>
    </div>
  );
}

export default EventForm;
