/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Form } from "../../components/Form/Form";
import {
  ProfilSchema,
  UtilisateurSchema,
  type Utilisateur,
} from "../../generated/zod";
import {
  etablissementFields,
  etablissementSchema,
} from "../etablissement/profileEtablissement/components/form/schema/EtablissementSchemas";
import { getFieldsFromZodObjectSchema } from "../../components/Form/fields";
import UtilisateurService from "../../services/utilisateur.service";
import FlyPopup from "../../components/popup/FlyPopup";
import Spin from "../../components/anim/Spin";
import { styles } from "../../styles/styles";

type WizardData = {
  etablissement?: any;
  utilisateur?: any;
  profil?: any;
};

const steps = [
  {
    key: "etablissement",
    title: "Ã‰tablissement",
    desc: "Infos de lâ€™organisation",
  },
  { key: "utilisateur", title: "Utilisateur", desc: "Compte de connexion" },
  { key: "profil", title: "Profil", desc: "Informations personnelles" },
] as const;

export default function CreateAccount() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [allData, setAllData] = useState<WizardData>({});
  const [loading, setLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string>("");
  const [openConfirmationPopup, setOpenConfirmationPopup] = useState(false);
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

  // ---------- schemas/fields ----------
  const utilisateurField = useMemo(
    () =>
      getFieldsFromZodObjectSchema(UtilisateurSchema, {
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
          telephone: "TÃ©lÃ©phone",
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

  // ---------- computed ----------
  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);
  const current = steps[step];

  const canJumpTo = (s: 0 | 1 | 2) => s <= step || !!completed[s];

  // ---------- navigation ----------
  const goBack = () => setStep((s) => (s === 0 ? s : ((s - 1) as any)));
  const jumpTo = (s: 0 | 1 | 2) => {
    if (canJumpTo(s)) setStep(s);
  };

  // ---------- handlers ----------
  const nextFromEtablissement = (data: any) => {
    setAllData((prev) => ({ ...prev, etablissement: data }));
    setCompleted((c) => ({ ...c, 0: true }));
    setStep(1);
  };

  const nextFromUtilisateur = (data: any) => {
    setAllData((prev) => ({ ...prev, utilisateur: data }));
    setCompleted((c) => ({ ...c, 1: true }));
    setStep(2);
  };

  const finishFromProfil = async (data: any) => {
    const finalData: WizardData = { ...allData, profil: data };
    setLoading(true);
    setOpenConfirmationPopup(true);
    setAllData(finalData);
    setCompleted((c) => ({ ...c, 2: true }));

    // âœ… Ici: un seul objet final
    console.log("âœ… DONNÃ‰ES FINALES :", finalData);
    const dataToSend: Pick<
      Utilisateur,
      "email" | "mot_de_passe_hash" | "telephone" | "statut" | "scope_json"
    > = {
      email: finalData.utilisateur.email,
      mot_de_passe_hash: finalData.utilisateur.mot_de_passe_hash,
      telephone: finalData.utilisateur.telephone || null,
      statut: "INACTIF",
      scope_json: JSON.stringify({
        option: "En attente de validation",
        data: finalData,
      }),
    };
    // Exemple : ouvrir une page de confirmation / dÃ©clencher un call API
    const service = new UtilisateurService();
    const result = await service.createDirectionAccount(dataToSend);
    if (result?.status.success === true) {
      setLoading(false);
      setSubmitMessage(
        "Compte crÃ©Ã© avec succÃ¨s ! Un administrateur doit encore lâ€™activer.",
      );
    } else {
      setSubmitMessage(
        "Une erreur est survenue lors de la crÃ©ation du compte.",
      );
    }
  };

  const resetAll = () => {
    setAllData({});
    setCompleted({});
    setStep(0);
  };

  // ---------- UI helpers ----------
  const StepDot = ({
    index,
    title,
    desc,
  }: {
    index: 0 | 1 | 2;
    title: string;
    desc: string;
  }) => {
    const isActive = step === index;
    const isDone = !!completed[index];
    const enabled = canJumpTo(index);

    return (
      <button
        type="button"
        onClick={() => jumpTo(index)}
        disabled={!enabled}
        style={{
          all: "unset",
          cursor: enabled ? "pointer" : "not-allowed",
          opacity: enabled ? 1 : 0.5,
          display: "grid",
          gridTemplateColumns: "24px 1fr",
          gap: 10,
          alignItems: "start",
          padding: "10px 12px",
          borderRadius: 10,
          border: isActive
            ? "1px solid rgba(59,130,246,.6)"
            : "1px solid rgba(0,0,0,.08)",
          background: isActive ? "rgba(59,130,246,.06)" : "white",
        }}
        aria-current={isActive ? "step" : undefined}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            border: isActive
              ? "2px solid rgba(59,130,246,1)"
              : "2px solid rgba(0,0,0,.15)",
            background: isDone ? "rgba(34,197,94,.12)" : "transparent",
            fontSize: 12,
          }}
        >
          {isDone ? "âœ“" : index + 1}
        </div>

        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{desc}</div>
        </div>
      </button>
    );
  };

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          background:
            "#f8fafc",
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
          {/* LEFT: Stepper / progress */}
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
              <div style={{ fontSize: 16 }}>
                CrÃ©ation de compte
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                ComplÃ©tez les Ã©tapes. Vous pouvez revenir en arriÃ¨re Ã  tout
                moment.
              </div>
            </div>

            {/* progress bar */}
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

            <div style={{ display: "grid", gap: 10 }}>
              <StepDot index={0} title={steps[0].title} desc={steps[0].desc} />
              <StepDot index={1} title={steps[1].title} desc={steps[1].desc} />
              <StepDot index={2} title={steps[2].title} desc={steps[2].desc} />
            </div>

            {/* quick summary */}
            <div
              style={{
                borderTop: "1px solid rgba(0,0,0,.08)",
                paddingTop: 10,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 13 }}>RÃ©sumÃ©</div>
              <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
                {completed[0]
                  ? "âœ“ Ã‰tablissement renseignÃ©"
                  : "â€¢ Ã‰tablissement Ã  complÃ©ter"}
                <br />
                {completed[1]
                  ? "âœ“ Utilisateur renseignÃ©"
                  : "â€¢ Utilisateur Ã  complÃ©ter"}
                <br />
                {completed[2] ? "âœ“ Profil renseignÃ©" : "â€¢ Profil Ã  complÃ©ter"}
              </div>

              {(completed[0] || completed[1] || completed[2]) && (
                <button
                  type="button"
                  onClick={resetAll}
                  className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-black font-bold py-2 px-3 rounded"
                  style={{ justifySelf: "start", fontSize: 13 }}
                >
                  RÃ©initialiser
                </button>
              )}
            </div>
          </aside>

          {/* RIGHT: Form card */}
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
                  <div style={{ fontSize: 18 }}>
                    {current.title}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {current.desc}
                  </div>
                </div>

                {/* back button top-right */}
                <button
                  type="button"
                  onClick={goBack}
                  disabled={step === 0}
                  className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-black font-bold py-2 px-3 rounded"
                  style={{ opacity: step === 0 ? 0.5 : 1 }}
                >
                  â† Retour
                </button>
              </div>
            </header>

            <div style={{ marginTop: 20 }}>
              {/* form */}
              {step === 0 && (
                <Form
                  schema={etablissementSchema}
                  fields={etablissementFields}
                  initialValues={etablissementInitialValues}
                  dataOnly={nextFromEtablissement}
                  labelMessage={"Etablissement"}
                />
              )}

              {step === 1 && (
                <Form
                  schema={utilisateurSchema}
                  fields={utilisateurField}
                  initialValues={utilisateurInitialValues}
                  dataOnly={nextFromUtilisateur}
                  labelMessage={"Utilisateur"}
                />
              )}

              {step === 2 && (
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

        {/* Sticky footer actions (SaaS style) */}
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
              Ã‰tape <b>{step + 1}</b> sur <b>{steps.length}</b>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-black font-bold py-2 px-4 rounded"
                style={{ opacity: step === 0 ? 0.5 : 1 }}
              >
                Retour
              </button>

              {/* bouton de navigation vers la page connexion */}
              <a
                style={{
                  background: styles.color.primary,
                  color: "white",
                }}
                href="/login"
                className={`cursor-pointer hover:bg-gray-200 py-2 px-4 rounded`}
              >
                Connexion
              </a>

              {/* CTA hint: lâ€™action â€œSuivantâ€ est le submit du Form */}
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
                Cliquez sur <b>Enregistrer</b> pour passer Ã  lâ€™Ã©tape suivante.
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
        {submitMessage && (
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
