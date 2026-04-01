import React from "react";
import { useAuth } from "../../../../hooks/useAuth";
import { formatDateWithLocalTimezone } from "../../../../app/utils/functions";
import EvenementCalendrierService from "../../../../services/evenementCalendrier.service";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../../shared/table/types";
import {
  getEventDurationLabel,
  getEventStatus,
  getEventTypeLabel,
  type EventRow,
} from "../../types";
import { useEvenementStore } from "../../store/EvenementIndexStore";
import { useEvenementCreateStore } from "../../store/EvenementCreateStore";

export default function EventsList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new EvenementCalendrierService(), []);
  const setRenderedComponent = useEvenementStore((state) => state.setRenderedComponent);
  const startEdit = useEvenementCreateStore((state) => state.startEdit);
  const startDuplicate = useEvenementCreateStore((state) => state.startDuplicate);
  const resetEditor = useEvenementCreateStore((state) => state.resetEditor);

  const baseWhere = etablissement_id ? { etablissement_id } : {};

  const columns: ColumnDef<EventRow>[] = [
    {
      key: "titre",
      header: "Titre",
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-900">{row.titre}</div>
          <div className="text-xs text-slate-500">
            {getEventTypeLabel(row.type)}
            {row.site?.nom ? ` - ${row.site.nom}` : ""}
          </div>
        </div>
      ),
      sortable: true,
      sortKey: "titre",
    },
    {
      key: "statut",
      header: "Statut",
      render: (row) => {
        const status = getEventStatus(row);
        return (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}
          >
            {status.label}
          </span>
        );
      },
    },
    {
      key: "debut",
      header: "Debut",
      render: (row) => formatDateWithLocalTimezone(row.debut.toString()).dateHeure,
      sortable: true,
      sortKey: "debut",
    },
    {
      key: "fin",
      header: "Fin",
      render: (row) => formatDateWithLocalTimezone(row.fin.toString()).dateHeure,
      sortable: true,
      sortKey: "fin",
    },
    {
      key: "duree",
      header: "Duree",
      render: (row) => getEventDurationLabel(row),
    },
    {
      key: "description",
      header: "Description",
      render: (row) => row.description ?? "-",
    },
  ];

  const actions: RowAction<EventRow>[] = [
    {
      label: "Modifier",
      variant: "secondary",
      onClick: (row) => {
        startEdit(row);
        setRenderedComponent("add");
      },
    },
    {
      label: "Dupliquer",
      variant: "secondary",
      onClick: (row) => {
        startDuplicate(row);
        setRenderedComponent("add");
      },
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Supprimer cet evenement ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            resetEditor(etablissement_id);
            setRenderedComponent("add");
          }}
          className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Ajouter un evenement
        </button>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        <DataTable<EventRow>
          ref={tableRef}
          service={service}
          columns={columns}
          actions={actions}
          getRowId={(row) => row.id}
          initialQuery={{
            page: 1,
            take: 10,
            where: baseWhere,
            includeSpec: {
              site: true,
            },
            orderBy: { debut: "desc" },
          }}
          showSearch
          onSearchBuildWhere={(text) => ({
            AND: [
              baseWhere,
              {
                OR: [
                  { titre: { contains: text } },
                  { type: { contains: text } },
                  { description: { contains: text } },
                  { site: { nom: { contains: text } } },
                ],
              },
            ],
          })}
        />
      </section>
    </div>
  );
}
