import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import { useAuth } from "../../../../../auth/AuthContext";
import SanctionDisciplinaireService, { getSanctionDisplayLabel, getSanctionSecondaryLabel, type SanctionDisciplinaireWithRelations } from "../../../../../services/sanctionDisciplinaire.service";

export default function SanctionTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new SanctionDisciplinaireService(), []);

  const columns: ColumnDef<SanctionDisciplinaireWithRelations>[] = [
    { key: "sanction", header: "Sanction", render: (row) => <div><p className="font-medium text-slate-900">{getSanctionDisplayLabel(row)}</p><p className="text-xs text-slate-500">{getSanctionSecondaryLabel(row)}</p></div>, sortable: false, sortKey: "created_at" },
    { key: "periode", header: "Periode", render: (row) => { const debut = row.debut ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(row.debut)) : "-"; const fin = row.fin ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(row.fin)) : "-"; return `${debut} / ${fin}`; }, sortable: false },
    { key: "notes", header: "Notes", render: (row) => row.notes?.trim() || "-", sortable: false },
  ];

  const actions: RowAction<SanctionDisciplinaireWithRelations>[] = [
    { label: "Supprimer", variant: "danger", confirm: { title: "Suppression", message: "Supprimer cette sanction disciplinaire ?" }, onClick: async (row) => { await service.delete(row.id); tableRef.current?.refresh(); } },
  ];

  return (
    <DataTable<SanctionDisciplinaireWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      initialQuery={{ page: 1, take: 10, where: etablissement_id ? { incident: { eleve: { etablissement_id } } } : {}, includeSpec: { incident: { include: { eleve: { include: { utilisateur: { include: { profil: true } } } } } } } }}
      showSearch
      onSearchBuildWhere={(text) => ({ AND: [...(etablissement_id ? [{ incident: { eleve: { etablissement_id } } }] : []), { OR: [{ type_action: { contains: text } }, { notes: { contains: text } }, { incident: { eleve: { code_eleve: { contains: text } } } }, { incident: { eleve: { utilisateur: { profil: { prenom: { contains: text } } } } } }, { incident: { eleve: { utilisateur: { profil: { nom: { contains: text } } } } } }] }] })}
    />
  );
}
