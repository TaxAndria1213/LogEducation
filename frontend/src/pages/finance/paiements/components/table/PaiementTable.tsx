import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import { useAuth } from "../../../../../auth/AuthContext";
import PaiementService, {
  getPaiementAvailableOverpayment,
  getPaiementDisplayLabel,
  getPaiementMethodLabel,
  getPaiementReconciliationStatusLabel,
  getPaiementReceiptStatusLabel,
  getPaiementSecondaryLabel,
  getPaiementStatusLabel,
  type PaiementWithRelations,
} from "../../../../../services/paiement.service";
import { usePaiementStore } from "../../store/PaiementIndexStore";

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR");
}

function getAffectationSummary(row: PaiementWithRelations) {
  if (!row.affectations?.length) return [];
  return row.affectations.map((affectation) => ({
    id: affectation.id,
    label:
      affectation.echeance?.libelle?.trim() ||
      (affectation.echeance ? `Echeance ${affectation.echeance.ordre}` : "Echeance"),
    date: affectation.echeance?.date_echeance,
    montant: Number(affectation.montant ?? 0),
  }));
}

export default function PaiementTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new PaiementService(), []);
  const selectedPaiement = usePaiementStore((state) => state.selectedPaiement);
  const setSelectedPaiement = usePaiementStore((state) => state.setSelectedPaiement);

  const columns: ColumnDef<PaiementWithRelations>[] = [
    {
      key: "paiement",
      header: "Paiement",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getPaiementDisplayLabel(row)}</p>
          <p className="text-xs text-slate-500">{getPaiementSecondaryLabel(row)}</p>
        </div>
      ),
      sortable: false,
      sortKey: "reference",
    },
    {
      key: "paye_le",
      header: "Date",
      render: (row) => (row.paye_le ? new Date(row.paye_le).toLocaleDateString("fr-FR") : "-"),
      sortable: false,
      sortKey: "paye_le",
    },
    {
      key: "montant",
      header: "Montant",
      render: (row) => `${Number(row.montant ?? 0).toLocaleString("fr-FR")} ${row.facture?.devise ?? "MGA"}`,
      sortable: false,
      sortKey: "montant",
    },
    {
      key: "echeances",
      header: "Echeances reglees",
      render: (row) => {
        const items = getAffectationSummary(row);
        if (items.length === 0) {
          return <span className="text-xs text-slate-400">Aucune affectation detaillee</span>;
        }
        return (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(item.date)} - {item.montant.toLocaleString("fr-FR")} {row.facture?.devise ?? "MGA"}
                </p>
              </div>
            ))}
          </div>
        );
      },
      sortable: false,
      sortKey: "id",
    },
    {
      key: "methode",
      header: "Methode",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getPaiementMethodLabel(row.methode)}</p>
          <p className="text-xs text-slate-500">
            {row.payeur_nom?.trim()
              ? `${row.payeur_nom} - ${getPaiementReceiptStatusLabel(row.statut)}`
              : getPaiementReceiptStatusLabel(row.statut)}
          </p>
        </div>
      ),
      sortable: false,
      sortKey: "methode",
    },
    {
      key: "reference",
      header: "Recu / reference",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.numero_recu ?? "-"}</p>
          <p className="text-xs text-slate-500">{row.reference ?? "Sans reference externe"}</p>
        </div>
      ),
      sortable: false,
      sortKey: "reference",
    },
    {
      key: "rapprochement",
      header: "Rapprochement",
      render: (row) => getPaiementReconciliationStatusLabel(row),
      sortable: false,
    },
  ];

  const actions: RowAction<PaiementWithRelations>[] = [
    {
      label: "Voir",
      kind: "view",
      variant: "secondary",
      onClick: async () => {},
    },
    {
      label: "Annuler le recu",
      variant: "danger",
      show: (row) => (row.statut ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE",
      onClick: async (row) => {
        const motif = window.prompt("Motif d'annulation du paiement", "") ?? "";
        await service.cancel(row.id, { motif: motif.trim() || null });
        tableRef.current?.refresh();
      },
    },
    {
      label: "Rembourser",
      variant: "secondary",
      show: (row) => (row.statut ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE",
      onClick: async (row) => {
        const motif = window.prompt("Motif du remboursement", "") ?? "";
        await service.refund(row.id, { motif: motif.trim() || null });
        tableRef.current?.refresh();
      },
    },
    {
      label: "Rapprocher",
      variant: "secondary",
      onClick: async (row) => {
        const canal = window.prompt("Canal de rapprochement (CAISSE, BANQUE, SYSTEME)", "") ?? "";
        const reference_rapprochement =
          window.prompt("Reference de rapprochement", row.reference ?? row.numero_recu ?? "") ?? "";
        const note = window.prompt("Note de rapprochement", "") ?? "";
        await service.reconcile(row.id, {
          canal: canal.trim() || null,
          reference_rapprochement: reference_rapprochement.trim() || null,
          note: note.trim() || null,
        });
        tableRef.current?.refresh();
      },
    },
    {
      label: "Rembourser trop-percu",
      variant: "secondary",
      show: (row) => getPaiementAvailableOverpayment(row) > 0,
      onClick: async (row) => {
        const available = getPaiementAvailableOverpayment(row);
        const montant = window.prompt("Montant du trop-percu a rembourser", String(available)) ?? "";
        const motif = window.prompt("Motif du remboursement du trop-percu", "") ?? "";
        await service.refundOverpayment(row.id, {
          montant: Number(montant),
          motif: motif.trim() || null,
        });
        tableRef.current?.refresh();
      },
    },
    {
      label: "Reaffecter",
      variant: "secondary",
      show: (row) => (row.statut ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE",
      onClick: async (row) => {
        const factureNumero =
          window.prompt(
            "Numero de facture cible. Laisse vide pour rester sur la facture actuelle.",
            row.facture?.numero_facture ?? "",
          ) ?? "";
        const echeanceOrdres =
          window.prompt(
            "Ordres des echeances cibles separes par des virgules. Ex: 1,2",
            "",
          ) ?? "";
        const motif = window.prompt("Motif de la reaffectation", "") ?? "";
        await service.reallocate(row.id, {
          facture_numero: factureNumero.trim() || null,
          echeance_ordres: echeanceOrdres
            .split(",")
            .map((item) => Number(item.trim()))
            .filter((item) => Number.isInteger(item) && item > 0),
          motif: motif.trim() || null,
        });
        tableRef.current?.refresh();
      },
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Supprimer ce paiement ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<PaiementWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      detailView={{
        getTitle: (row) => getPaiementDisplayLabel(row),
        selectedRow: selectedPaiement,
        onSelectedRowChange: setSelectedPaiement,
        openOnRowClick: true,
      }}
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id ? { facture: { is: { etablissement_id } } } : {},
        includeSpec: {
          facture: {
            include: {
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              echeances: true,
              operationsFinancieres: true,
            },
          },
          affectations: {
            include: {
              echeance: true,
            },
          },
          operationsFinancieres: true,
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id ? [{ facture: { is: { etablissement_id } } }] : []),
          {
            OR: [
              { reference: { contains: text } },
              { numero_recu: { contains: text } },
              { methode: { contains: text } },
              { payeur_nom: { contains: text } },
              { payeur_reference: { contains: text } },
              { facture: { is: { numero_facture: { contains: text } } } },
            ],
          },
        ],
      })}
    />
  );
}
