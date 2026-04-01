import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import FormuleCantineService from "../../../../../services/formuleCantine.service";
import AbonnementCantineService from "../../../../../services/abonnementCantine.service";
import CatalogueFraisService, {
  type CatalogueFraisWithRelations,
  getCatalogueFraisSecondaryLabel,
  isApprovedCatalogueFrais,
} from "../../../../../services/catalogueFrais.service";
import EleveService from "../../../../../services/eleve.service";
import AnneeScolaireService from "../../../../../services/anneeScolaire.service";
import type { AnneeScolaire, CatalogueFrais, FormuleCantine } from "../../../../../types/models";

const formuleSchema = z.object({
  nom: z.string().min(1, "Le nom est obligatoire."),
  catalogue_frais_id: z.string().min(1, "Le frais catalogue est obligatoire."),
});

const abonnementSchema = z.object({
  eleve_id: z.string().min(1, "L'eleve est obligatoire."),
  formule_cantine_id: z.string().min(1, "La formule est obligatoire."),
  statut: z.string().default("ACTIF"),
});

type CantineAction = "formule" | "abonnement";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }
  return "Impossible d'enregistrer l'element cantine.";
}

function isCantineFee(record?: Partial<CatalogueFrais> | null) {
  const usageScope = (record?.usage_scope ?? "GENERAL").toUpperCase();
  return usageScope === "GENERAL" || usageScope === "CANTINE";
}

function ActionSelector({
  value,
  onChange,
}: {
  value: CantineAction;
  onChange: (value: CantineAction) => void;
}) {
  const actions: Array<{
    id: CantineAction;
    label: string;
    description: string;
  }> = [
    {
      id: "formule",
      label: "Ajouter une formule",
      description: "Creer une formule ou un tarif cantine.",
    },
    {
      id: "abonnement",
      label: "Ajouter un abonnement",
      description: "Rattacher un eleve a une formule cantine.",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {actions.map((action) => {
        const active = action.id === value;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onChange(action.id)}
            className={`rounded-[22px] border px-4 py-4 text-left transition ${
              active
                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-semibold">{action.label}</p>
            <p className={`mt-2 text-xs leading-5 ${active ? "text-slate-200" : "text-slate-500"}`}>
              {action.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export default function CantineForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const [activeAction, setActiveAction] = useState<CantineAction>("formule");
  const [formules, setFormules] = useState<FormuleCantine[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [catalogueFrais, setCatalogueFrais] = useState<CatalogueFraisWithRelations[]>([]);
  const [currentYear, setCurrentYear] = useState<AnneeScolaire | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<CantineAction | null>(null);
  const formuleForm = useForm<z.infer<typeof formuleSchema>>({
    resolver: zodResolver(formuleSchema),
    defaultValues: { nom: "", catalogue_frais_id: "" },
  });
  const abonnementForm = useForm<z.infer<typeof abonnementSchema>>({
    resolver: zodResolver(abonnementSchema),
    defaultValues: {
      eleve_id: "",
      formule_cantine_id: "",
      statut: "ACTIF",
    },
  });
  const selectedFormuleId = abonnementForm.watch("formule_cantine_id");

  const load = useMemo(
    () => async () => {
      if (!etablissement_id) return;
      setLoading(true);
      try {
        const [formulesResult, elevesResult, catalogueFraisResult, activeYear] = await Promise.all([
          new FormuleCantineService().getForEtablissement(etablissement_id, {
            take: 500,
            includeSpec: JSON.stringify({ frais: true }),
          }),
          new EleveService().getAll({
            take: 500,
            where: JSON.stringify({ etablissement_id }),
            includeSpec: JSON.stringify({
              utilisateur: { include: { profil: true } },
            }),
          }),
          new CatalogueFraisService().getForEtablissement(etablissement_id, {
            take: 500,
            where: JSON.stringify({
              usage_scope: { in: ["GENERAL", "CANTINE"] },
            }),
          }),
          AnneeScolaireService.getCurrent(etablissement_id),
        ]);
        setFormules(formulesResult?.status.success ? formulesResult.data.data : []);
        setEleves(elevesResult?.status.success ? elevesResult.data.data : []);
        setCatalogueFrais(
          (catalogueFraisResult?.status.success ? catalogueFraisResult.data.data : [])
            .filter(isCantineFee)
            .filter(isApprovedCatalogueFrais),
        );
        setCurrentYear((activeYear as AnneeScolaire | null) ?? null);
      } finally {
        setLoading(false);
      }
    },
    [etablissement_id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selectedFormule = useMemo(
    () => formules.find((item) => item.id === selectedFormuleId) ?? null,
    [formules, selectedFormuleId],
  );

  return (
    <div className="space-y-6">
      <ActionSelector value={activeAction} onChange={setActiveAction} />
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Spin label="Chargement du formulaire cantine..." showLabel />
        </div>
      ) : null}

      {activeAction === "formule" ? (
        <form
          onSubmit={formuleForm.handleSubmit(async (data) => {
            try {
              setSubmittingAction("formule");
              if (!etablissement_id) {
                throw new Error("Aucun etablissement actif n'est disponible.");
              }
              await new FormuleCantineService().create({
                etablissement_id,
                nom: data.nom,
                catalogue_frais_id: data.catalogue_frais_id,
              });
              info("Formule creee.", "success");
              formuleForm.reset({ nom: "", catalogue_frais_id: "" });
              await load();
            } catch (error) {
              info(getErrorMessage(error), "error");
            } finally {
              setSubmittingAction(null);
            }
          })}
          className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900">Nouvelle formule</h3>
            <p className="mt-1 text-sm text-slate-500">
              Cette vue est dediee a la creation des formules de cantine. Le tarif officiel vient directement du catalogue de frais, donc il n'est plus ressaisi ici.
            </p>
          </div>

          <Controller
            control={formuleForm.control}
            name="nom"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="cantine_formule_nom"
                label="Nom"
                required
                error={fieldState.error?.message}
              >
                <input
                  {...field}
                  disabled={loading || submittingAction === "formule"}
                  className={getInputClassName(Boolean(fieldState.error))}
                />
              </FieldWrapper>
            )}
          />

          <Controller
            control={formuleForm.control}
            name="catalogue_frais_id"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="cantine_formule_frais"
                label="Frais catalogue"
                required
                error={fieldState.error?.message}
                hint="Selectionne un frais du catalogue avec un usage cantine."
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "formule"}
                  className={getInputClassName(Boolean(fieldState.error))}
                >
                  <option value="">Selectionner un frais cantine</option>
                  {catalogueFrais.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nom} - {getCatalogueFraisSecondaryLabel(item)}
                    </option>
                  ))}
                </select>
              </FieldWrapper>
            )}
          />

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || submittingAction === "formule"}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingAction === "formule" ? "Ajout en cours..." : "Ajouter la formule"}
            </button>
          </div>
        </form>
      ) : null}

      {activeAction === "abonnement" ? (
        <form
          onSubmit={abonnementForm.handleSubmit(async (data) => {
            try {
              setSubmittingAction("abonnement");
              if (!etablissement_id) {
                throw new Error("Aucun etablissement actif n'est disponible.");
              }
              if (!currentYear?.id) {
                throw new Error("Aucune annee scolaire active n'est disponible.");
              }
              await new AbonnementCantineService().create({
                etablissement_id,
                eleve_id: data.eleve_id,
                annee_scolaire_id: currentYear.id,
                formule_cantine_id: data.formule_cantine_id,
                statut: data.statut || "ACTIF",
              });
              info("Abonnement cantine cree. La facturation se gere ensuite dans Finance.", "success");
              abonnementForm.reset({
                eleve_id: "",
                formule_cantine_id: "",
                statut: "ACTIF",
              });
              await load();
            } catch (error) {
              info(getErrorMessage(error), "error");
            } finally {
              setSubmittingAction(null);
            }
          })}
          className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900">
              Nouvel abonnement cantine
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Cette vue sert uniquement a rattacher un eleve a une formule cantine.
              La facture, l'encaissement et toute regularisation monetaire se font dans Finance.
            </p>
          </div>

          <div className="md:col-span-2 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Annee scolaire appliquee
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {currentYear?.nom ?? "Aucune annee scolaire active"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              L'abonnement sera automatiquement rattache a l'annee scolaire active de l'etablissement.
            </p>
          </div>

          <Controller
            control={abonnementForm.control}
            name="eleve_id"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="cantine_subscription_student"
                label="Eleve"
                required
                error={fieldState.error?.message}
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "abonnement"}
                  className={getInputClassName(Boolean(fieldState.error))}
                >
                  <option value="">Selectionner un eleve</option>
                  {eleves.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code_eleve} {item.utilisateur?.profil?.prenom}{" "}
                      {item.utilisateur?.profil?.nom}
                    </option>
                  ))}
                </select>
              </FieldWrapper>
            )}
          />

          <Controller
            control={abonnementForm.control}
            name="formule_cantine_id"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="cantine_subscription_formule"
                label="Formule"
                required
                error={fieldState.error?.message}
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "abonnement"}
                  className={getInputClassName(Boolean(fieldState.error))}
                >
                  <option value="">Selectionner une formule</option>
                  {formules.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nom}
                    </option>
                  ))}
                </select>
              </FieldWrapper>
            )}
          />

          <div className="md:col-span-2 rounded-[20px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
            <p className="font-semibold">Tarif et suivi financier dans Finance</p>
            <p className="mt-1">
              {selectedFormule?.frais
                ? `${selectedFormule.frais.nom} - ${getCatalogueFraisSecondaryLabel(selectedFormule.frais as CatalogueFraisWithRelations)}`
                : "Choisis une formule reliee a un frais catalogue cantine."}
            </p>
            <p className="mt-2 text-xs text-sky-800">
              Ici tu actives seulement le service. La facture et les paiements se gerent ensuite depuis Finance.
            </p>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={!currentYear?.id || loading || submittingAction === "abonnement"}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingAction === "abonnement"
                ? "Ajout en cours..."
                : "Ajouter l'abonnement"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
