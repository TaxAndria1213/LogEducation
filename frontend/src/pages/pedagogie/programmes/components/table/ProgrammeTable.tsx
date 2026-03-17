import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Programme } from "../../../../../types/models";
import ProgrammeService from "../../../../../services/programme.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";

export default function ProgrammeTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new ProgrammeService(), []);

  const columns: ColumnDef<Programme>[] = [
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "annee",
      header: "Année scolaire",
      render: (row) => row.annee?.nom ?? "-",
      sortable: true,
      sortKey: "annee.nom",
    },
    {
      key: "niveau",
      header: "Niveau",
      render: (row) => row.niveau?.nom ?? "-",
      sortable: true,
      sortKey: "niveau.nom",
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

  const actions: RowAction<Programme>[] = [
    { label: "Voir", variant: "secondary", onClick: (row) => console.log("voir", row.id) },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: { title: "Suppression", message: "Supprimer ce programme ?" },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<Programme>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        includeSpec: { annee: true, niveau: true },
        where: etablissement_id ? { etablissement_id } : {},
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [{ nom: { contains: text } }],
        ...(etablissement_id ? { etablissement_id } : {}),
      })}
    />
  );
}
