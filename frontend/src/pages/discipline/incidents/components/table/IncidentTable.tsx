import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import { useAuth } from "../../../../../auth/AuthContext";
import IncidentDisciplinaireService, {
  getIncidentDisplayLabel,
  getIncidentSecondaryLabel,
  getIncidentStatusMeta,
  type IncidentDisciplinaireWithRelations,
} from "../../../../../services/incidentDisciplinaire.service";

export default function IncidentTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new IncidentDisciplinaireService(), []);

  const columns: ColumnDef<IncidentDisciplinaireWithRelations>[] = [
    {
      key: "incident",
      header: "Incident",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getIncidentDisplayLabel(row)}</p>
          <p className="text-xs text-slate-500">{getIncidentSecondaryLabel(row)}</p>
        </div>
      ),
      sortable: false,
      sortKey: "date",
    },
    {
      key: "date",
      header: "Date",
      render: (row) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(row.date)),
      sortable: false,
      sortKey: "date",
    },
    {
      key: "gravite",
      header: "Gravite",
      render: (row) => row.gravite != null ? `${row.gravite}/5` : "-",
      sortable: false,
      sortKey: "gravite",
    },
    {
      key: "statut",
      header: "Statut",
      render: (row) => {
        const meta = getIncidentStatusMeta(row.statut);
        return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${meta.tone}`}>{meta.label}</span>;
      },
      sortable: false,
      sortKey: "statut",
    },
    {
      key: "sanctions",
      header: "Sanctions",
      render: (row) => row.sanctions?.length ?? 0,
      sortable: false,
    },
  ];

  const actions: RowAction<IncidentDisciplinaireWithRelations>[] = [
    {
      label: "Supprimer",
      variant: "danger",
      confirm: { title: "Suppression", message: "Supprimer cet incident disciplinaire ?" },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<IncidentDisciplinaireWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id ? { eleve: { etablissement_id } } : {},
        includeSpec: {
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          sanctions: true,
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id ? [{ eleve: { etablissement_id } }] : []),
          {
            OR: [
              { eleve: { code_eleve: { contains: text } } },
              { eleve: { utilisateur: { profil: { prenom: { contains: text } } } } },
              { eleve: { utilisateur: { profil: { nom: { contains: text } } } } },
              { description: { contains: text } },
              { statut: { contains: text } },
            ],
          },
        ],
      })}
    />
  );
}
