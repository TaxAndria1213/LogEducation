import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import { useAuth } from "../../../../../auth/AuthContext";
import FactureService, {
  getFactureDisplayLabel,
  getFactureNatureLabel,
  getFactureSecondaryLabel,
  getFactureStatusLabel,
  type FactureWithRelations,
} from "../../../../../services/facture.service";
import { useFactureStore } from "../../store/FactureIndexStore";

export default function FactureTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new FactureService(), []);
  const selectedFacture = useFactureStore((state) => state.selectedFacture);
  const setSelectedFacture = useFactureStore((state) => state.setSelectedFacture);
  const setRenderedComponent = useFactureStore((state) => state.setRenderedComponent);

  const columns: ColumnDef<FactureWithRelations>[] = [
    {
      key: "facture",
      header: "Facture",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getFactureDisplayLabel(row)}</p>
          <p className="text-xs text-slate-500">{getFactureSecondaryLabel(row)}</p>
        </div>
      ),
      sortable: false,
      sortKey: "numero_facture",
    },
    {
      key: "date_emission",
      header: "Emission",
      render: (row) =>
        row.date_emission ? new Date(row.date_emission).toLocaleDateString("fr-FR") : "-",
      sortable: false,
      sortKey: "date_emission",
    },
    {
      key: "montant",
      header: "Montant",
      render: (row) => `${Number(row.total_montant ?? 0).toLocaleString("fr-FR")} ${row.devise ?? "MGA"}`,
      sortable: false,
      sortKey: "total_montant",
    },
    {
      key: "statut",
      header: "Statut",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getFactureStatusLabel(row.statut)}</p>
          <p className="text-xs text-slate-500">{getFactureNatureLabel(row.nature)}</p>
        </div>
      ),
      sortable: false,
      sortKey: "statut",
    },
    {
      key: "paiements",
      header: "Paiements",
      render: (row) => row.paiements?.length ?? 0,
      sortable: false,
    },
  ];

  const actions: RowAction<FactureWithRelations>[] = [
    {
      label: "Voir",
      kind: "view",
      variant: "secondary",
      onClick: async () => {},
    },
    {
      label: "Modifier",
      variant: "primary",
      show: (row) => (row.paiements?.length ?? 0) === 0 && !(row.echeances ?? []).some((item) => item.plan_paiement_id),
      onClick: async (row) => {
        setSelectedFacture(row);
        setRenderedComponent("edit");
      },
    },
    {
      label: "Emettre",
      variant: "secondary",
      show: (row) => (row.statut ?? "").toUpperCase() === "BROUILLON",
      onClick: async (row) => {
        const motif = window.prompt("Note de validation finale", "") ?? "";
        await service.emit(row.id, { motif: motif.trim() || null });
        tableRef.current?.refresh();
      },
    },
    {
      label: "Annuler",
      variant: "danger",
      show: (row) =>
        (row.statut ?? "").toUpperCase() !== "ANNULEE" &&
        (row.paiements?.filter((item) => (item.statut ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE").length ?? 0) === 0 &&
        !(row.echeances ?? []).some((item) => item.plan_paiement_id),
      onClick: async (row) => {
        const motif = window.prompt("Motif d'annulation de la facture", "") ?? "";
        await service.cancel(row.id, { motif: motif.trim() || null });
        tableRef.current?.refresh();
      },
    },
    {
      label: "Avoir",
      variant: "secondary",
      show: (row) => (row.statut ?? "").toUpperCase() !== "ANNULEE" && (row.nature ?? "FACTURE").toUpperCase() !== "AVOIR",
      onClick: async (row) => {
        const montantInput = window.prompt(
          "Montant de l'avoir. Laisse vide pour solder le reste ouvert.",
          "",
        );
        if (montantInput === null) return;

        const trimmed = montantInput.trim();
        const montant =
          trimmed.length > 0
            ? Number(trimmed.replace(/\s+/g, "").replace(",", "."))
            : null;

        if (trimmed.length > 0 && !Number.isFinite(montant)) {
          throw new Error("Le montant de l'avoir est invalide.");
        }

        const motif = window.prompt("Motif de l'avoir", "") ?? "";
        await service.createAvoir(row.id, {
          motif: motif.trim() || null,
          montant,
        });
        tableRef.current?.refresh();
      },
    },
    {
      label: "Refacturer",
      variant: "secondary",
      show: (row) => (row.nature ?? "FACTURE").toUpperCase() !== "AVOIR",
      onClick: async (row) => {
        const motif = window.prompt("Motif de la refacturation", "") ?? "";
        await service.reinvoice(row.id, { motif: motif.trim() || null });
        tableRef.current?.refresh();
      },
    },
    {
      label: "Supprimer",
      variant: "danger",
      show: (row) => (row.paiements?.length ?? 0) === 0,
      confirm: {
        title: "Suppression",
        message: "Supprimer cette facture ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<FactureWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      detailView={{
        getTitle: (row) => getFactureDisplayLabel(row),
        selectedRow: selectedFacture,
        onSelectedRowChange: setSelectedFacture,
        openOnRowClick: true,
        onEdit: (row) => {
          setSelectedFacture(row);
          setRenderedComponent("edit");
        },
      }}
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id ? { etablissement_id } : {},
        includeSpec: {
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          annee: true,
          remise: true,
          factureOrigine: true,
          avoirs: true,
          lignes: { include: { frais: true } },
          paiements: true,
          operationsFinancieres: true,
          echeances: { include: { affectations: true }, orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }] },
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id ? [{ etablissement_id }] : []),
          {
            OR: [
              { numero_facture: { contains: text } },
              { devise: { contains: text } },
              { eleve: { is: { code_eleve: { contains: text } } } },
            ],
          },
        ],
      })}
    />
  );
}
