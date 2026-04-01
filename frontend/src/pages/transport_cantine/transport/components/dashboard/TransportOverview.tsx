import { useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiMapPin, FiTruck, FiUsers } from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import LigneTransportService from "../../../../../services/ligneTransport.service";
import ArretTransportService from "../../../../../services/arretTransport.service";
import AbonnementTransportService, {
  getAbonnementTransportDisplayLabel,
  getAbonnementTransportProrataLabel,
  type AbonnementTransportWithRelations,
} from "../../../../../services/abonnementTransport.service";
import {
  getCatalogueFraisSecondaryLabel,
  type CatalogueFraisWithRelations,
} from "../../../../../services/catalogueFrais.service";
import type { ArretTransport, LigneTransport } from "../../../../../types/models";

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
          new ArretTransportService().getForEtablissement(etablissement_id, {
            take: 500,
            includeSpec: JSON.stringify({ ligne: true }),
          }),
          new AbonnementTransportService().getForEtablissement(etablissement_id, {
            take: 500,
            includeSpec: JSON.stringify({
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              ligne: true,
              arret: true,
            }),
          }),
        ]);

        if (!active) return;
        setLignes(lignesResult?.status.success ? lignesResult.data.data : []);
        setArrets(arretsResult?.status.success ? arretsResult.data.data : []);
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
      abonnements.filter((item) =>
        ["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"].includes(
          (item.statut ?? "").toUpperCase(),
        ),
      ).length,
    [abonnements],
  );

  const activeWithoutFacture = useMemo(
    () =>
      abonnements.filter(
        (item) =>
          ["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"].includes(
            (item.statut ?? "").toUpperCase(),
          ) && !item.facture_id,
      ),
    [abonnements],
  );

  const suspendedWithFacture = useMemo(
    () =>
      abonnements.filter(
        (item) => (item.statut ?? "ACTIF").toUpperCase() === "SUSPENDU" && Boolean(item.facture_id),
      ),
    [abonnements],
  );

  const prorataSubscriptions = useMemo(
    () =>
      abonnements.filter((item) => {
        const ratio =
          typeof item.prorata_ratio === "number"
            ? item.prorata_ratio
            : Number(item.prorata_ratio ?? 0);
        return Number.isFinite(ratio) && ratio > 0 && ratio < 1;
      }),
    [abonnements],
  );

  const lineControlRows = useMemo(
    () =>
      lignes
        .map((line) => {
          const lineSubscriptions = abonnements.filter((item) => item.ligne_transport_id === line.id);
          const activeCount = lineSubscriptions.filter(
            (item) => (item.statut ?? "ACTIF").toUpperCase() === "ACTIF",
          ).length;
          const billedCount = lineSubscriptions.filter((item) => Boolean(item.facture_id)).length;
          return {
            id: line.id,
            nom: line.nom,
            activeCount,
            billedCount,
            gap: activeCount - billedCount,
          };
        })
        .sort((a, b) => b.gap - a.gap || b.activeCount - a.activeCount)
        .slice(0, 6),
    [abonnements, lignes],
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
          <Spin label="Chargement des donnees transport..." showLabel />
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiTruck />
            <span className="text-sm font-medium">Lignes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{lignes.length}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiMapPin />
            <span className="text-sm font-medium">Arrets</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{arrets.length}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Abonnements</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{abonnements.length}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Actifs</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{activeSubscriptions}</p>
          <p className="mt-2 text-xs text-slate-500">{pendingFinance} en attente Finance</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-3 text-amber-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">Actifs sans facture</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-amber-950">{activeWithoutFacture.length}</p>
          <p className="mt-2 text-xs text-amber-800">
            Eleves transportes a verifier cote facturation.
          </p>
        </div>

        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-center gap-3 text-rose-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">Suspendus avec facture</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-rose-950">{suspendedWithFacture.length}</p>
          <p className="mt-2 text-xs text-rose-800">
            Services bloques ayant encore un suivi financier actif.
          </p>
        </div>

        <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-center gap-3 text-sky-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">Prorata appliques</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-sky-950">{prorataSubscriptions.length}</p>
          <p className="mt-2 text-xs text-sky-800">
            Abonnements demarres ou arretes en cours de mois.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr,1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Lignes recentes</h3>
          <div className="mt-5 space-y-3">
            {lignes.slice(0, 6).map((item) => (
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
            {lignes.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune ligne enregistree.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          {mode === "settings" ? null : (
            <>
              <h3 className="text-lg font-semibold text-slate-900">Abonnements recents</h3>
              <div className="mt-5 space-y-3">
                {abonnements.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {item.eleve?.utilisateur?.profil?.prenom} {item.eleve?.utilisateur?.profil?.nom}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.ligne?.nom} {item.arret?.nom ? `- ${item.arret.nom}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {getAbonnementTransportProrataLabel(item)}
                    </p>
                  </div>
                ))}
                {abonnements.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun abonnement enregistre.</p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr,1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Controle par ligne</h3>
          <div className="mt-5 space-y-3">
            {lineControlRows.map((row) => (
              <div
                key={row.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{row.nom}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      row.gap > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {row.gap > 0 ? `${row.gap} a verifier` : "Aligne"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Actifs: {row.activeCount} - Factures rattachees: {row.billedCount}
                </p>
              </div>
            ))}
            {lineControlRows.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune ligne a controler.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Alertes transport</h3>
          <div className="mt-5 space-y-3">
            {activeWithoutFacture.slice(0, 4).map((item) => (
              <div
                key={`unbilled-${item.id}`}
                className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4"
              >
                <p className="text-sm font-semibold text-amber-950">
                  {getAbonnementTransportDisplayLabel(item)}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  En attente sur {item.ligne?.nom ?? "une ligne"} sans rattachement financier.
                </p>
              </div>
            ))}

            {prorataSubscriptions.slice(0, 3).map((item) => (
              <div
                key={`prorata-${item.id}`}
                className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4"
              >
                <p className="text-sm font-semibold text-sky-950">
                  {getAbonnementTransportDisplayLabel(item)}
                </p>
                <p className="mt-1 text-xs text-sky-800">
                  {getAbonnementTransportProrataLabel(item)} sur {item.ligne?.nom ?? "la ligne transport"}.
                </p>
              </div>
            ))}

            {suspendedWithFacture.slice(0, 3).map((item) => (
              <div
                key={`suspended-${item.id}`}
                className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4"
              >
                <p className="text-sm font-semibold text-rose-950">
                  {getAbonnementTransportDisplayLabel(item)}
                </p>
                <p className="mt-1 text-xs text-rose-800">
                  Service suspendu avec suivi financier encore actif.
                </p>
              </div>
            ))}

            {activeWithoutFacture.length === 0 &&
            prorataSubscriptions.length === 0 &&
            suspendedWithFacture.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aucune anomalie de transport evidente sur les abonnements actuels.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
