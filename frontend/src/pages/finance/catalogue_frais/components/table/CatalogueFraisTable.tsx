import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import { useAuth } from "../../../../../auth/AuthContext";
import CatalogueFraisService, {
  getCatalogueFraisDisplayLabel,
  getCatalogueFraisSecondaryLabel,
  isApprovedCatalogueFrais,
  type CatalogueFraisWithRelations,
} from "../../../../../services/catalogueFrais.service";

export default function CatalogueFraisTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new CatalogueFraisService(), []);
  const buildSearchWhere = React.useCallback(
    (text: string) => {
      const normalized = text.trim();
      const maybeNumber = Number(normalized);
      const orConditions: Array<Record<string, unknown>> = [
        { nom: { contains: normalized } },
        { description: { contains: normalized } },
        { devise: { contains: normalized } },
        { periodicite: { contains: normalized } },
      ];

      return {
        AND: [...(etablissement_id ? [{ etablissement_id }] : []), { OR: orConditions }],
      };
    },
    [etablissement_id],
  );

  const columns: ColumnDef<CatalogueFraisWithRelations>[] = [
    { key: "frais", header: "Frais", render: (row) => <div><p className="font-medium text-slate-900">{getCatalogueFraisDisplayLabel(row)}</p><p className="text-xs text-slate-500">{getCatalogueFraisSecondaryLabel(row)}</p></div>, sortable: false, sortKey: "nom" },
    { key: "montant", header: "Montant", render: (row) => `${Number(row.montant ?? 0).toLocaleString("fr-FR")} ${row.devise ?? "MGA"}`, sortable: false, sortKey: "montant" },
    { key: "periodicite", header: "Periodicite", render: (row) => row.est_recurrent ? row.periodicite ?? "Recurrent" : "Ponctuel", sortable: false, sortKey: "periodicite" },
    { key: "validation", header: "Validation", render: (row) => row.statut_validation ?? "EN_ATTENTE", sortable: false, sortKey: "statut_validation" },
    { key: "usage", header: "Usage", render: (row) => row._count?.lignesFacture ?? 0, sortable: false },
  ];

  const actions: RowAction<CatalogueFraisWithRelations>[] = [
    { label: "Approuver", variant: "primary", show: (row) => !isApprovedCatalogueFrais(row), onClick: async (row) => { await service.approve(row.id); tableRef.current?.refresh(); } },
    { label: "Rejeter", variant: "secondary", show: (row) => (row.statut_validation ?? "").toUpperCase() !== "REJETEE", onClick: async (row) => { await service.reject(row.id); tableRef.current?.refresh(); } },
    { label: "Supprimer", variant: "danger", confirm: { title: "Suppression", message: "Supprimer ce frais catalogue ?" }, onClick: async (row) => { await service.delete(row.id); tableRef.current?.refresh(); } },
  ];

  return (
    <DataTable<CatalogueFraisWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      initialQuery={{ page: 1, take: 10, where: etablissement_id ? { etablissement_id } : {}, includeSpec: { niveau: true, _count: { select: { lignesFacture: true } } } }}
      showSearch
      onSearchBuildWhere={buildSearchWhere}
    />
  );
}
