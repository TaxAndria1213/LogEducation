import { useEffect, useMemo, useState } from "react";
import { FiActivity, FiCreditCard, FiFileText, FiRefreshCcw, FiUsers } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import ERPPage from "../../../components/page/ERPPage";
import { DataTable } from "../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../shared/table/types";
import { useAuth } from "../../../auth/AuthContext";
import { hasAccess } from "../../../components/components.build";
import {
  getFinanceModulePath,
  queueFinanceNavigationTarget,
} from "../utils/crossNavigation";
import OperationFinanciereService, {
  getOperationFinanciereActorLabel,
  getOperationFinanciereTargetLabel,
  getOperationFinanciereTypeLabel,
  type OperationFinanciereWithRelations,
} from "../../../services/operationFinanciere.service";
import NotFound from "../../NotFound";

function formatMoney(value: unknown) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;
  return `${(Number.isFinite(amount) ? amount : 0).toLocaleString("fr-FR")} MGA`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("fr-FR")} ${date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function JournalFinancierIndex() {
  const { user, roles, etablissement_id } = useAuth();
  const navigate = useNavigate();
  const service = useMemo(() => new OperationFinanciereService(), []);
  const [operations, setOperations] = useState<OperationFinanciereWithRelations[]>([]);

  const canAccess = useMemo(() => {
    if (!user || !roles) return false;
    return hasAccess(user, roles, "FIN.JOURNALFINANCIER.MENUACTION.LIST");
  }, [roles, user]);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      if (!etablissement_id || !canAccess) return;
      try {
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 250,
          includeSpec: JSON.stringify({
            facture: {
              include: {
                eleve: {
                  include: {
                    utilisateur: {
                      include: {
                        profil: true,
                      },
                    },
                  },
                },
              },
            },
            paiement: true,
            createur: {
              include: {
                profil: true,
              },
            },
          }),
        });

        if (!active) return;
        setOperations(
          result?.status.success
            ? ((result.data.data as OperationFinanciereWithRelations[]) ?? [])
            : [],
        );
      } catch {
        if (!active) return;
        setOperations([]);
      }
    };

    void loadSummary();

    return () => {
      active = false;
    };
  }, [canAccess, etablissement_id, service]);

  const totalAmount = useMemo(
    () =>
      operations.reduce((sum, item) => {
        const amount = typeof item.montant === "number" ? item.montant : Number(item.montant ?? 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [operations],
  );

  const uniqueActors = useMemo(
    () =>
      new Set(
        operations
          .map((item) => item.cree_par_utilisateur_id ?? item.createur?.id ?? null)
          .filter(Boolean),
      ).size,
    [operations],
  );

  const actionStats = useMemo(() => {
    return {
      invoices: operations.filter((item) => item.facture_id).length,
      payments: operations.filter((item) => item.paiement_id).length,
      refunds: operations.filter((item) => (item.type ?? "").toUpperCase().includes("REMBOURSEMENT")).length,
    };
  }, [operations]);

  const columns: ColumnDef<OperationFinanciereWithRelations>[] = [
    {
      key: "created_at",
      header: "Date",
      render: (row) => formatDate(row.created_at),
      sortKey: "created_at",
      sortable: false,
    },
    {
      key: "type",
      header: "Operation",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getOperationFinanciereTypeLabel(row.type)}</p>
          <p className="text-xs text-slate-500">{row.motif?.trim() || "Sans motif"}</p>
        </div>
      ),
      sortable: false,
      sortKey: "type",
    },
    {
      key: "target",
      header: "Cible",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getOperationFinanciereTargetLabel(row)}</p>
          <p className="text-xs text-slate-500">
            {row.facture?.eleve?.utilisateur?.profil?.prenom || row.facture?.eleve?.utilisateur?.profil?.nom
              ? `${row.facture?.eleve?.utilisateur?.profil?.prenom ?? ""} ${row.facture?.eleve?.utilisateur?.profil?.nom ?? ""}`.trim()
              : row.facture?.eleve?.code_eleve ?? ""}
          </p>
        </div>
      ),
      sortable: false,
    },
    {
      key: "montant",
      header: "Montant",
      render: (row) => formatMoney(row.montant),
      sortable: false,
      sortKey: "montant",
    },
    {
      key: "actor",
      header: "Auteur",
      render: (row) => getOperationFinanciereActorLabel(row),
      sortable: false,
    },
  ];

  const actions: RowAction<OperationFinanciereWithRelations>[] = [
    {
      label: "Ouvrir facture",
      variant: "secondary",
      show: (row) => Boolean(row.facture_id),
      onClick: async (row) => {
        if (!row.facture_id) return;
        queueFinanceNavigationTarget({
          module: "factures",
          id: row.facture_id,
          view: "detail",
        });
        navigate(getFinanceModulePath("factures"));
      },
    },
    {
      label: "Ouvrir paiement",
      variant: "secondary",
      show: (row) => Boolean(row.paiement_id),
      onClick: async (row) => {
        if (!row.paiement_id) return;
        queueFinanceNavigationTarget({
          module: "paiements",
          id: row.paiement_id,
          view: "detail",
        });
        navigate(getFinanceModulePath("paiements"));
      },
    },
  ];

  if (!canAccess) return <NotFound />;

  return (
    <ERPPage
      title="Journal Financier"
      description="Historique des corrections comptables, annulations, remboursements et avoirs."
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiActivity />
              <span className="text-sm font-medium">Operations</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{operations.length}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiUsers />
              <span className="text-sm font-medium">Auteurs</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{uniqueActors}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiRefreshCcw />
              <span className="text-sm font-medium">Montant trace</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatMoney(totalAmount)}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiCreditCard />
              <span className="text-sm font-medium">Paiements / Avoirs</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {actionStats.payments} / {actionStats.refunds}
            </p>
            <p className="mt-2 text-xs text-slate-500">{actionStats.invoices} operation(s) facture</p>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Historique detaille</h2>
            <p className="mt-1 text-sm text-slate-500">
              Recherche par type, motif, numero de facture, reference de paiement ou utilisateur.
            </p>
          </div>

          <DataTable<OperationFinanciereWithRelations>
            service={service}
            columns={columns}
            actions={actions}
            getRowId={(row) => row.id}
            initialQuery={{
              page: 1,
              take: 10,
              where: etablissement_id ? { etablissement_id } : {},
              includeSpec: {
                facture: {
                  include: {
                    eleve: { include: { utilisateur: { include: { profil: true } } } },
                  },
                },
                paiement: true,
                createur: {
                  include: {
                    profil: true,
                  },
                },
              },
            }}
            showSearch
            onSearchBuildWhere={(text) => ({
              AND: [
                ...(etablissement_id ? [{ etablissement_id }] : []),
                {
                  OR: [
                    { type: { contains: text } },
                    { motif: { contains: text } },
                    { facture: { is: { numero_facture: { contains: text } } } },
                    { paiement: { is: { reference: { contains: text } } } },
                    { createur: { is: { email: { contains: text } } } },
                    { createur: { is: { profil: { is: { prenom: { contains: text } } } } } },
                    { createur: { is: { profil: { is: { nom: { contains: text } } } } } },
                  ],
                },
              ],
            })}
          />
        </section>
      </div>
    </ERPPage>
  );
}
