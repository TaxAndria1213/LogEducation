import React from "react";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import SessionAppelService, {
  getSessionAppelDisplayLabel,
  getSessionAppelSecondaryLabel,
  type SessionAppelWithRelations,
} from "../../../../../services/sessionAppel.service";
import { useAuth } from "../../../../../hooks/useAuth";

export default function SessionAppelTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new SessionAppelService(), []);

  const columns: ColumnDef<SessionAppelWithRelations>[] = [
    {
      key: "session",
      header: "Session",
      render: (row) => <div><p className="font-medium text-slate-900">{getSessionAppelDisplayLabel(row)}</p><p className="text-xs text-slate-500">{getSessionAppelSecondaryLabel(row)}</p></div>,
      sortable: false,
    },
    {
      key: "date",
      header: "Date",
      render: (row) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(row.date)),
      sortable: true,
      sortKey: "date",
    },
    {
      key: "effectif",
      header: "Effectif",
      render: (row) => `${row.presences?.length ?? 0} eleve(s)`,
      sortable: false,
    },
  ];

  const actions: RowAction<SessionAppelWithRelations>[] = [
    {
      label: "Supprimer",
      variant: "danger",
      confirm: { title: "Suppression", message: "Supprimer cette session d'appel ?" },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<SessionAppelWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id ? { classe: { etablissement_id } } : {},
        includeSpec: {
          classe: { include: { niveau: true, site: true, annee: true } },
          creneau: true,
          prisPar: { include: { personnel: { include: { utilisateur: { include: { profil: true } } } } } },
          presences: { include: { eleve: { include: { utilisateur: { include: { profil: true } } } } } },
        },
        orderBy: [{ date: "desc" }],
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id ? [{ classe: { etablissement_id } }] : []),
          {
            OR: [
              { classe: { nom: { contains: text } } },
              { creneau: { nom: { contains: text } } },
              { classe: { niveau: { nom: { contains: text } } } },
            ],
          },
        ],
      })}
    />
  );
}
