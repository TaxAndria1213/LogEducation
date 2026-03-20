import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import EvaluationService, {
  getEvaluationDisplayLabel,
  getEvaluationSecondaryLabel,
  getEvaluationTypeLabel,
  type EvaluationWithRelations,
} from "../../../../../services/evaluation.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../auth/AuthContext";

export default function EvaluationTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new EvaluationService(), []);

  const columns: ColumnDef<EvaluationWithRelations>[] = [
    {
      key: "evaluation",
      header: "Evaluation",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getEvaluationDisplayLabel(row)}</p>
          <p className="text-xs text-slate-500">{getEvaluationSecondaryLabel(row) || "Aucun detail complementaire"}</p>
        </div>
      ),
      sortable: false,
      sortKey: "date",
    },
    {
      key: "type",
      header: "Type",
      render: (row) => getEvaluationTypeLabel(row.type),
      sortable: false,
      sortKey: "type",
    },
    {
      key: "notation",
      header: "Notation",
      render: (row) => (
        <div className="space-y-1 text-xs text-slate-600">
          <p>Note max: {row.note_max}</p>
          <p>Poids: {row.poids ?? "Non renseigne"}</p>
        </div>
      ),
      sortable: false,
    },
    {
      key: "suivi",
      header: "Suivi",
      render: (row) => (
        <div className="space-y-1 text-xs text-slate-600">
          <p>{row.est_publiee ? "Publiee" : "Brouillon"}</p>
          <p>{row.notes?.length ?? 0} note(s)</p>
        </div>
      ),
      sortable: false,
    },
    {
      key: "date",
      header: "Date",
      render: (row) => formatDateWithLocalTimezone(row.date.toString()).dateHeure,
      sortable: false,
      sortKey: "date",
    },
  ];

  const actions: RowAction<EvaluationWithRelations>[] = [
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
        message: "Supprimer cette evaluation ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<EvaluationWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id
          ? {
              cours: {
                etablissement_id,
              },
            }
          : {},
        includeSpec: {
          cours: {
            include: {
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
            },
          },
          periode: true,
          typeRef: true,
          createur: {
            include: {
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
          notes: true,
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id
            ? [
                {
                  cours: {
                    etablissement_id,
                  },
                },
              ]
            : []),
          {
            OR: [
              { titre: { contains: text } },
              { cours: { matiere: { nom: { contains: text } } } },
              { cours: { matiere: { code: { contains: text } } } },
              { cours: { classe: { nom: { contains: text } } } },
              { periode: { nom: { contains: text } } },
            ],
          },
        ],
      })}
    />
  );
}
