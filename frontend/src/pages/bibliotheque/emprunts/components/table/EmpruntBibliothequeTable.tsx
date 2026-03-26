import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import { useAuth } from "../../../../../hooks/useAuth";
import EmpruntBibliothequeService, {
  getBorrowerLabel,
  getEmpruntDisplayLabel,
  getEmpruntSecondaryLabel,
  getEmpruntStatus,
  getEmpruntStatusLabel,
  type EmpruntBibliothequeWithRelations,
} from "../../../../../services/empruntBibliotheque.service";

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR");
}

export default function EmpruntBibliothequeTable() {
  const { etablissement_id } = useAuth();
  const service = React.useMemo(() => new EmpruntBibliothequeService(), []);
  const tableRef = React.useRef<DataTableHandle>(null);

  const columns: ColumnDef<EmpruntBibliothequeWithRelations>[] = [
    {
      key: "ressource",
      header: "Emprunt",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getEmpruntDisplayLabel(row)}</p>
          <p className="text-xs text-slate-500">{getEmpruntSecondaryLabel(row)}</p>
        </div>
      ),
      sortable: false,
      sortKey: "emprunte_le",
    },
    {
      key: "emprunteur",
      header: "Emprunteur",
      render: (row) => getBorrowerLabel(row),
      sortable: false,
      sortKey: "id",
    },
    {
      key: "retour_prevu",
      header: "Retour prevu",
      render: (row) => formatDate(row.du_le),
      sortable: false,
      sortKey: "du_le",
    },
    {
      key: "retour",
      header: "Retour",
      render: (row) => formatDate(row.retourne_le),
      sortable: false,
      sortKey: "retourne_le",
    },
    {
      key: "statut",
      header: "Statut",
      render: (row) => {
        const status = getEmpruntStatus(row);
        return (
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${status === "EN_RETARD" ? "border-rose-200 bg-rose-50 text-rose-700" : status === "RETOURNE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
            {getEmpruntStatusLabel(status)}
          </span>
        );
      },
      sortable: false,
      sortKey: "statut",
    },
  ];

  const actions: RowAction<EmpruntBibliothequeWithRelations>[] = [
    {
      label: "Retourner",
      variant: "secondary",
      show: (row) => !row.retourne_le,
      onClick: async (row) => {
        await service.markAsReturned(row.id, {});
        tableRef.current?.refresh();
      },
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Supprimer cet emprunt ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<EmpruntBibliothequeWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id ? { ressource: { is: { etablissement_id } } } : {},
        includeSpec: {
          ressource: true,
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          personnel: { include: { utilisateur: { include: { profil: true } } } },
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id ? [{ ressource: { is: { etablissement_id } } }] : []),
          {
            OR: [
              { ressource: { is: { titre: { contains: text } } } },
              { ressource: { is: { code: { contains: text } } } },
            ],
          },
        ],
      })}
    />
  );
}
