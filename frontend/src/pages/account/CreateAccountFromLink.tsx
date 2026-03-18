/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import z from "zod";
import { Form } from "../../components/Form/Form";
import { getFieldsFromZodObjectSchema } from "../../components/Form/fields";
import FlyPopup from "../../components/popup/FlyPopup";
import Spin from "../../components/anim/Spin";
import { ProfilSchema, UtilisateurSchema } from "../../generated/zod";
import UtilisateurService from "../../services/utilisateur.service";
import RoleService from "../../services/role.service";
import { styles } from "../../styles/styles";
import type { WizardDataUserPersonnel } from "../../types/types";
import type { Profil, Utilisateur } from "../../types/models";

const PERSONNEL_ROLE_NAMES = new Set([
  "DIRECTION",
  "SECRETARIAT",
  "ENSEIGNANT",
  "COMPTABLE",
  "SURVEILLANT",
]);

const steps = [
  { key: "utilisateur", title: "Utilisateur", desc: "Compte de connexion" },
  { key: "profil", title: "Profil", desc: "Informations personnelles" },
] as const;

export default function CreateAccountFromLink() {
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<0 | 1>(0);
  const [allData, setAllData] = useState<WizardDataUserPersonnel>({});
  const [loading, setLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [openConfirmationPopup, setOpenConfirmationPopup] = useState(false);
  const [completed, setCompleted] = useState<{ 0?: boolean; 1?: boolean }>({});
  const [roleName, setRoleName] = useState(searchParams.get("role_name") ?? "");

  const role_id = searchParams.get("role_id");
  const etablissement_id = searchParams.get("etablissement_id");
  const normalizedRoleName = roleName.trim().toUpperCase();
  const shouldCreatePersonnel = PERSONNEL_ROLE_NAMES.has(normalizedRoleName);
  const shouldCreateEnseignant = normalizedRoleName === "ENSEIGNANT";

  useEffect(() => {
    setAllData((prev) => ({
      ...prev,
      role_id,
      etablissement_id,
      etablissement: etablissement_id ? { id: etablissement_id } : undefined,
    }));
  }, [role_id, etablissement_id]);

  useEffect(() => {
    const run = async () => {
      if (roleName || !role_id) return;

      const roleService = new RoleService();
      const result = await roleService.getAll({
        take: 1,
        where: JSON.stringify({ id: role_id }),
      });

      if (result?.status.success && result.data.data[0]?.nom) {
        setRoleName(result.data.data[0].nom);
      }
    };

    void run();
  }, [roleName, role_id]);

  const utilisateurField = useMemo(() => {
    const UtilisateurSchemaEmailRequired = UtilisateurSchema.extend({
      email: z.string(),
      mot_de_passe_hash: z.string(),
    });

    return getFieldsFromZodObjectSchema(UtilisateurSchemaEmailRequired, {
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
        telephone: "Telephone",
      },
      metaByField: {
        mot_de_passe_hash: { widget: "password" },
      },
    });
  }, []);

  const utilisateurSchema = useMemo(
    () =>
      UtilisateurSchema.omit({
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

  const utilisateurInitialValues = useMemo(
    () => allData.utilisateur ?? {},
    [allData.utilisateur],
  );
  const profilInitialValues = useMemo(
    () => allData.profil ?? {},
    [allData.profil],
  );

  const goBack = () => setStep((s) => (s === 0 ? s : ((s - 1) as 0 | 1)));

  const nextFromUtilisateur = (data: Partial<Utilisateur>) => {
    setAllData((prev) => ({ ...prev, utilisateur: data }));
    setCompleted((currentState) => ({ ...currentState, 0: true }));
    setStep(1);
  };

  const finishFromProfil = async (data: Partial<Profil>) => {
    const finalData: WizardDataUserPersonnel = { ...allData, profil: data };

    setAllData(finalData);
    setCompleted((currentState) => ({ ...currentState, 1: true }));
    setLoading(true);
    setSubmitMessage("");
    setOpenConfirmationPopup(true);

    try {
      if (!finalData.etablissement_id || !finalData.role_id) {
        throw new Error("Le lien de creation est incomplet.");
      }

      const utilisateurService = new UtilisateurService();
      const createResult = await utilisateurService.createAccountFromLink({
        etablissement_id: finalData.etablissement_id,
        role_id: finalData.role_id,
        utilisateur: {
          email: finalData.utilisateur?.email ?? null,
          telephone: finalData.utilisateur?.telephone ?? null,
          mot_de_passe_hash: finalData.utilisateur?.mot_de_passe_hash ?? null,
        },
        profil: {
          prenom: finalData.profil?.prenom ?? "",
          nom: finalData.profil?.nom ?? "",
          date_naissance: finalData.profil?.date_naissance ?? null,
          genre: finalData.profil?.genre ?? null,
          adresse: finalData.profil?.adresse ?? null,
        },
      });

      if (!createResult?.status.success) {
        throw new Error("La creation du compte a echoue.");
      }

      setSubmitMessage(
        shouldCreateEnseignant
          ? "Compte, personnel et profil enseignant crees avec succes. Vous pouvez maintenant vous connecter."
          : shouldCreatePersonnel
            ? "Compte et personnel crees avec succes. Vous pouvez maintenant vous connecter."
            : "Compte cree avec succes. Vous pouvez maintenant vous connecter.",
      );
    } catch (error) {
      console.log("Erreur creation compte depuis lien :", error);
      setSubmitMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setAllData({
      role_id,
      etablissement_id,
      etablissement: etablissement_id ? { id: etablissement_id } : undefined,
      utilisateur: undefined,
      profil: undefined,
    });
    setCompleted({});
    setStep(0);
    setSubmitMessage("");
    setOpenConfirmationPopup(false);
  };

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(180deg, rgba(59,130,246,.06) 0%, rgba(255,255,255,1) 220px)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "28px 18px 90px",
            display: "grid",
            gridTemplateColumns: "320px 1fr",
            gap: 18,
          }}
        >
          <aside
            style={{
              position: "sticky",
              top: 18,
              alignSelf: "start",
              border: "1px solid rgba(0,0,0,.08)",
              borderRadius: 14,
              background: "white",
              padding: 14,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 16 }}>Creation de compte</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Le role et l'etablissement sont fournis par le lien.
              </div>

              <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
                <b>role</b> : {roleName || "Non determine"} <br />
                <b>role_id</b> : {role_id ?? "-"} <br />
                <b>etablissement_id</b> : {etablissement_id ?? "-"}
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  opacity: 0.7,
                }}
              >
                <span>Progression</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "rgba(0,0,0,.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: "rgba(59,130,246,1)",
                  }}
                />
              </div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
              {completed[0]
                ? "✓ Utilisateur renseigne"
                : "• Utilisateur a completer"}
              <br />
              {completed[1] ? "✓ Profil renseigne" : "• Profil a completer"}
              <br />
              {shouldCreatePersonnel
                ? "✓ Un personnel sera cree automatiquement"
                : "• Aucun personnel supplementaire prevu"}
              <br />
              {shouldCreateEnseignant
                ? "✓ Un enseignant sera cree automatiquement"
                : "• Aucun profil enseignant prevu"}
            </div>

            {(completed[0] || completed[1]) && (
              <button
                type="button"
                onClick={resetAll}
                className="cursor-pointer rounded bg-gray-100 px-3 py-2 font-bold text-black hover:bg-gray-200"
                style={{ justifySelf: "start", fontSize: 13 }}
              >
                Reinitialiser
              </button>
            )}
          </aside>

          <main
            style={{
              border: "1px solid rgba(0,0,0,.08)",
              borderRadius: 14,
              background: "white",
              padding: 18,
              gap: 14,
            }}
          >
            <header style={{ display: "grid", gap: 6 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 18 }}>{current.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{current.desc}</div>
                </div>

                <button
                  type="button"
                  onClick={goBack}
                  disabled={step === 0}
                  className="cursor-pointer rounded bg-gray-100 px-3 py-2 font-bold text-black hover:bg-gray-200"
                  style={{ opacity: step === 0 ? 0.5 : 1 }}
                >
                  ← Retour
                </button>
              </div>
            </header>

            <div style={{ marginTop: 20 }}>
              {step === 0 && (
                <Form
                  schema={utilisateurSchema}
                  fields={utilisateurField}
                  initialValues={utilisateurInitialValues}
                  dataOnly={nextFromUtilisateur}
                  labelMessage={"Utilisateur"}
                />
              )}

              {step === 1 && (
                <Form
                  schema={profileSchema}
                  fields={profileField}
                  initialValues={profilInitialValues}
                  dataOnly={finishFromProfil}
                  labelMessage={"Profil"}
                />
              )}
            </div>
          </main>
        </div>

        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            borderTop: "1px solid rgba(0,0,0,.08)",
            background: "rgba(255,255,255,.92)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              padding: "12px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Etape <b>{step + 1}</b> sur <b>{steps.length}</b>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="cursor-pointer rounded bg-gray-100 px-4 py-2 font-bold text-black hover:bg-gray-200"
                style={{ opacity: step === 0 ? 0.5 : 1 }}
              >
                Retour
              </button>

              <a
                style={{
                  background: styles.color.primary,
                  color: "white",
                }}
                href="/login"
                className="cursor-pointer rounded px-4 py-2"
              >
                Connexion
              </a>

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(59,130,246,.06)",
                  border: "1px solid rgba(59,130,246,.2)",
                  fontSize: 12,
                  opacity: 0.85,
                }}
              >
                Cliquez sur <b>Enregistrer</b> pour continuer.
              </div>
            </div>
          </div>
        </div>
      </div>

      <FlyPopup
        isOpen={openConfirmationPopup}
        setIsOpen={setOpenConfirmationPopup}
      >
        {loading && <Spin size={100} />}
        {!loading && submitMessage && (
          <div
            style={{ fontSize: 16, textAlign: "center" }}
            className="flex flex-col items-center gap-6"
          >
            <div>{submitMessage}</div>
            <a href="/login">
              <span style={{ color: "blue" }}>Se connecter</span>
            </a>
          </div>
        )}
      </FlyPopup>
    </>
  );
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null
  ) {
    const response = error.response as {
      data?: {
        message?: string;
        status?: { message?: string };
      };
    };

    if (response.data?.status?.message) {
      return response.data.status.message;
    }

    if (response.data?.message) {
      return response.data.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Une erreur est survenue lors de la creation du compte.";
}
