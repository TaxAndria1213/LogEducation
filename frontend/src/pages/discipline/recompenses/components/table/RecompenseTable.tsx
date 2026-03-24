import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import { useAuth } from "../../../../../auth/AuthContext";
import RecompenseService, { getRecompenseDisplayLabel, getRecompenseSecondaryLabel, type RecompenseWithRelations } from "../../../../../services/recompense.service";

export default function RecompenseTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new RecompenseService(), []);

  const columns: ColumnDef<RecompenseWithRelations>[] = [
    { key: "recompense", header: "Recompense", render: (row) => <div><p className="font-medium text-slate-900">{getRecompenseDisplayLabel(row)}</p><p className="text-xs text-slate-500">{getRecompenseSecondaryLabel(row)}</p></div>, sortable: false, sortKey: "date" },
    { key: "date", header: "Date", render: (row) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(row.date)), sortable: false, sortKey: "date" },
    { key: "points", header: "Points", render: (row) => row.points ?? 0, sortable: false, sortKey: "points" },
    { key: "raison", header: "Motif", render: (row) => row.raison?.trim() || "-", sortable: false },
  ];

  const actions: RowAction<RecompenseWithRelations>[] = [
    { label: "Supprimer", variant: "danger", confirm: { title: "Suppression", message: "Supprimer cette recompense ?" }, onClick: async (row) => { await service.delete(row.id); tableRef.current?.refresh(); } },
  ];

  return (
    <DataTable<RecompenseWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      initialQuery={{ page: 1, take: 10, where: etablissement_id ? { eleve: { etablissement_id } } : {}, includeSpec: { eleve: { include: { utilisateur: { include: { profil: true } } } } } }}
      showSearch
      onSearchBuildWhere={(text) => ({ AND: [...(etablissement_id ? [{ eleve: { etablissement_id } }] : []), { OR: [{ eleve: { code_eleve: { contains: text } } }, { eleve: { utilisateur: { profil: { prenom: { contains: text } } } } }, { eleve: { utilisateur: { profil: { nom: { contains: text } } } } }, { raison: { contains: text } }] }] })}
    />
  );
}
