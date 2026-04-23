/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Form } from "../../components/Form/Form";
import { getFieldsFromZodObjectSchema } from "../../components/Form/fields";
import { useInfo } from "../../hooks/useInfo";
import {
  ProfilSchema,
  UtilisateurSchema,
} from "../../generated/zod";
import {
  etablissementFields,
  etablissementSchema,
} from "../etablissement/profileEtablissement/components/form/schema/EtablissementSchemas";
import UtilisateurService, {
  type AdminOwnerCreationPayload,
} from "../../services/utilisateur.service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CreateAccountProps = {
  mode?: "admin" | "request";
  onSuccess?: (result: {
    etablissement?: { id?: string; nom?: string | null } | null;
  } | null) => void;
};

type WizardData = AdminOwnerCreationPayload;

const steps = [
  {
    key: "etablissement",
    title: "Etablissement",
    desc: "Identite de l'organisation",
  },
  {
    key: "utilisateur",
    title: "Proprietaire",
    desc: "Compte de connexion principal",
  },
  {
    key: "profil",
    title: "Profil",
    desc: "Informations personnelles",
  },
] as const;

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
    "status" in error.response.data &&
    typeof error.response.data.status === "object" &&
    error.response.data.status !== null &&
    "message" in error.response.data.status &&
    typeof error.response.data.status.message === "string"
  ) {
    return error.response.data.status.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Une erreur est survenue pendant la creation.";
}

export default function CreateAccount({
  mode = "admin",
  onSuccess,
}: CreateAccountProps) {
  const isAdminMode = mode === "admin";
  const { info } = useInfo();
  const service = useMemo(() => new UtilisateurService(), []);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [allData, setAllData] = useState<Partial<WizardData>>({});
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState<{
    0?: boolean;
    1?: boolean;
    2?: boolean;
  }>({});

  const etablissementInitialValues = useMemo(
    () => allData.etablissement ?? {},
    [allData.etablissement],
  );
  const utilisateurInitialValues = useMemo(
    () => allData.utilisateur ?? {},
    [allData.utilisateur],
  );
  const profilInitialValues = useMemo(
    () => allData.profil ?? {},
    [allData.profil],
  );

  const utilisateurField = useMemo(
    () =>
      getFieldsFromZodObjectSchema(
        UtilisateurSchema.extend({
          email: UtilisateurSchema.shape.email
            .transform((value) => value?.trim().toLowerCase() ?? value)
            .refine(
              (value) => typeof value === "string" && value.length > 0 && EMAIL_REGEX.test(value),
              "Veuillez saisir un email valide.",
            ),
        }),
        {
        omit: [
          "id",
          "created_at",
          "updated_at",
          "statut",
          "etablissement_id",
          "dernier_login",
          "scope_json",
        ],
        labelByField: {
          mot_de_passe_hash: "Mot de passe",
          email: "Email",
          telephone: "Telephone",
        },
        metaByField: {
          mot_de_passe_hash: {
            widget: "password",
          },
        },
      }),
    [],
  );

  const utilisateurSchema = useMemo(
    () =>
      UtilisateurSchema.extend({
        email: UtilisateurSchema.shape.email
          .transform((value) => value?.trim().toLowerCase() ?? value)
          .refine(
            (value) => typeof value === "string" && value.length > 0 && EMAIL_REGEX.test(value),
            "Veuillez saisir un email valide.",
          ),
      }).omit({
        id: true,
        created_at: true,
        updated_at: true,
        statut: true,
        etablissement_id: true,
        dernier_login: true,
        scope_json: true,
      }),
    [],
  );

  const profileField = useMemo(
    () =>
      getFieldsFromZodObjectSchema(ProfilSchema, {
        omit: [
          "id",
          "created_at",
          "updated_at",
          "utilisateur_id",
          "contact_urgence_json",
          "photo_url",
        ],
        metaByField: {
          date_naissance: { dateMode: "date" },
          genre: {
            relation: {
              options: [
                { value: "Homme", label: "Homme" },
                { value: "Femme", label: "Femme" },
              ],
            },
          },
        },
      }),
    [],
  );

  const profileSchema = useMemo(
    () =>
      ProfilSchema.omit({
        id: true,
        created_at: true,
        updated_at: true,
        utilisateur_id: true,
        contact_urgence_json: true,
        photo_url: true,
      }),
    [],
  );

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);
  const current = steps[step];
  const canJumpTo = (target: 0 | 1 | 2) => target <= step || Boolean(completed[target]);

  const resetAll = () => {
    setAllData({});
    setCompleted({});
    setStep(0);
    setLoading(false);
  };

  const goBack = () => setStep((s) => (s === 0 ? s : ((s - 1) as 0 | 1 | 2)));

  const jumpTo = (target: 0 | 1 | 2) => {
    if (canJumpTo(target)) {
      setStep(target);
    }
  };

  const nextFromEtablissement = (data: WizardData["etablissement"]) => {
    setAllData((prev) => ({ ...prev, etablissement: data }));
    setCompleted((prev) => ({ ...prev, 0: true }));
    setStep(1);
  };

  const nextFromUtilisateur = (data: WizardData["utilisateur"]) => {
    setAllData((prev) => ({ ...prev, utilisateur: data }));
    setCompleted((prev) => ({ ...prev, 1: true }));
    setStep(2);
  };

  const finishFromProfil = async (data: WizardData["profil"]) => {
    const finalData: WizardData = {
      etablissement: {
        nom: allData.etablissement?.nom ?? "",
      },
      utilisateur: {
        email: allData.utilisateur?.email ?? null,
        telephone: allData.utilisateur?.telephone ?? null,
        mot_de_passe_hash: allData.utilisateur?.mot_de_passe_hash ?? null,
      },
      profil: {
        prenom: data.prenom ?? "",
        nom: data.nom ?? "",
        date_naissance: data.date_naissance ?? null,
        genre: data.genre ?? null,
        adresse: data.adresse ?? null,
      },
    };

    setLoading(true);
    setAllData(finalData);
    setCompleted((prev) => ({ ...prev, 2: true }));

    try {
      const result = isAdminMode
        ? await service.createOwnerByAdmin(finalData)
        : await service.createOwnerRegistrationRequest(finalData);

      info(
        isAdminMode
          ? "Etablissement et proprietaire crees avec succes."
          : "Demande proprietaire enregistree avec succes.",
        "success",
      );

      onSuccess?.(
        (result?.data as {
          etablissement?: { id?: string; nom?: string | null } | null;
        } | null) ?? null,
      );

      if (!onSuccess) {
        resetAll();
      }
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  };

  const StepCard = ({
    index,
    title,
    desc,
  }: {
    index: 0 | 1 | 2;
    title: string;
    desc: string;
  }) => {
    const isActive = step === index;
    const isDone = Boolean(completed[index]);
    const enabled = canJumpTo(index);

    return (
      <button
        type="button"
        onClick={() => jumpTo(index)}
        disabled={!enabled}
        className={`grid w-full grid-cols-[1.75rem_minmax(0,1fr)] gap-3 rounded-2xl border px-3 py-3 text-left transition ${
          isActive
            ? "border-sky-300 bg-sky-50"
            : "border-slate-200 bg-white hover:border-slate-300"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
            isActive
              ? "border-sky-500 text-sky-700"
              : isDone
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-slate-300 text-slate-500"
          }`}
        >
          {isDone ? "OK" : index + 1}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-xs text-slate-500">{desc}</div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              {isAdminMode
                ? "Nouvel etablissement et proprietaire"
                : "Demande de creation d'etablissement"}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              {isAdminMode
                ? "Creation directe de l'etablissement, de son compte proprietaire et du role DIRECTION."
                : "Le dossier sera enregistre puis valide par un administrateur."}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
              Etape {step + 1}/{steps.length}
            </span>
            {loading ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 ring-1 ring-amber-200">
                Creation...
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-900">Progression</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {Math.round(progress)}% complete
            </p>
          </div>

          <div className="space-y-3">
            <StepCard index={0} title={steps[0].title} desc={steps[0].desc} />
            <StepCard index={1} title={steps[1].title} desc={steps[1].desc} />
            <StepCard index={2} title={steps[2].title} desc={steps[2].desc} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Resume</p>
            <p className="mt-2">{completed[0] ? "OK Etablissement renseigne" : "- Etablissement a completer"}</p>
            <p>{completed[1] ? "OK Proprietaire renseigne" : "- Proprietaire a completer"}</p>
            <p>{completed[2] ? "OK Profil renseigne" : "- Profil a completer"}</p>
          </div>

          {(completed[0] || completed[1] || completed[2]) && (
            <button
              type="button"
              onClick={resetAll}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reinitialiser
            </button>
          )}
        </aside>

        <main className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Etape courante
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                {current.title}
              </h3>
              <p className="mt-1 text-sm text-slate-500">{current.desc}</p>
            </div>

            <button
              type="button"
              onClick={goBack}
              disabled={step === 0 || loading}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Retour
            </button>
          </div>

          {step === 0 && (
            <Form
              schema={etablissementSchema}
              fields={etablissementFields}
              initialValues={etablissementInitialValues}
              dataOnly={nextFromEtablissement}
              labelMessage="Etablissement"
            />
          )}

          {step === 1 && (
            <Form
              schema={utilisateurSchema}
              fields={utilisateurField}
              initialValues={utilisateurInitialValues}
              dataOnly={nextFromUtilisateur}
              labelMessage="Utilisateur"
            />
          )}

          {step === 2 && (
            <Form
              schema={profileSchema}
              fields={profileField}
              initialValues={profilInitialValues}
              dataOnly={finishFromProfil}
              labelMessage="Profil"
            />
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
            Utilisez le bouton <span className="font-semibold text-slate-700">Enregistrer</span> du formulaire pour passer a l'etape suivante.
          </div>
        </main>
      </div>
    </div>
  );
}
