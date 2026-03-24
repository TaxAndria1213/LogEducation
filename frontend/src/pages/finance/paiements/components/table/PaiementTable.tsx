import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import { useAuth } from "../../../../../auth/AuthContext";
import PaiementService, {
  getPaiementDisplayLabel,
  getPaiementSecondaryLabel,
  type PaiementWithRelations,
} from "../../../../../services/paiement.service";

export default function PaiementTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new PaiementService(), []);

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
      key: "methode",
      header: "Methode",
      render: (row) => row.methode ?? "-",
      sortable: false,
      sortKey: "methode",
    },
    {
      key: "reference",
      header: "Reference",
      render: (row) => row.reference ?? "-",
      sortable: false,
      sortKey: "reference",
    },
  ];

  const actions: RowAction<PaiementWithRelations>[] = [
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
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id ? { facture: { is: { etablissement_id } } } : {},
        includeSpec: {
          facture: {
            include: {
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
            },
          },
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id ? [{ facture: { is: { etablissement_id } } }] : []),
          {
            OR: [
              { reference: { contains: text } },
              { methode: { contains: text } },
              { facture: { is: { numero_facture: { contains: text } } } },
            ],
          },
        ],
      })}
    />
  );
}
