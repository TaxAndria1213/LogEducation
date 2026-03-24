import { FiCalendar, FiCreditCard, FiEdit3, FiFileText, FiLayers, FiList, FiUser } from "react-icons/fi";
import { useFactureStore } from "../../store/FactureIndexStore";
import {
  getFactureDisplayLabel,
  getFactureSecondaryLabel,
  getFactureStatusLabel,
} from "../../../../../services/facture.service";

function formatMoney(value: unknown, devise = "MGA") {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;
  return `${(Number.isFinite(amount) ? amount : 0).toLocaleString("fr-FR")} ${devise}`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Non renseignee";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseignee";
  return date.toLocaleDateString("fr-FR");
}

export default function FactureDetail() {
  const facture = useFactureStore((state) => state.selectedFacture);
  const setRenderedComponent = useFactureStore((state) => state.setRenderedComponent);

  if (!facture) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Facture indisponible</h3>
        <p className="mt-2 text-sm text-slate-500">
          Selectionne une facture depuis la liste pour afficher ses details.
        </p>
      </div>
    );
  }

  const canEdit = (facture.paiements?.length ?? 0) === 0;
  const totalPaid = (facture.paiements ?? []).reduce((sum, item) => {
    const amount = typeof item.montant === "number" ? item.montant : Number(item.montant ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold text-slate-900">{getFactureDisplayLabel(facture)}</h2>
            <p className="mt-2 text-sm text-slate-500">{getFactureSecondaryLabel(facture)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRenderedComponent("list")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <FiList />
              Retour liste
            </button>
            {canEdit ? (
              <button
                type="button"
                onClick={() => setRenderedComponent("edit")}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <FiEdit3 />
                Modifier
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiFileText />
            <span className="text-sm font-medium">Total facture</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatMoney(facture.total_montant, facture.devise ?? "MGA")}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCreditCard />
            <span className="text-sm font-medium">Total paye</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatMoney(totalPaid, facture.devise ?? "MGA")}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCalendar />
            <span className="text-sm font-medium">Echeance</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatDate(facture.date_echeance)}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Statut</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{getFactureStatusLabel(facture.statut)}</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Lignes de facture</h3>
          <div className="mt-5 space-y-3">
            {facture.lignes?.map((ligne) => (
              <div key={ligne.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{ligne.libelle}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Quantite {ligne.quantite} - {formatMoney(ligne.prix_unitaire, facture.devise ?? "MGA")}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatMoney(ligne.montant, facture.devise ?? "MGA")}
                  </p>
                </div>
              </div>
            ))}
            {(facture.lignes?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">Aucune ligne de facture.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Echeances de paiement</h3>
            <div className="mt-5 space-y-3">
              {facture.echeances?.map((echeance) => (
                <div key={echeance.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {echeance.libelle?.trim() || `Tranche ${echeance.ordre}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Echeance {formatDate(echeance.date_echeance)} - {echeance.statut}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatMoney(echeance.montant_prevu, echeance.devise ?? facture.devise ?? "MGA")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Regle {formatMoney(echeance.montant_regle, echeance.devise ?? facture.devise ?? "MGA")} - Reste{" "}
                        {formatMoney(echeance.montant_restant, echeance.devise ?? facture.devise ?? "MGA")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {(facture.echeances?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">Aucune echeance rattachee a cette facture.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Informations</h3>
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3">
                <FiUser className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Eleve</p>
                  <p className="mt-1 text-sm text-slate-900">{getFactureSecondaryLabel(facture)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiCalendar className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Emission</p>
                  <p className="mt-1 text-sm text-slate-900">{formatDate(facture.date_emission)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiLayers className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Paiements rattaches</p>
                  <p className="mt-1 text-sm text-slate-900">{facture.paiements?.length ?? 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Historique des paiements</h3>
            <div className="mt-5 space-y-3">
              {facture.paiements?.map((paiement) => (
                <div key={paiement.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {paiement.reference?.trim() || paiement.methode || "Paiement"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(paiement.paye_le)} - {paiement.methode || "Mode non renseigne"}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatMoney(paiement.montant, facture.devise ?? "MGA")}
                    </p>
                  </div>
                </div>
              ))}
              {(facture.paiements?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">Aucun paiement rattache a cette facture.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
