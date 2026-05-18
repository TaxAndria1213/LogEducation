import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiClock, FiTrash2 } from "react-icons/fi";
import ERPPage from "../../../components/page/ERPPage";
import { useInfo } from "../../../hooks/useInfo";
import EnrollmentDraftService, {
  type EnrollmentDraftPayload,
} from "../../../services/enrollmentDraft.service";
import InscriptionForm from "./components/form/InscriptionForm";

type DraftRecord = EnrollmentDraftPayload & {
  id: string;
  status: string;
  current_step: number;
  completion_rate?: number | string | null;
  missing_fields?: string[] | null;
  updated_at?: string | null;
  annee?: { nom?: string | null } | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function getSaveLabel(state: SaveState, lastSavedAt: Date | null) {
  switch (state) {
    case "saving":
      return "Sauvegarde en cours...";
    case "saved":
      return lastSavedAt
        ? `Derniere sauvegarde : ${new Intl.DateTimeFormat("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(lastSavedAt)}`
        : "Brouillon sauvegarde";
    case "error":
      return "Erreur lors de la sauvegarde";
    default:
      return "Brouillon charge";
  }
}

function extractInscriptionId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;
  const inscription = record.inscription;
  if (inscription && typeof inscription === "object") {
    const id = (inscription as Record<string, unknown>).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export default function EnrollmentDraftFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { info } = useInfo();
  const service = useMemo(() => new EnrollmentDraftService(), []);
  const [draft, setDraft] = useState<DraftRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const loadDraft = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await service.getOne(id);
      setDraft(result.data as DraftRecord);
      setSaveState("saved");
    } catch (error) {
      console.error(error);
      info("Brouillon introuvable.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDraft();
  }, [id]);

  const handleAutosave = async (payload: EnrollmentDraftPayload) => {
    if (!id) return;
    setSaveState("saving");
    try {
      const result = await service.autosave(id, payload);
      setDraft(result.data as DraftRecord);
      setSaveState("saved");
      setLastSavedAt(new Date());
    } catch (error) {
      console.error(error);
      setSaveState("error");
    }
  };

  const handleFinalize = async (payload: EnrollmentDraftPayload) => {
    if (!id) throw new Error("Brouillon introuvable.");
    await service.updateDraft(id, payload);
    const result = await service.prepareSubmit(id);
    const inscriptionId = extractInscriptionId(result.data.inscription ?? result.data.result);

    if (!inscriptionId) {
      throw new Error("Inscription creee, mais son identifiant est introuvable.");
    }

    info(
      draft?.draft_type === "RE_ENROLLMENT"
        ? "Reinscription finalisee avec succes."
        : "Inscription finalisee avec succes.",
      "success",
    );
    return inscriptionId;
  };

  const handleDelete = async () => {
    if (!id) return;
    const confirmed = window.confirm("Voulez-vous vraiment supprimer ce brouillon ? Cette action est irreversible.");
    if (!confirmed) return;
    try {
      await service.deleteDraft(id);
      info("Brouillon supprime avec succes.", "success");
      navigate("/scolarite/inscriptions/brouillons");
    } catch (error) {
      console.error(error);
      info("Impossible de supprimer le brouillon.", "error");
    }
  };

  return (
    <ERPPage
      title="Brouillon d'inscription"
      description="Formulaire guide avec sauvegarde progressive."
      backButton={{ to: "/scolarite/inscriptions/brouillons", label: "Retour aux brouillons" }}
      headerActions={[
        <button
          key="delete"
          type="button"
          onClick={() => void handleDelete()}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm font-semibold text-rose-600 shadow-sm hover:bg-rose-50"
        >
          <FiTrash2 />
          Supprimer
        </button>,
      ]}
    >
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Chargement du brouillon...
        </div>
      ) : !draft ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          Brouillon introuvable.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm">
            <div>
              <p className="font-semibold text-slate-900">
                {draft.draft_type === "RE_ENROLLMENT" ? "Brouillon de reinscription" : "Brouillon d'inscription"}
              </p>
              <p className="text-slate-500">
                Annee : {draft.annee?.nom ?? "-"} | Statut : {draft.status} | Progression : {Number(draft.completion_rate ?? 0).toFixed(0)}%
              </p>
            </div>
            <p className="inline-flex items-center gap-2 font-semibold text-slate-700">
              <FiClock className="text-slate-400" />
              {getSaveLabel(saveState, lastSavedAt)}
            </p>
          </div>

          <InscriptionForm
            draft={draft}
            onDraftAutosave={handleAutosave}
            onDraftFinalize={handleFinalize}
          />
        </div>
      )}
    </ERPPage>
  );
}
