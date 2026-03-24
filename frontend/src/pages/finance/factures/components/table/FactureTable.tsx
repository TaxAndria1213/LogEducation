import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import { useAuth } from "../../../../../auth/AuthContext";
import FactureService, {
  getFactureDisplayLabel,
  getFactureSecondaryLabel,
  getFactureStatusLabel,
  type FactureWithRelations,
} from "../../../../../services/facture.service";
import { useFactureStore } from "../../store/FactureIndexStore";

export default function FactureTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new FactureService(), []);
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
      render: (row) => getFactureStatusLabel(row.statut),
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
      variant: "secondary",
      onClick: async (row) => {
        setSelectedFacture(row);
        setRenderedComponent("detail");
      },
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
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id ? { etablissement_id } : {},
        includeSpec: {
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          annee: true,
          lignes: { include: { frais: true } },
          paiements: true,
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
      onRowClick={(row) => {
        setSelectedFacture(row);
        setRenderedComponent("detail");
      }}
    />
  );
}
