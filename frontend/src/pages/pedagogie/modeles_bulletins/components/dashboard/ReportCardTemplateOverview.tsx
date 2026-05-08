import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiFileText, FiLayers, FiTarget } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import anneeScolaireService from "../../../../../services/anneeScolaire.service";
import ReportCardTemplateService, {
  getReportCardTemplateTypeLabel,
  type ReportCardTemplateWithRelations,
} from "../../../../../services/reportCardTemplate.service";
import type { AnneeScolaire } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
};

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

  return "Impossible de charger les modeles de bulletin.";
}

function ReportCardTemplateOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [items, setItems] = useState<ReportCardTemplateWithRelations[]>([]);
  const [currentYear, setCurrentYear] = useState<AnneeScolaire | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!etablissement_id) {
        setItems([]);
        setCurrentYear(null);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new ReportCardTemplateService();
        const [result, activeYear] = await Promise.all([
          service.getForEtablissement(etablissement_id, {
            page: 1,
            take: 100,
            includeSpec: JSON.stringify({
              annee: true,
              niveau: true,
              bulletins: true,
            }),
          }),
          anneeScolaireService.getCurrent(etablissement_id),
        ]);

        if (!active) return;
        setItems(
          result?.status.success
            ? ((result.data.data as ReportCardTemplateWithRelations[]) ?? [])
            : [],
        );
        setCurrentYear((activeYear as AnneeScolaire | null) ?? null);
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const activeItems = useMemo(() => items.filter((item) => item.is_active).length, [items]);
  const defaultItems = useMemo(() => items.filter((item) => item.is_default).length, [items]);
  const detailedItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.template_type === "DETAILED" ||
          item.template_type === "ASSESSMENT_TYPE_SUMMARY" ||
          item.template_type === "FINAL_EXAM_ONLY",
      ).length,
    [items],
  );

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Chargement...
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiFileText />
            <span className="text-sm font-medium">Modeles</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{items.length}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCheckCircle />
            <span className="text-sm font-medium">Actifs</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{activeItems}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiTarget />
            <span className="text-sm font-medium">Par defaut</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{defaultItems}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Affichage detaille</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{detailedItems}</p>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Annee courante</h3>
        <p className="mt-2 text-sm text-slate-600">
          {currentYear?.nom ?? "Aucune annee scolaire courante definie."}
        </p>
      </section>

      {mode === "settings" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Gouvernance de l'affichage</h3>
          <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
            <p>L'initialisation pose le modele par defaut et les grands reglages de l'annee.</p>
            <p className="mt-2">
              Cet ecran sert ensuite a faire vivre plusieurs variantes de bulletin sans toucher
              aux notes de calcul elles-memes.
            </p>
            <p className="mt-2">
              Le backend conserve un seul modele par defaut sur l'annee courante pour eviter les
              incoherences de publication.
            </p>
            <p className="mt-2">
              Types utilises:{" "}
              {Array.from(
                new Set(items.map((item) => getReportCardTemplateTypeLabel(item.template_type))),
              ).join(", ") || "Aucun"}.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default ReportCardTemplateOverview;
