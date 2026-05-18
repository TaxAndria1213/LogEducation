import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiEdit3, FiFileText, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import ERPPage from "../../../components/page/ERPPage";
import { useAuth } from "../../../hooks/useAuth";
import { useInfo } from "../../../hooks/useInfo";
import EnrollmentDraftService, {
  type EnrollmentDraftStatus,
  type EnrollmentDraftType,
} from "../../../services/enrollmentDraft.service";

type DraftRecord = {
  id: string;
  draft_type: EnrollmentDraftType;
  status: EnrollmentDraftStatus;
  current_step: number;
  student_data?: Record<string, unknown> | null;
  schooling_data?: Record<string, unknown> | null;
  guardians_data?: Record<string, unknown> | null;
  completion_rate?: number | string | null;
  created_at: string;
  updated_at: string;
  annee?: { nom?: string | null } | null;
  createur?: {
    profil?: { prenom?: string | null; nom?: string | null } | null;
    email?: string | null;
  } | null;
};

const statusLabels: Record<EnrollmentDraftStatus, string> = {
  DRAFT: "Brouillon",
  IN_PROGRESS: "En cours",
  READY_TO_SUBMIT: "Pret",
  SUBMITTED: "Finalise",
  EXPIRED: "Expire",
  DELETED: "Supprime",
};

const typeLabels: Record<EnrollmentDraftType, string> = {
  NEW_ENROLLMENT: "Inscription",
  RE_ENROLLMENT: "Reinscription",
  TRANSFER: "Transfert",
  PRE_ENROLLMENT: "Preinscription",
};

function getStatusClasses(status: EnrollmentDraftStatus) {
  switch (status) {
    case "READY_TO_SUBMIT":
      return "bg-emerald-50 text-emerald-700";
    case "IN_PROGRESS":
      return "bg-sky-50 text-sky-700";
    case "SUBMITTED":
      return "bg-slate-100 text-slate-700";
    case "EXPIRED":
      return "bg-amber-50 text-amber-700";
    case "DELETED":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-slate-50 text-slate-600";
  }
}

function getStudentName(draft: DraftRecord) {
  const prenom = String(draft.student_data?.prenom ?? draft.student_data?.first_name ?? "").trim();
  const nom = String(draft.student_data?.nom ?? draft.student_data?.last_name ?? "").trim();
  const fullName = [prenom, nom].filter(Boolean).join(" ");
  return fullName || "Eleve non renseigne";
}

function getGuardianLabel(draft: DraftRecord) {
  const items = Array.isArray(draft.guardians_data?.items)
    ? (draft.guardians_data.items as Array<Record<string, unknown>>)
    : Array.isArray(draft.guardians_data?.tuteurs)
      ? (draft.guardians_data.tuteurs as Array<Record<string, unknown>>)
      : [];
  const first = items[0];
  if (!first) return "-";
  return String(first.nom_complet ?? first.nom ?? first.name ?? "-");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function EnrollmentDraftListPage() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const navigate = useNavigate();
  const service = useMemo(() => new EnrollmentDraftService(), []);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDrafts = async () => {
    if (!etablissement_id) return;
    setLoading(true);
    try {
      const result = await service.getAll({
        page: 1,
        take: 100,
        where: JSON.stringify({
          etablissement_id,
          status: { not: "DELETED" },
        }),
        orderBy: JSON.stringify([{ updated_at: "desc" }]),
      });
      setDrafts(result?.data?.data ?? []);
    } catch (error) {
      console.error(error);
      info("Impossible de charger les brouillons.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDrafts();
  }, [etablissement_id]);

  const handleDelete = async (draft: DraftRecord) => {
    const confirmed = window.confirm("Voulez-vous vraiment supprimer ce brouillon ? Cette action est irreversible.");
    if (!confirmed) return;
    try {
      await service.deleteDraft(draft.id);
      info("Brouillon supprimé avec succès.", "success");
      await loadDrafts();
    } catch (error) {
      console.error(error);
      info("Impossible de supprimer le brouillon.", "error");
    }
  };

  return (
    <ERPPage
      title="Brouillons d'inscription"
      description="Reprendre, modifier ou preparer la finalisation des inscriptions non terminees."
      backButton={{ to: "/scolarite/inscriptions", label: "Retour aux inscriptions" }}
      headerActions={[
        <button
          key="refresh"
          type="button"
          onClick={() => void loadDrafts()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <FiRefreshCw />
          Actualiser
        </button>,
      ]}
    >
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{drafts.length} brouillon(s)</h2>
          <p className="text-sm text-slate-500">Les brouillons sont lies a l'annee scolaire courante au moment de leur creation.</p>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Chargement des brouillons...</div>
        ) : drafts.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <FiFileText className="mb-3 text-3xl text-slate-300" />
            <p className="font-semibold text-slate-800">Aucun brouillon trouve</p>
            <p className="mt-1 text-sm text-slate-500">Commence une nouvelle inscription pour creer un brouillon automatiquement.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Eleve</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Annee</th>
                  <th className="px-5 py-3">Responsable</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Progression</th>
                  <th className="px-5 py-3">Modifie le</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drafts.map((draft) => (
                  <tr key={draft.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 font-medium text-slate-900">{getStudentName(draft)}</td>
                    <td className="px-5 py-4 text-slate-600">{typeLabels[draft.draft_type]}</td>
                    <td className="px-5 py-4 text-slate-600">{draft.annee?.nom ?? "-"}</td>
                    <td className="px-5 py-4 text-slate-600">{getGuardianLabel(draft)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(draft.status)}`}>
                        {statusLabels[draft.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{Number(draft.completion_rate ?? 0).toFixed(0)}%</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(draft.updated_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          aria-label="Reprendre le brouillon"
                          title="Reprendre"
                          onClick={() => navigate(`/scolarite/inscriptions/brouillons/${draft.id}`)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          <FiEdit3 />
                        </button>
                        <button
                          type="button"
                          aria-label="Supprimer le brouillon"
                          title="Supprimer"
                          onClick={() => void handleDelete(draft)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 text-rose-600 hover:bg-rose-50"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ERPPage>
  );
}
