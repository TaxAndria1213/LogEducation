import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import { useAuth } from "../../../../../hooks/useAuth";
import RessourceBibliothequeService, {
  getActiveLoansCount,
  getAvailableStock,
  getRessourceBibliothequeDisplayLabel,
  getRessourceBibliothequeSecondaryLabel,
  getRessourceTypeLabel,
  type RessourceBibliothequeWithRelations,
} from "../../../../../services/ressourceBibliotheque.service";

export default function RessourceBibliothequeTable() {
  const { etablissement_id } = useAuth();
  const service = React.useMemo(() => new RessourceBibliothequeService(), []);
  const tableRef = React.useRef<DataTableHandle>(null);

  const columns: ColumnDef<RessourceBibliothequeWithRelations>[] = [
    {
      key: "titre",
      header: "Ressource",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getRessourceBibliothequeDisplayLabel(row)}</p>
          <p className="text-xs text-slate-500">{getRessourceBibliothequeSecondaryLabel(row)}</p>
        </div>
      ),
      sortable: false,
      sortKey: "titre",
    },
    {
      key: "type",
      header: "Type",
      render: (row) => getRessourceTypeLabel(row.type),
      sortable: false,
      sortKey: "type",
    },
    {
      key: "stock",
      header: "Stock",
      render: (row) => Number(row.stock ?? 0).toLocaleString("fr-FR"),
      sortable: false,
      sortKey: "stock",
    },
    {
      key: "active",
      header: "Emprunts actifs",
      render: (row) => getActiveLoansCount(row),
      sortable: false,
      sortKey: "id",
    },
    {
      key: "disponible",
      header: "Disponible",
      render: (row) => getAvailableStock(row),
      sortable: false,
      sortKey: "id",
    },
  ];

  const actions: RowAction<RessourceBibliothequeWithRelations>[] = [
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Supprimer cette ressource ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<RessourceBibliothequeWithRelations>
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
          emprunts: {
            where: { retourne_le: null },
          },
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id ? [{ etablissement_id }] : []),
          {
            OR: [
              { titre: { contains: text } },
              { code: { contains: text } },
              { auteur: { contains: text } },
              { editeur: { contains: text } },
            ],
          },
        ],
      })}
    />
  );
}
