import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import CoursService, {
  getCoursDisplayLabel,
  getCoursSecondaryLabel,
  getTeacherDisplayLabel,
  type CoursWithRelations,
} from "../../../../../services/cours.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";

export default function CoursTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new CoursService(), []);

  const columns: ColumnDef<CoursWithRelations>[] = [
    {
      key: "cours",
      header: "Cours",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getCoursDisplayLabel(row)}</p>
          <p className="text-xs text-slate-500">{getCoursSecondaryLabel(row) || "Aucun detail complementaire"}</p>
        </div>
      ),
      sortable: false,
      sortKey: "created_at",
    },
    {
      key: "enseignant",
      header: "Enseignant",
      render: (row) => getTeacherDisplayLabel(row.enseignant),
      sortable: false,
      sortKey: "enseignant.personnel.code_personnel",
    },
    {
      key: "suivi",
      header: "Suivi",
      render: (row) => {
        const evaluationCount = row.evaluations?.length ?? 0;
        const planningCount = row.emploiDuTemps?.length ?? 0;

        return (
          <div className="space-y-1 text-xs text-slate-600">
            <p>{evaluationCount} evaluation(s)</p>
            <p>{planningCount} element(s) d'emploi du temps</p>
          </div>
        );
      },
      sortable: false,
    },
    {
      key: "created_at",
      header: "Cree le",
      render: (row) => formatDateWithLocalTimezone(row.created_at.toString()).date,
      sortable: false,
      sortKey: "created_at",
    },
  ];

  const actions: RowAction<CoursWithRelations>[] = [
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
    <DataTable<CoursWithRelations>
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
          classe: {
            include: {
              niveau: true,
              site: true,
            },
          },
          matiere: {
            include: {
              departement: true,
            },
          },
          enseignant: {
            include: {
              departement: true,
              personnel: {
                include: {
                  utilisateur: {
                    include: {
                      profil: true,
                    },
                  },
                },
              },
            },
          },
          evaluations: true,
          emploiDuTemps: true,
        },
        where: etablissement_id ? { etablissement_id } : {},
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { classe: { nom: { contains: text } } },
          { classe: { niveau: { nom: { contains: text } } } },
          { matiere: { nom: { contains: text } } },
          { matiere: { code: { contains: text } } },
          { enseignant: { personnel: { code_personnel: { contains: text } } } },
          { enseignant: { personnel: { utilisateur: { profil: { prenom: { contains: text } } } } } },
          { enseignant: { personnel: { utilisateur: { profil: { nom: { contains: text } } } } } },
        ],
        ...(etablissement_id ? { etablissement_id } : {}),
      })}
    />
  );
}
