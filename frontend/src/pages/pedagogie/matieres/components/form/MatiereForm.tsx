import { useEffect, useMemo } from "react";
import { z } from "zod";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import MatiereService from "../../../../../services/matiere.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { useMatiereCreateStore } from "../../store/MatiereCreateStore";
import Spin from "../../../../../components/anim/Spin";

function MatiereForm() {
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new MatiereService(), []);

  const getOptions = useMatiereCreateStore((state) => state.getOptions);
  const loading = useMatiereCreateStore((state) => state.loading);
  const initialData = useMatiereCreateStore((state) => state.initialData);
  const departementOptions = useMatiereCreateStore(
    (state) => state.departementOptions,
  );
  const errorMessage = useMatiereCreateStore((state) => state.errorMessage);

  useEffect(() => {
    if (etablissement_id) {
      void getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const matiereFormSchema = useMemo(
    () =>
      z.object({
        etablissement_id: z.string().min(1, "L'etablissement est requis."),
        code: z
          .preprocess((value) => {
            if (typeof value !== "string") return null;
            const normalized = value.trim().replace(/\s+/g, " ").toUpperCase();
            return normalized || null;
          }, z.string().max(20, "Le code ne doit pas depasser 20 caracteres.").nullable())
          .nullable(),
        nom: z
          .string()
          .trim()
          .min(2, "Le nom de la matiere est requis.")
          .max(120, "Le nom est trop long.")
          .transform((value) => value.replace(/\s+/g, " ")),
        departement_id: z
          .preprocess(
            (value) =>
              typeof value === "string" && value.trim() === "" ? null : value,
            z.string().nullable().optional(),
          )
          .nullable()
          .optional(),
      }),
    [],
  );

  const matiereFields = getFieldsFromZodObjectSchema(matiereFormSchema, {
    omit: ["etablissement_id"],
    metaByField: {
      code: {
        fieldProps: {
          placeholder: "Ex: MATH-6E",
          description:
            "Code court recommande pour faciliter les listes, les cours et les emplois du temps.",
        },
      },
      nom: {
        fieldProps: {
          className: "md:col-span-2",
          placeholder: "Ex: Mathematiques",
          description:
            "Utilise un nom clair et stable, car cette matiere sera reprise dans les cours, programmes et bulletins.",
        },
      },
      departement_id: {
        relation: {
          options: departementOptions,
        },
        fieldProps: {
          emptyLabel: "Sans departement",
          description:
            "Le departement reste facultatif, mais il aide a structurer les enseignants, les programmes et les tableaux de bord.",
        },
      },
    },
    labelByField: {
      code: "Code",
      nom: "Nom",
      departement_id: "Departement",
    },
  });

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <div className="space-y-5">
          {errorMessage ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {errorMessage}
            </div>
          ) : null}

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">
                Nouvelle matiere
              </h3>
              <p className="text-sm leading-6 text-slate-500">
                Cree une matiere proprement rattachee a ton etablissement. Le
                code est facultatif, mais utile pour les cours, l'emploi du
                temps et les vues de synthese.
              </p>
            </div>

            <Form
              schema={matiereFormSchema}
              fields={matiereFields}
              service={service}
              labelMessage={"Matiere"}
              initialValues={
                initialData ??
                (etablissement_id ? { etablissement_id } : undefined)
              }
              submitLabel="Enregistrer la matiere"
              submitAlign="end"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default MatiereForm;
