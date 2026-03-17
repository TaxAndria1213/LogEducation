import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Note } from "../../../../../types/models";
import NoteService from "../../../../../services/note.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../auth/AuthContext";

export default function NoteTable() {
  const {etablissement_id} = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new NoteService(), []);

  const columns: ColumnDef<Note>[] = [
    {
      key: "eleve",
      header: "élève",
      render: (row) => row.eleve?.code_eleve ?? "-",
      sortable: true,
      sortKey: "eleve.code_eleve",
    },
    {
      key: "matiere",
      header: "Matière",
      render: (row) => row.evaluation?.cours?.matiere?.code ?? "-",
      sortable: true,
      sortKey: "evaluation.cours.matiere.code",
    },
    {
      key: "classe",
      header: "Classe",
      render: (row) => row.evaluation?.cours?.classe?.nom ?? "-",
      sortable: true,
      sortKey: "evaluation.cours.classe.nom",
    },
    {
      key: "score",
      header: "Score",
      accessor: "score",
      sortable: true,
      sortKey: "score",
    },
    {
      key: "evaluation",
      header: "Evaluation",
      render: (row) => row.evaluation?.titre ?? "-",
      sortable: true,
      sortKey: "evaluation.titre",
    },
    {
      key: "note_le",
      header: "Noté le",
      render: (row) =>
        row.note_le
          ? formatDateWithLocalTimezone(row.note_le.toString()).date
          : "-",
      sortable: true,
      sortKey: "note_le",
    },
  ];

  const actions: RowAction<Note>[] = [
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
    <DataTable<Note>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: {
          eleve: {
            etablissement_id: etablissement_id
          }
        },
        includeSpec: { evaluation: {
          include: {cours: {
            include: {
              matiere: true,
              classe: true,
            }
          }}
        }, eleve: true },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { eleve: { code_eleve: { contains: text } } },
          { evaluation: { titre: { contains: text } } },
        ],
      })}
    />
  );
}
