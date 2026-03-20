import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import NoteService, {
  getEleveDisplayLabel,
  getNotePercentage,
  getNoteSecondaryLabel,
  type NoteWithRelations,
} from "../../../../../services/note.service";
import { getEvaluationDisplayLabel } from "../../../../../services/evaluation.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../auth/AuthContext";

export default function NoteTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new NoteService(), []);

  const columns: ColumnDef<NoteWithRelations>[] = [
    {
      key: "eleve",
      header: "Eleve",
      render: (row) => getEleveDisplayLabel(row.eleve),
      sortable: false,
      sortKey: "eleve.code_eleve",
    },
    {
      key: "evaluation",
      header: "Evaluation",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getEvaluationDisplayLabel(row.evaluation)}</p>
          <p className="text-xs text-slate-500">{getNoteSecondaryLabel(row) || "Aucun detail complementaire"}</p>
        </div>
      ),
      sortable: false,
      sortKey: "evaluation.titre",
    },
    {
      key: "score",
      header: "Score",
      render: (row) => {
        const percentage = getNotePercentage(row);
        return (
          <div className="space-y-1 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{row.score}/{row.evaluation?.note_max ?? "-"}</p>
            <p className="text-xs text-slate-500">{percentage !== null ? `${percentage}%` : "Non calcule"}</p>
          </div>
        );
      },
      sortable: false,
      sortKey: "score",
    },
    {
      key: "commentaire",
      header: "Commentaire",
      render: (row) => row.commentaire?.trim() || "-",
      sortable: false,
    },
    {
      key: "note_le",
      header: "Notee le",
      render: (row) =>
        row.note_le
          ? formatDateWithLocalTimezone(row.note_le.toString()).dateHeure
          : "-",
      sortable: false,
      sortKey: "note_le",
    },
  ];

  const actions: RowAction<NoteWithRelations>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => console.log("voir", row),
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: { title: "Suppression", message: "Supprimer cette note ?" },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<NoteWithRelations>
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
              eleve: {
                etablissement_id,
              },
            }
          : {},
        includeSpec: {
          evaluation: {
            include: {
              periode: true,
              cours: {
                include: {
                  annee: true,
                  matiere: true,
                  classe: true,
                },
              },
            },
          },
          eleve: {
            include: {
              utilisateur: {
                include: {
                  profil: true,
                },
              },
            },
          },
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id
            ? [
                {
                  eleve: {
                    etablissement_id,
                  },
                },
              ]
            : []),
          {
            OR: [
              { eleve: { code_eleve: { contains: text } } },
              { eleve: { utilisateur: { profil: { prenom: { contains: text } } } } },
              { eleve: { utilisateur: { profil: { nom: { contains: text } } } } },
              { evaluation: { titre: { contains: text } } },
              { evaluation: { cours: { matiere: { nom: { contains: text } } } } },
              { evaluation: { cours: { matiere: { code: { contains: text } } } } },
              { evaluation: { cours: { classe: { nom: { contains: text } } } } },
            ],
          },
        ],
      })}
    />
  );
}
