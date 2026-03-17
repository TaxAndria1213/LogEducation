import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Matiere } from "../../../../../types/models";
import MatiereService from "../../../../../services/matiere.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";

export default function MatiereTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new MatiereService(), []);

  const columns: ColumnDef<Matiere>[] = [
    {
      key: "code",
      header: "Code",
      render: (row) => row.code ?? "-",
      sortable: true,
      sortKey: "code",
    },
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "departement",
      header: "Département",
      render: (row) => row.departement?.nom ?? "-",
      sortable: true,
      sortKey: "departement.nom",
    },
    {
      key: "created_at",
      header: "Créé le",
      render: (row) =>
        formatDateWithLocalTimezone(row.created_at.toString()).date,
      sortable: true,
      sortKey: "created_at",
    },
  ];

  const actions: RowAction<Matiere>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => console.log("voir", row.id),
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: { title: "Suppression", message: "Supprimer cette matière ?" },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<Matiere>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        includeSpec: { departement: true },
        where: etablissement_id ? { etablissement_id } : {},
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { code: { contains: text } },
          { nom: { contains: text } },
        ],
        ...(etablissement_id ? { etablissement_id } : {}),
      })}
    />
  );
}
