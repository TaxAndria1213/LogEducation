import { useEffect, useMemo, useState } from "react";
import { FiMapPin, FiSettings, FiTruck, FiUsers } from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import LigneTransportService from "../../../../../services/ligneTransport.service";
import ArretTransportService from "../../../../../services/arretTransport.service";
import AbonnementTransportService, { type AbonnementTransportWithRelations } from "../../../../../services/abonnementTransport.service";
import {
  getCatalogueFraisSecondaryLabel,
  type CatalogueFraisWithRelations,
} from "../../../../../services/catalogueFrais.service";
import type { ArretTransport, LigneTransport } from "../../../../../types/models";

type Props = { mode?: "overview" | "settings" };

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") return error.response.data.message;
  return "Impossible de charger le module transport.";
}

export default function TransportOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [lignes, setLignes] = useState<LigneTransport[]>([]);
  const [arrets, setArrets] = useState<ArretTransport[]>([]);
  const [abonnements, setAbonnements] = useState<AbonnementTransportWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      if (active) setLoading(true);
      try {
        const [lignesResult, arretsResult, abonnementsResult] = await Promise.all([
          new LigneTransportService().getForEtablissement(etablissement_id, {
            take: 300,
            includeSpec: JSON.stringify({ arrets: true, frais: true }),
          }),
          new ArretTransportService().getForEtablissement(etablissement_id, { take: 500, includeSpec: JSON.stringify({ ligne: true }) }),
          new AbonnementTransportService().getForEtablissement(etablissement_id, { take: 500, includeSpec: JSON.stringify({ eleve: { include: { utilisateur: { include: { profil: true } } } }, annee: true, ligne: true, arret: true }) }),
        ]);
        if (!active) return;
        setLignes(lignesResult?.status.success ? lignesResult.data.data : []);
        setArrets(arretsResult?.status.success ? arretsResult.data.data : []);
        setAbonnements(abonnementsResult?.status.success ? abonnementsResult.data.data : []);
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const activeSubscriptions = useMemo(
    () => abonnements.filter((item) => (item.statut ?? "ACTIF").toUpperCase() === "ACTIF").length,
    [abonnements],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Transport scolaire</h2>
        <p className="mt-2 text-sm text-slate-500">
          {mode === "settings"
            ? "Le module suit les lignes, les arrets et les abonnements ouverts par eleve."
            : "Vue d'ensemble du reseau de transport et des abonnements actifs."}
        </p>
        {errorMessage ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}
        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Spin label="Chargement des donnees transport..." showLabel />
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiTruck /><span className="text-sm font-medium">Lignes</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{lignes.length}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiMapPin /><span className="text-sm font-medium">Arrets</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{arrets.length}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiUsers /><span className="text-sm font-medium">Abonnements</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{abonnements.length}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiUsers /><span className="text-sm font-medium">Actifs</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{activeSubscriptions}</p></div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr,1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Lignes recentes</h3>
          <div className="mt-5 space-y-3">
            {lignes.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{item.nom}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.frais
                    ? `${item.frais.nom} - ${getCatalogueFraisSecondaryLabel(item.frais as CatalogueFraisWithRelations)}`
                    : "Aucun frais catalogue relie"}
                </p>
              </div>
            ))}
            {lignes.length === 0 ? <p className="text-sm text-slate-500">Aucune ligne enregistree.</p> : null}
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          {mode === "settings" ? (
            <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><FiSettings /></div><div><h3 className="text-lg font-semibold text-slate-900">Parametres</h3><p className="text-sm text-slate-500">Un abonnement transport est lie a un eleve, une annee scolaire, une ligne et optionnellement un arret.</p></div></div>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-slate-900">Abonnements recents</h3>
              <div className="mt-5 space-y-3">
                {abonnements.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">{item.eleve?.utilisateur?.profil?.prenom} {item.eleve?.utilisateur?.profil?.nom}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.ligne?.nom} {item.arret?.nom ? `- ${item.arret.nom}` : ""}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
