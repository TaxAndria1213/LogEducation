import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import {
  getTypeEvaluationCodeLabel,
  type TypeEvaluationRefWithRelations,
} from "../../../../../services/typeEvaluationRef.service";
import TypeEvaluationRefService from "../../../../../services/typeEvaluationRef.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInfo } from "../../../../../hooks/useInfo";
import { useTypeEvaluationRefStore } from "../../store/TypeEvaluationRefIndexStore";

function renderFlag(active: boolean, label: string) {
  return active ? (
    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
      {label}
    </span>
  ) : null;
}

export default function TypeEvaluationRefTable() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new TypeEvaluationRefService(), []);
  const setRenderedComponent = useTypeEvaluationRefStore((state) => state.setRenderedComponent);
  const setEditingItem = useTypeEvaluationRefStore((state) => state.setEditingItem);

  const columns: ColumnDef<TypeEvaluationRefWithRelations>[] = [
    {
      key: "code",
      header: "Type",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getTypeEvaluationCodeLabel(row.code)}</p>
          <p className="text-xs text-slate-500">{row.nom}</p>
        </div>
      ),
      sortable: false,
      sortKey: "code",
    },
    {
      key: "defaults",
      header: "Valeurs par defaut",
      render: (row) => (
        <div className="space-y-1 text-xs text-slate-600">
          <p>Poids: {row.poids_defaut ?? "-"}</p>
          <p>Note max: {row.default_max_score ?? "-"}</p>
        </div>
      ),
      sortable: false,
    },
    {
      key: "rules",
      header: "Regles",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {renderFlag(row.include_in_average, "Moyenne")}
          {renderFlag(row.show_in_report_card, "Visible bulletin")}
          {renderFlag(row.is_final_exam, "Examen final")}
        </div>
      ),
      sortable: false,
    },
    {
      key: "status",
      header: "Statut",
      render: (row) => (
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            row.is_active
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {row.is_active ? "Actif" : "Inactif"}
        </span>
      ),
      sortable: false,
    },
  ];

  const actions: RowAction<TypeEvaluationRefWithRelations>[] = [
    {
      label: "Modifier",
      variant: "secondary",
      onClick: async (row) => {
        setEditingItem(row);
        setRenderedComponent("add");
      },
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Supprimer ce type d'evaluation ?",
      },
      onClick: async (row) => {
        try {
          await service.delete(row.id);
          info("Type d'evaluation supprime avec succes.", "success");
          tableRef.current?.refresh();
        } catch (error) {
          info(error, "error");
        }
      },
    },
  ];

  return (
    <DataTable<TypeEvaluationRefWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id ? { etablissement_id } : {},
        includeSpec: {
          evaluations: true,
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id ? [{ etablissement_id }] : []),
          {
            OR: [
              { nom: { contains: text } },
              { code: { equals: text.toUpperCase() } },
            ],
          },
        ],
      })}
    />
  );
}
