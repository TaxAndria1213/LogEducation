import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Cours } from "../../../../../types/models";
import CoursService from "../../../../../services/cours.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";

export default function CoursTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new CoursService(), []);

  const columns: ColumnDef<Cours>[] = [
    {
      key: "matiere",
      header: "Matière",
      render: (row) => row.matiere?.nom ?? "-",
      sortable: false,
      sortKey: "matiere.nom",
    },
    {
      key: "classe",
      header: "Classe",
      render: (row) => row.classe?.nom ?? "-",
      sortable: false,
      sortKey: "classe.nom",
    },
    {
      key: "enseignant",
      header: "Enseignant",
      render: (row) => row.enseignant?.personnel?.code_personnel ?? "-",
      sortable: false,
      sortKey: "enseignant.personnel.code_personnel",
    },
    {
      key: "created_at",
      header: "Créé le",
      render: (row) =>
        formatDateWithLocalTimezone(row.created_at.toString()).date,
      sortable: false,
      sortKey: "created_at",
    },
  ];

  const actions: RowAction<Cours>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => console.log("voir", row.id),
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: { title: "Suppression", message: "Supprimer ce cours ?" },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<Cours>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        includeSpec: {
          classe: true,
          matiere: true,
          enseignant: { include: { personnel: true } },
        },
        where: etablissement_id ? { etablissement_id } : {},
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { classe: { nom: { contains: text } } },
          { matiere: { nom: { contains: text } } },
        ],
        ...(etablissement_id ? { etablissement_id } : {}),
      })}
    />
  );
}
