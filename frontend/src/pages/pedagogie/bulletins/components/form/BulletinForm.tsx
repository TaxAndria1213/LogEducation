import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiLayers,
} from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import { useInfo } from "../../../../../hooks/useInfo";
import { useAuth } from "../../../../../hooks/useAuth";
import BulletinService from "../../../../../services/bulletin.service";
import { getEleveDisplayLabel } from "../../../../../services/note.service";
import { useBulletinCreateStore } from "../../store/BulletinCreateStore";

type BulletinFormValues = {
  eleve_id: string;
  periode_id: string;
  statut: "EN_COURS" | "PUBLIE";
  publie_le: string;
};

const bulletinSchema = z.object({
  eleve_id: z.string().min(1, "L'eleve est requis."),
  periode_id: z.string().min(1, "La periode est requise."),
  statut: z.enum(["EN_COURS", "PUBLIE"]),
  publie_le: z.string().optional(),
});

function getErrorMessage(error: unknown) {
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

  return "Le bulletin n'a pas pu etre enregistre.";
}

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function BulletinForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new BulletinService(), []);

  const loading = useBulletinCreateStore((state) => state.loading);
  const errorMessage = useBulletinCreateStore((state) => state.errorMessage);
  const initialData = useBulletinCreateStore((state) => state.initialData);
  const inscriptions = useBulletinCreateStore((state) => state.inscriptions);
  const periodes = useBulletinCreateStore((state) => state.periodes);
  const getOptions = useBulletinCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) {
      void getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const defaultValues = useMemo<BulletinFormValues>(
    () => ({
      eleve_id: initialData?.eleve_id ?? "",
      periode_id: initialData?.periode_id ?? "",
      statut: (initialData?.statut as BulletinFormValues["statut"]) ?? "EN_COURS",
      publie_le: initialData?.publie_le
        ? formatDateTimeLocal(
            initialData.publie_le instanceof Date
              ? initialData.publie_le
              : new Date(initialData.publie_le),
          )
        : formatDateTimeLocal(new Date()),
    }),
    [initialData],
  );

  const form = useForm<BulletinFormValues>({
    resolver: zodResolver(bulletinSchema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const { control, handleSubmit, watch, formState, reset } = form;
  const selectedEleveId = watch("eleve_id");
  const selectedPeriodeId = watch("periode_id");
  const selectedStatut = watch("statut");

  const selectedInscription = useMemo(
    () => inscriptions.find((item) => item.eleve_id === selectedEleveId) ?? null,
    [inscriptions, selectedEleveId],
  );
  const selectedPeriode = useMemo(
    () => periodes.find((item) => item.id === selectedPeriodeId) ?? null,
    [periodes, selectedPeriodeId],
  );

  const onSubmit = async (data: BulletinFormValues) => {
    try {
      await service.create({
        eleve_id: data.eleve_id,
        periode_id: data.periode_id,
        statut: data.statut,
        publie_le: data.statut === "PUBLIE" ? new Date(data.publie_le) : null,
      });
      info("Bulletin cree avec succes !", "success");
      reset({
        ...defaultValues,
        eleve_id: "",
        periode_id: "",
        statut: "EN_COURS",
        publie_le: formatDateTimeLocal(new Date()),
      });
    } catch (error: unknown) {
      info(getErrorMessage(error), "error");
    }
  };

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

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                    <FiBookOpen />
                    Nouveau bulletin
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Generer un bulletin a partir des notes de periode
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      Le bulletin se rattache a un eleve reellement inscrit sur l'annee de la periode, puis ses lignes sont regenerees automatiquement depuis les notes disponibles.
                    </p>
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Reperes rapides</p>
                  <p className="mt-2">{inscriptions.length} inscription(s) chargee(s)</p>
                  <p>{periodes.length} periode(s) disponible(s)</p>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FiLayers />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Contexte scolaire</h3>
                  <p className="text-sm text-slate-500">
                    Choisis l'eleve et la periode. La classe est derivee automatiquement depuis l'inscription active de l'annee concernee.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Controller
                  control={control}
                  name="eleve_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="eleve_id"
                      label="Eleve"
                      required
                      error={fieldState.error?.message}
                      description="Seuls les eleves ayant une inscription sur l'annee active sont proposes."
                    >
                      <select
                        id="eleve_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner un eleve</option>
                        {inscriptions.map((inscription) => (
                          <option key={inscription.id} value={inscription.eleve_id}>
                            {`${getEleveDisplayLabel(inscription.eleve)}${inscription.classe?.nom ? ` - ${inscription.classe.nom}` : ""}`}
                          </option>
                        ))}
                      </select>
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="periode_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="periode_id"
                      label="Periode"
                      required
                      error={fieldState.error?.message}
                      description="Les lignes du bulletin seront calculees a partir des notes visibles sur cette periode."
                    >
                      <select
                        id="periode_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner une periode</option>
                        {periodes.map((periode) => (
                          <option key={periode.id} value={periode.id}>
                            {periode.nom}
                          </option>
                        ))}
                      </select>
                    </FieldWrapper>
                  )}
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FiCalendar />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Publication</h3>
                  <p className="text-sm text-slate-500">
                    Le bulletin peut rester en cours ou etre publie immediatement apres generation.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Controller
                  control={control}
                  name="statut"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="statut"
                      label="Statut"
                      required
                      error={fieldState.error?.message}
                      description="En cours pour preparer, publie pour figer et distribuer le bulletin." 
                    >
                      <select
                        id="statut"
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="EN_COURS">En cours</option>
                        <option value="PUBLIE">Publie</option>
                      </select>
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="publie_le"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="publie_le"
                      label="Date de publication"
                      error={fieldState.error?.message}
                      description="Utilisee uniquement si le statut est publie."
                    >
                      <input
                        id="publie_le"
                        type="datetime-local"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        disabled={selectedStatut !== "PUBLIE"}
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <FiCheckCircle />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Lecture rapide</h3>
                    <p className="text-sm text-slate-500">
                      Le contexte principal du bulletin avant generation.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4 text-sm text-slate-700">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="font-semibold text-slate-900">
                      {selectedInscription ? getEleveDisplayLabel(selectedInscription.eleve) : "Aucun eleve selectionne"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      Classe: {selectedInscription?.classe?.nom ?? "Non renseignee"}
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="font-semibold text-slate-900">
                      {selectedPeriode?.nom ?? "Aucune periode selectionnee"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {selectedPeriode
                        ? `Du ${new Intl.DateTimeFormat("fr-FR").format(new Date(selectedPeriode.date_debut))} au ${new Intl.DateTimeFormat("fr-FR").format(new Date(selectedPeriode.date_fin))}`
                        : "Les bornes de periode apparaitront ici."}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <FiBookOpen />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Conseils</h3>
                    <p className="text-sm text-slate-500">
                      Quelques reperes utiles avant de lancer la generation.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                  <p>Le bulletin reprendra automatiquement les notes de la periode pour cet eleve.</p>
                  <p className="mt-2">Une regeneration ulterieure recalculera les lignes et les moyennes a partir des notes visibles a ce moment-la.</p>
                  <p className="mt-2">Le rang par matiere est derive des autres eleves de la meme classe sur la meme periode.</p>
                </div>
              </article>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={formState.isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {formState.isSubmitting ? <Spin inline /> : null}
                <span>Enregistrer le bulletin</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default BulletinForm;
