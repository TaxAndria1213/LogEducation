import React from "react";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { useAuth } from "../../../../../hooks/useAuth";
import PresenceEleveService, { getPresenceEleveDisplayLabel, getPresenceEleveSecondaryLabel, getPresenceStatusMeta, type PresenceEleveWithRelations } from "../../../../../services/presenceEleve.service";

export default function PresenceEleveTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new PresenceEleveService(), []);
  const columns: ColumnDef<PresenceEleveWithRelations>[] = [
    { key: "eleve", header: "Eleve", render: (row) => <div><p className="font-medium text-slate-900">{getPresenceEleveDisplayLabel(row)}</p><p className="text-xs text-slate-500">{getPresenceEleveSecondaryLabel(row)}</p></div> },
    { key: "statut", header: "Statut", render: (row) => { const meta = getPresenceStatusMeta(row.statut); return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.tone}`}>{meta.label}</span>; } },
    { key: "note", header: "Note", render: (row) => row.note ?? "-" },
  ];
  const actions: RowAction<PresenceEleveWithRelations>[] = [{ label: "Supprimer", variant: "danger", confirm: { title: "Suppression", message: "Supprimer cette presence eleve ?" }, onClick: async (row) => { await service.delete(row.id); tableRef.current?.refresh(); } }];
  return <DataTable<PresenceEleveWithRelations> ref={tableRef} service={service} columns={columns} actions={actions} getRowId={(row) => row.id} initialQuery={{ page: 1, take: 10, where: etablissement_id ? { session: { classe: { etablissement_id } } } : {}, includeSpec: { session: { include: { classe: { include: { niveau: true, site: true, annee: true } }, creneau: true } }, eleve: { include: { utilisateur: { include: { profil: true } } } } }, orderBy: [{ created_at: "desc" }] }} showSearch onSearchBuildWhere={(text) => ({ AND: [ ...(etablissement_id ? [{ session: { classe: { etablissement_id } } }] : []), { OR: [{ eleve: { code_eleve: { contains: text } } }, { eleve: { utilisateur: { profil: { prenom: { contains: text } } } } }, { eleve: { utilisateur: { profil: { nom: { contains: text } } } } }, { statut: { contains: text } }] } ] })} />;
}
