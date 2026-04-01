import { useEffect, useMemo, useState } from "react";
import { FiCoffee, FiSettings, FiUsers } from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import FormuleCantineService from "../../../../../services/formuleCantine.service";
import AbonnementCantineService, { type AbonnementCantineWithRelations } from "../../../../../services/abonnementCantine.service";
import {
  getCatalogueFraisSecondaryLabel,
  type CatalogueFraisWithRelations,
} from "../../../../../services/catalogueFrais.service";
import type { FormuleCantine } from "../../../../../types/models";

type Props = { mode?: "overview" | "settings" };

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") return error.response.data.message;
  return "Impossible de charger le module cantine.";
}

export default function CantineOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [formules, setFormules] = useState<FormuleCantine[]>([]);
  const [abonnements, setAbonnements] = useState<AbonnementCantineWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      if (active) setLoading(true);
      try {
        const [formulesResult, abonnementsResult] = await Promise.all([
          new FormuleCantineService().getForEtablissement(etablissement_id, {
            take: 300,
            includeSpec: JSON.stringify({ frais: true }),
          }),
          new AbonnementCantineService().getForEtablissement(etablissement_id, { take: 500, includeSpec: JSON.stringify({ eleve: { include: { utilisateur: { include: { profil: true } } } }, annee: true, formule: true }) }),
        ]);
        if (!active) return;
        setFormules(formulesResult?.status.success ? formulesResult.data.data : []);
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
        <h2 className="text-2xl font-semibold text-slate-900">Cantine scolaire</h2>
        <p className="mt-2 text-sm text-slate-500">
          {mode === "settings"
            ? "Le module suit les formules et les abonnements cantine attaches aux eleves."
            : "Vue d'ensemble des formules de cantine et des eleves abonnes."}
        </p>
        {errorMessage ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}
        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Spin label="Chargement des donnees cantine..." showLabel />
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiCoffee /><span className="text-sm font-medium">Formules</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{formules.length}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiUsers /><span className="text-sm font-medium">Abonnements</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{abonnements.length}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiUsers /><span className="text-sm font-medium">Actifs</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{activeSubscriptions}</p></div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Formules recentes</h3>
          <div className="mt-5 space-y-3">
            {formules.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{item.nom}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.frais
                    ? `${item.frais.nom} - ${getCatalogueFraisSecondaryLabel(item.frais as CatalogueFraisWithRelations)}`
                    : "Aucun frais catalogue relie"}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          {mode === "settings" ? (
            <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><FiSettings /></div><div><h3 className="text-lg font-semibold text-slate-900">Parametres</h3><p className="text-sm text-slate-500">Un abonnement cantine est lie a un eleve, une annee scolaire et une formule de cantine.</p></div></div>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-slate-900">Abonnements recents</h3>
              <div className="mt-5 space-y-3">
                {abonnements.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">{item.eleve?.utilisateur?.profil?.prenom} {item.eleve?.utilisateur?.profil?.nom}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.formule?.nom}</p>
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
