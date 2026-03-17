import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { RegleNote } from "../../../../../types/models";
import RegleNoteService from "../../../../../services/regleNote.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";

export default function RegleNoteTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new RegleNoteService(), []);

  const columns: ColumnDef<RegleNote>[] = [
    {
      key: "scope",
      header: "Portée",
      accessor: "scope",
      sortable: true,
      sortKey: "scope",
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

  const actions: RowAction<RegleNote>[] = [
    { label: "Voir", variant: "secondary", onClick: (row) => console.log("voir", row.id) },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: { title: "Suppression", message: "Supprimer cette règle ?" },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<RegleNote>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id ? { etablissement_id } : {},
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [{ scope: { contains: text } }],
        ...(etablissement_id ? { etablissement_id } : {}),
      })}
    />
  );
}
