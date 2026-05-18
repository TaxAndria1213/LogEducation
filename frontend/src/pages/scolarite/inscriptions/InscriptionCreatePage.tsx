import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ERPPage from "../../../components/page/ERPPage";
import { useAuth } from "../../../hooks/useAuth";
import { useInfo } from "../../../hooks/useInfo";
import EnrollmentDraftService from "../../../services/enrollmentDraft.service";

export default function InscriptionCreatePage() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const navigate = useNavigate();
  const service = useMemo(() => new EnrollmentDraftService(), []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const createDraft = async () => {
      if (!etablissement_id) return;
      try {
        const result = await service.create({
          etablissement_id,
          draft_type: "NEW_ENROLLMENT",
          current_step: 1,
        });
        if (!active) return;
        navigate(`/scolarite/inscriptions/brouillons/${result.data.id}`, {
          replace: true,
        });
      } catch (err) {
        console.error(err);
        if (!active) return;
        setError("Impossible de creer le brouillon d'inscription.");
        info("Impossible de creer le brouillon d'inscription.", "error");
      }
    };

    void createDraft();

    return () => {
      active = false;
    };
  }, [etablissement_id, info, navigate, service]);

  return (
    <ERPPage
      title="Nouvelle inscription"
      description="Creation du brouillon d'inscription."
      backButton={{ to: "/scolarite/inscriptions", label: "Retour aux inscriptions" }}
    >
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        {error ?? "Creation du brouillon en cours..."}
      </div>
    </ERPPage>
  );
}
