import React from "react";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../hooks/useAuth";
import AnneeScolaireService from "../../../../../services/anneeScolaire.service";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import type { AnneeScolaire } from "../../../../../types/models";

export default function AnneeScolaireList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => AnneeScolaireService, []);

  const columns: ColumnDef<AnneeScolaire>[] = [
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "date_debut",
      header: "Debut",
      accessor: "date_debut",
      sortable: true,
      sortKey: "date_debut",
      render: (row) => formatDateWithLocalTimezone(row.date_debut.toString()).date,
    },
    {
      key: "date_fin",
      header: "Fin",
      accessor: "date_fin",
      sortable: true,
      sortKey: "date_fin",
      render: (row) => formatDateWithLocalTimezone(row.date_fin.toString()).date,
    },
    {
      key: "est_active",
      header: "Etat",
      accessor: "est_active",
      sortable: true,
      sortKey: "est_active",
      render: (row) => (row.est_active ? "Active" : "Archivee"),
    },
  ];

  const actions: RowAction<AnneeScolaire>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => {
        console.log("voir", row.id);
      },
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Voulez-vous supprimer cette annee scolaire ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<AnneeScolaire>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: { etablissement_id },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [{ nom: { contains: text } }],
      })}
    />
  );
}
