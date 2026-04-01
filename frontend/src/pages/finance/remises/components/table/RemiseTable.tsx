import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import { useAuth } from "../../../../../auth/AuthContext";
import RemiseService, {
  getRemiseCategoryLabel,
  getRemiseDisplayLabel,
  getRemiseSecondaryLabel,
  getRemiseTypeLabel,
  getRemiseValidationStatusLabel,
  type RemiseWithRelations,
} from "../../../../../services/remise.service";

export default function RemiseTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new RemiseService(), []);

  const columns: ColumnDef<RemiseWithRelations>[] = [
    { key: "remise", header: "Remise", render: (row) => <div><p className="font-medium text-slate-900">{getRemiseDisplayLabel(row)}</p><p className="text-xs text-slate-500">{getRemiseSecondaryLabel(row)}</p></div>, sortable: false, sortKey: "nom" },
    { key: "categorie", header: "Categorie", render: (row) => getRemiseCategoryLabel(row), sortable: false },
    { key: "validation", header: "Validation", render: (row) => getRemiseValidationStatusLabel(row), sortable: false },
    { key: "type", header: "Type", render: (row) => getRemiseTypeLabel(row.type), sortable: false, sortKey: "type" },
    { key: "valeur", header: "Valeur", render: (row) => (row.type ?? "").toUpperCase() === "PERCENT" ? `${Number(row.valeur ?? 0)}%` : Number(row.valeur ?? 0).toLocaleString("fr-FR"), sortable: false, sortKey: "valeur" },
    { key: "regles", header: "Regles", render: (row) => row.regles_json ? "JSON defini" : "-", sortable: false },
  ];

  const actions: RowAction<RemiseWithRelations>[] = [
    { label: "Approuver", variant: "secondary", show: (row) => getRemiseValidationStatusLabel(row) === "En attente", onClick: async (row) => { const motif = window.prompt("Note d'approbation", "") ?? ""; await service.approve(row.id, { motif: motif.trim() || null }); tableRef.current?.refresh(); } },
    { label: "Refuser", variant: "danger", show: (row) => getRemiseValidationStatusLabel(row) === "En attente", onClick: async (row) => { const motif = window.prompt("Motif du refus", "") ?? ""; await service.reject(row.id, { motif: motif.trim() || null }); tableRef.current?.refresh(); } },
    { label: "Supprimer", variant: "danger", confirm: { title: "Suppression", message: "Supprimer cette remise ?" }, onClick: async (row) => { await service.delete(row.id); tableRef.current?.refresh(); } },
  ];

  return (
    <DataTable<RemiseWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      initialQuery={{ page: 1, take: 10, where: etablissement_id ? { etablissement_id } : {} }}
      showSearch
      onSearchBuildWhere={(text) => ({ AND: [...(etablissement_id ? [{ etablissement_id }] : []), { OR: [{ nom: { contains: text } }, { type: { contains: text } }] }] })}
    />
  );
}
