import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import CatalogueFraisService from "../../../../../services/catalogueFrais.service";
import { useAuth } from "../../../../../auth/AuthContext";
import ReferencielService, { buildReferentialOptions, type ReferentialCatalogItem } from "../../../../../services/referenciel.service";
import NiveauScolaireService from "../../../../../services/niveau.service";

const periodiciteOptions = [
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "monthly", label: "Mensuel" },
  { value: "term", label: "Par trimestre" },
  { value: "year", label: "Annuel" },
];

function CatalogueFraisForm() {
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new CatalogueFraisService(), []);
  const [referentialCatalog, setReferentialCatalog] = useState<ReferentialCatalogItem[]>([]);
  const [niveauOptions, setNiveauOptions] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    const loadReferentials = async () => {
      const referencielService = new ReferencielService();
      const niveauService = new NiveauScolaireService();
      const [catalogResult, niveauResult] = await Promise.all([
        referencielService.getCatalog(),
        etablissement_id
          ? niveauService.getAll({
            take: 1000,
            where: JSON.stringify({ etablissement_id }),
            orderBy: JSON.stringify([{ ordre: "asc" }, { nom: "asc" }]),
          })
          : Promise.resolve(null),
      ]);
      if (catalogResult?.status.success) {
        setReferentialCatalog((catalogResult.data as ReferentialCatalogItem[]) ?? []);
      }
      if (niveauResult?.status.success) {
        setNiveauOptions(
          niveauResult.data.data.map((item: { id: string; nom: string }) => ({
            value: item.id,
            label: item.nom,
          })),
        );
      }
    };
    void loadReferentials();
  }, [etablissement_id]);

  const deviseOptions = useMemo(
    () =>
      buildReferentialOptions(referentialCatalog, "FINANCE_DEVISE", ["MGA", "EUR", "USD"]),
    [referentialCatalog],
  );

  const schema = useMemo(
    () =>
      z
        .object({
          etablissement_id: z.string().min(1, "L'etablissement est requis."),
          niveau_scolaire_id: z.preprocess(
            (value) => (typeof value === "string" && value.trim() === "" ? null : value),
            z.string().nullable().optional(),
          ),
          nom: z.string().trim().min(2, "Le nom du frais est requis.").max(120, "Nom trop long."),
          description: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? null : value, z.string().max(240, "Description trop longue.").nullable().optional()),
          montant: z.coerce.number().min(0, "Le montant doit etre positif ou nul."),
          devise: z.string().trim().min(1, "La devise est requise."),
          est_recurrent: z.boolean().default(false),
          periodicite: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? null : value, z.string().nullable().optional()),
        })
        .superRefine((value, ctx) => {
          if (value.est_recurrent && !value.periodicite) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["periodicite"],
              message: "La periodicite est requise pour un frais recurrent.",
            });
          }
        }),
    [],
  );

  const fields = getFieldsFromZodObjectSchema(schema, {
    omit: ["etablissement_id"],
    metaByField: {
      niveau_scolaire_id: {
        relation: {
          options: [{ value: "", label: "Tous les niveaux / toutes les classes" }, ...niveauOptions],
        },
        fieldProps: {
          className: "md:col-span-1",
          emptyLabel: "Tous les niveaux / toutes les classes",
          description: "Si aucun niveau n'est choisi, le frais devient global et peut etre utilise pour toutes les classes.",
        },
      },
      nom: {
        fieldProps: {
          placeholder: "Ex: Frais de scolarite annuelle",
        },
      },
      description: {
        fieldProps: {
          className: "md:col-span-2",
          placeholder: "Ex: Frais principal applicable a tous les eleves de l'etablissement.",
        },
      },
      montant: {
        fieldProps: {
          placeholder: "Ex: 150000",
        },
      },
      devise: {
        relation: {
          options: deviseOptions,
        },
      },
      periodicite: {
        relation: {
          options: periodiciteOptions,
        },
        fieldProps: {
          emptyLabel: "Aucune periodicite",
        },
      },
    },
    labelByField: {
      niveau_scolaire_id: "Niveau scolaire",
      nom: "Nom",
      description: "Description",
      montant: "Montant",
      devise: "Devise",
      est_recurrent: "Frais recurrent",
      periodicite: "Periodicite",
    },
  });

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">Nouveau frais catalogue</h3>
          <p className="text-sm leading-6 text-slate-500">
            Cree un tarif reutilisable dans les inscriptions et la future facturation.
          </p>
        </div>

        <Form
          schema={schema}
          fields={fields}
          service={service}
          labelMessage="Catalogue de frais"
          initialValues={etablissement_id ? { etablissement_id, niveau_scolaire_id: "", devise: "MGA", est_recurrent: false } : undefined}
          submitLabel="Enregistrer le frais"
          submitAlign="end"
        />
      </div>
    </div>
  );
}

export default CatalogueFraisForm;
