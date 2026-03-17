import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Evaluation } from "../../../../../types/models";
import EvaluationService from "../../../../../services/evaluation.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../auth/AuthContext";

export default function EvaluationTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new EvaluationService(), []);

  const columns: ColumnDef<Evaluation>[] = [
    {
      key: "titre",
      header: "Titre",
      accessor: "titre",
      sortable: true,
      sortKey: "titre",
    },
    {
      key: "cours",
      header: "Cours",
      accessor: "cours",
      render: (row: Evaluation) => row.cours?.matiere?.code ?? "-",
      sortable: true,
      sortKey: "cours",
    },
    {
      key: "classe",
      header: "Classe",
      accessor: "classe",
      render: (row: Evaluation) => row.cours?.classe?.nom ?? "-",
      sortable: true,
      sortKey: "classe",
    },
    {
      key: "periode",
      header: "Periode",
      accessor: "periode",
      render: (row: Evaluation) => row.periode?.nom ?? "-",
      sortable: true,
      sortKey: "periode",
    },
    {
      key: "type",
      header: "Type",
      accessor: "type",
      sortable: true,
      sortKey: "type",
    },
    {
      key: "note_max",
      header: "Note max",
      accessor: "note_max",
      sortable: true,
      sortKey: "note_max",
    },
    {
      key: "date",
      header: "Date",
      render: (row) =>
        formatDateWithLocalTimezone(row.date.toString()).dateHeure,
      sortable: true,
      sortKey: "date",
    },
  ];

  const actions: RowAction<Evaluation>[] = [
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
        message: "Supprimer cette évaluation ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<Evaluation>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: {
          periode: {
            annee: {
              etablissement_id: etablissement_id,
            },
          },
        },
        includeSpec: {
          cours: {
            include: {
              matiere: true,
              classe: true,
            },
          },
          periode: true,
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { titre: { contains: text } },
          { cours: { matiere: { code: { contains: text } } } },
          { cours: { classe: { nom: { contains: text } } } },
        ],
      })}
    />
  );
}
