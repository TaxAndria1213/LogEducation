import { useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiCoffee, FiUsers } from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import FormuleCantineService from "../../../../../services/formuleCantine.service";
import AbonnementCantineService, {
  type AbonnementCantineWithRelations,
} from "../../../../../services/abonnementCantine.service";
import {
  getCatalogueFraisSecondaryLabel,
  type CatalogueFraisWithRelations,
} from "../../../../../services/catalogueFrais.service";
import type { FormuleCantine } from "../../../../../types/models";

type Props = { mode?: "overview" | "settings" };

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
          new AbonnementCantineService().getForEtablissement(etablissement_id, {
            take: 500,
            includeSpec: JSON.stringify({
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              formule: true,
            }),
          }),
        ]);
        if (!active) return;
        setFormules(formulesResult?.status.success ? formulesResult.data.data : []);
        setAbonnements(abonnementsResult?.status.success ? abonnementsResult.data.data : []);
        setErrorMessage("");
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
  const pendingFinance = useMemo(
    () =>
      abonnements.filter(
        (item) =>
          ["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"].includes(
            (item.finance_status ?? item.statut ?? "").toUpperCase(),
          ),
      ).length,
    [abonnements],
  );
  const suspendedServices = useMemo(
    () => abonnements.filter((item) => (item.statut ?? "ACTIF").toUpperCase() === "SUSPENDU").length,
    [abonnements],
  );

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Spin label="Chargement des donnees cantine..." showLabel />
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCoffee />
            <span className="text-sm font-medium">Formules</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formules.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Services eleves</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{abonnements.length}</p>
        </div>

        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-3 text-amber-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">A regulariser</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-amber-950">{pendingFinance}</p>
          <p className="mt-2 text-xs text-amber-800">Services actifs sans facture rattachee.</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Suspendus</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{suspendedServices}</p>
          <p className="mt-2 text-xs text-slate-500">{activeSubscriptions} service(s) actif(s)</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Formules recentes</h3>
          <div className="mt-5 space-y-3">
            {formules.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <p className="text-sm font-semibold text-slate-900">{item.nom}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.frais
                    ? `${item.frais.nom} - ${getCatalogueFraisSecondaryLabel(item.frais as CatalogueFraisWithRelations)}`
                    : "Aucun frais catalogue relie"}
                </p>
              </div>
            ))}
            {formules.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune formule enregistree.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          {mode === "settings" ? null : (
            <>
              <h3 className="text-lg font-semibold text-slate-900">Services cantine recents</h3>
              <div className="mt-5 space-y-3">
                {abonnements.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {item.eleve?.utilisateur?.profil?.prenom} {item.eleve?.utilisateur?.profil?.nom}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{item.formule?.nom}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.facture?.numero_facture
                        ? `Finance: ${item.facture.numero_facture} - ${item.finance_status ?? item.facture.statut ?? "EMISE"}`
                        : `Finance: ${item.finance_status ?? "EN_ATTENTE_VALIDATION_FINANCIERE"}`}
                    </p>
                  </div>
                ))}
                {abonnements.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun service cantine enregistre.</p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
