import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import MatiereService, {
  getMatiereDisplayLabel,
  type MatiereWithRelations,
} from "../../../../../services/matiere.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";

export default function MatiereTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new MatiereService(), []);

  const columns: ColumnDef<MatiereWithRelations>[] = [
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
      render: (row) => getMatiereDisplayLabel(row),
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "departement",
      header: "Departement",
      render: (row) => row.departement?.nom ?? "-",
      sortable: true,
      sortKey: "departement.nom",
    },
    {
      key: "cours_count",
      header: "Cours",
      render: (row) => String(row.cours?.length ?? 0),
    },
    {
      key: "programmes_count",
      header: "Programmes",
      render: (row) => String(row.lignesProgramme?.length ?? 0),
    },
    {
      key: "created_at",
      header: "Cree le",
      render: (row) =>
        formatDateWithLocalTimezone(row.created_at.toString()).date,
      sortable: true,
      sortKey: "created_at",
    },
  ];

  const actions: RowAction<MatiereWithRelations>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => console.log("voir", row.id),
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message:
          "Supprimer cette matiere ? La suppression sera refusee si elle est encore utilisee.",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<MatiereWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        includeSpec: {
          departement: true,
          cours: {
            select: { id: true },
          },
          lignesProgramme: {
            select: { id: true },
          },
        },
        where: etablissement_id ? { etablissement_id } : {},
        orderBy: [{ nom: "asc" }],
      }}
      showSearch
      onSearchBuildWhere={(text) => {
        const searchFilters = {
          OR: [
            { code: { contains: text } },
            { nom: { contains: text } },
            { departement: { nom: { contains: text } } },
          ],
        };

        if (!etablissement_id) {
          return searchFilters;
        }

        return {
          AND: [searchFilters, { etablissement_id }],
        };
      }}
    />
  );
}
