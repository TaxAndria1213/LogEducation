import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import ProgrammeService, {
  getProgrammeDisplayLabel,
  getProgrammeMatiereSummary,
  type ProgrammeWithRelations,
} from "../../../../../services/programme.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";

export default function ProgrammeTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new ProgrammeService(), []);

  const columns: ColumnDef<ProgrammeWithRelations>[] = [
    {
      key: "nom",
      header: "Programme",
      render: (row) => getProgrammeDisplayLabel(row),
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "annee",
      header: "Annee scolaire",
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
      key: "matieres_count",
      header: "Matieres",
      render: (row) => String(row.matieres?.length ?? 0),
    },
    {
      key: "matieres_preview",
      header: "Apercu",
      render: (row) => getProgrammeMatiereSummary(row.matieres),
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

  const actions: RowAction<ProgrammeWithRelations>[] = [
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
        message: "Supprimer ce programme et ses lignes de matieres ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<ProgrammeWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        includeSpec: {
          annee: true,
          niveau: true,
          matieres: {
            include: {
              matiere: {
                include: {
                  departement: true,
                },
              },
            },
          },
        },
        where: etablissement_id ? { etablissement_id } : {},
        orderBy: [{ created_at: "desc" }],
      }}
      showSearch
      onSearchBuildWhere={(text) => {
        const searchFilters = {
          OR: [
            { nom: { contains: text } },
            { annee: { nom: { contains: text } } },
            { niveau: { nom: { contains: text } } },
            {
              matieres: {
                some: {
                  matiere: {
                    nom: { contains: text },
                  },
                },
              },
            },
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
