import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { RegleNote } from "../../../../../types/models";
import RegleNoteService from "../../../../../services/regleNote.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import {
  getNoteRulesSummaryLabel,
  readPersistedNoteRules,
} from "../../regleNoteRules";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRuleYearLabel(rule: RegleNote) {
  if (!isPlainObject(rule.regle_json)) return "Annee non definie";
  const yearId = rule.regle_json.annee_scolaire_id;
  return typeof yearId === "string" && yearId.trim()
    ? yearId.trim()
    : "Annee non definie";
}

export default function RegleNoteTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new RegleNoteService(), []);

  const columns: ColumnDef<RegleNote>[] = [
    {
      key: "scope",
      header: "Portee",
      render: (row) => {
        const noteRules = readPersistedNoteRules({
          id: row.id,
          etablissement_id: row.etablissement_id,
          scope: row.scope,
          regle_json: isPlainObject(row.regle_json) ? row.regle_json : {},
          created_at: row.created_at,
          updated_at: row.updated_at,
        });

        return (
          <div>
            <p className="font-medium text-slate-900">
              {row.scope ?? "Sans portee"}
            </p>
            <p className="text-xs text-slate-500">
              {getNoteRulesSummaryLabel(noteRules)}
            </p>
          </div>
        );
      },
      sortable: false,
    },
    {
      key: "annee",
      header: "Annee",
      render: (row) => getRuleYearLabel(row),
      sortable: false,
    },
    {
      key: "updated_at",
      header: "Mis a jour",
      render: (row) =>
        formatDateWithLocalTimezone(row.updated_at.toString()).date,
      sortable: true,
      sortKey: "updated_at",
    },
  ];

  const actions: RowAction<RegleNote>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => console.log("voir", row.id),
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: { title: "Suppression", message: "Supprimer cette regle ?" },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<RegleNote>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id ? { etablissement_id } : {},
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [{ scope: { contains: text } }],
        ...(etablissement_id ? { etablissement_id } : {}),
      })}
    />
  );
}
