import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import { useAuth } from "../../../../../auth/AuthContext";
import PlanPaiementEleveService, {
  getPlanPaiementEcheances,
  getPlanPaiementDisplayLabel,
  getPlanPaiementPaidAmount,
  getPlanPaiementRemainingAmount,
  getPlanPaiementSecondaryLabel,
  type PlanPaiementEleveWithRelations,
} from "../../../../../services/planPaiementEleve.service";
import { usePlanPaiementStore } from "../../store/PlanPaiementIndexStore";

export default function PlanPaiementTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new PlanPaiementEleveService(), []);
  const setSelectedPlanPaiement = usePlanPaiementStore((state) => state.setSelectedPlanPaiement);
  const setRenderedComponent = usePlanPaiementStore((state) => state.setRenderedComponent);

  const columns: ColumnDef<PlanPaiementEleveWithRelations>[] = [
    {
      key: "eleve",
      header: "Eleve",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getPlanPaiementDisplayLabel(row)}</p>
          <p className="text-xs text-slate-500">{getPlanPaiementSecondaryLabel(row)}</p>
        </div>
      ),
      sortable: false,
      sortKey: "created_at",
    },
    {
      key: "mode",
      header: "Mode",
      render: (row) => row.plan_json?.mode_paiement ?? "-",
      sortable: false,
    },
    {
      key: "tranches",
      header: "Tranches",
      render: (row) => getPlanPaiementEcheances(row).length,
      sortable: false,
    },
    {
      key: "devise",
      header: "Devise",
      render: (row) => row.plan_json?.devise ?? "MGA",
      sortable: false,
    },
    {
      key: "regle",
      header: "Regle / Reste",
      render: (row) =>
        `${getPlanPaiementPaidAmount(row).toLocaleString("fr-FR")} / ${getPlanPaiementRemainingAmount(row).toLocaleString("fr-FR")} ${row.plan_json?.devise ?? "MGA"}`,
      sortable: false,
    },
  ];

  const actions: RowAction<PlanPaiementEleveWithRelations>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: async (row) => {
        setSelectedPlanPaiement(row);
        setRenderedComponent("detail");
      },
    },
    {
      label: "Modifier",
      variant: "primary",
      onClick: async (row) => {
        setSelectedPlanPaiement(row);
        setRenderedComponent("edit");
      },
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: { title: "Suppression", message: "Supprimer ce plan de paiement ?" },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<PlanPaiementEleveWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id ? { eleve: { is: { etablissement_id } } } : {},
        includeSpec: {
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          annee: true,
          remise: true,
          echeances: { orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }] },
        },
      }}
      showSearch
      onRowClick={(row) => {
        setSelectedPlanPaiement(row);
        setRenderedComponent("detail");
      }}
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id ? [{ eleve: { is: { etablissement_id } } }] : []),
          {
            OR: [
              { eleve: { is: { code_eleve: { contains: text } } } },
              { annee: { is: { nom: { contains: text } } } },
            ],
          },
        ],
      })}
    />
  );
}
