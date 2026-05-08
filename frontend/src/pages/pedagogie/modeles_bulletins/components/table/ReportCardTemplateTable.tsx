import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import ReportCardTemplateService, {
  getReportCardTemplateDisplayLabel,
  getReportCardTemplateTypeLabel,
  type ReportCardTemplateWithRelations,
} from "../../../../../services/reportCardTemplate.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInfo } from "../../../../../hooks/useInfo";
import { useReportCardTemplateStore } from "../../store/ReportCardTemplateIndexStore";

function renderFlag(active: boolean, label: string) {
  return active ? (
    <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
      {label}
    </span>
  ) : null;
}

export default function ReportCardTemplateTable() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new ReportCardTemplateService(), []);
  const setRenderedComponent = useReportCardTemplateStore(
    (state) => state.setRenderedComponent,
  );
  const setEditingItem = useReportCardTemplateStore((state) => state.setEditingItem);

  const columns: ColumnDef<ReportCardTemplateWithRelations>[] = [
    {
      key: "template",
      header: "Modele",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getReportCardTemplateDisplayLabel(row)}</p>
          <p className="text-xs text-slate-500">
            {getReportCardTemplateTypeLabel(row.template_type)}
            {row.niveau?.nom ? ` • ${row.niveau.nom}` : " • Toute l'annee"}
          </p>
        </div>
      ),
      sortable: false,
    },
    {
      key: "display",
      header: "Affichage",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {renderFlag(row.show_assessment_details, "Details")}
          {renderFlag(row.show_assessment_type_summary, "Par type")}
          {renderFlag(row.show_only_final_exam, "Examen final")}
          {renderFlag(row.show_subject_rank, "Rang matiere")}
          {renderFlag(row.show_general_rank, "Rang general")}
        </div>
      ),
      sortable: false,
    },
    {
      key: "summary",
      header: "Resume",
      render: (row) => (
        <div className="space-y-1 text-xs text-slate-600">
          <p>{row.show_subject_average ? "Moyenne matiere visible" : "Moyenne matiere masquee"}</p>
          <p>{row.show_decision ? "Decision visible" : "Decision masquee"}</p>
          <p>{row.show_signature ? "Signature visible" : "Signature masquee"}</p>
        </div>
      ),
      sortable: false,
    },
    {
      key: "status",
      header: "Statut",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              row.is_active
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {row.is_active ? "Actif" : "Inactif"}
          </span>
          {row.is_default ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              Par defaut
            </span>
          ) : null}
        </div>
      ),
      sortable: false,
    },
  ];

  const actions: RowAction<ReportCardTemplateWithRelations>[] = [
    {
      label: "Modifier",
      variant: "secondary",
      onClick: async (row) => {
        setEditingItem(row);
        setRenderedComponent("add");
      },
    },
    {
      label: "Definir par defaut",
      variant: "secondary",
      show: (row) => !row.is_default,
      onClick: async (row) => {
        try {
          await service.setDefault(row.id);
          info("Modele de bulletin defini par defaut.", "success");
          tableRef.current?.refresh();
        } catch (error) {
          info(error, "error");
        }
      },
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Supprimer ce modele de bulletin ?",
      },
      onClick: async (row) => {
        try {
          await service.delete(row.id);
          info("Modele de bulletin supprime avec succes.", "success");
          tableRef.current?.refresh();
        } catch (error) {
          info(error, "error");
        }
      },
    },
  ];

  return (
    <DataTable<ReportCardTemplateWithRelations>
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
          annee: true,
          niveau: true,
          bulletins: true,
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id ? [{ etablissement_id }] : []),
          {
            OR: [
              { nom: { contains: text } },
              { description: { contains: text } },
            ],
          },
        ],
      })}
    />
  );
}
