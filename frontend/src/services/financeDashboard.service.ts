import Service from "../app/api/Service";
import type { FactureWithRelations } from "./facture.service";
import type { PaiementWithRelations } from "./paiement.service";

export type FinanceDashboardMetricSummary = {
  totalFacture: number;
  totalEncaisse: number;
  activePaiementsCount: number;
  reversedPaiementsCount: number;
  partiallyPaidInvoices: number;
  openEcheancesCount: number;
  overdueEcheancesCount: number;
  overdueStudentsCount: number;
  impactedOverdueInvoices: number;
  resteARecouvrer: number;
  overdueAmount: number;
};

export type FinanceDashboardDailyReceipt = {
  dayKey: string;
  count: number;
  total: number;
  cash: number;
  bank: number;
  electronic: number;
  family: number;
};

export type FinanceDashboardChannelSummary = {
  key: string;
  label: string;
  count: number;
  total: number;
};

export type FinanceDashboardAgeingBucket = {
  key: string;
  label: string;
  count: number;
  total: number;
};

export type FinanceDashboardSummary = {
  generatedAt: string;
  metrics: FinanceDashboardMetricSummary;
  dailyReceipts: FinanceDashboardDailyReceipt[];
  paymentChannelStats: FinanceDashboardChannelSummary[];
  reconciliationStats: FinanceDashboardChannelSummary[];
  ageingBuckets: FinanceDashboardAgeingBucket[];
};

export type FinanceDashboardEcheance = {
  id: string;
  factureId?: string | null;
  planPaiementId?: string | null;
  eleveLabel: string;
  secondaryLabel: string;
  libelle: string;
  date: string;
  montant: number;
  montantRestant: number;
  devise: string;
  mode: string;
  statut: string;
};

export type FinanceDashboardOverdueStudent = {
  id: string;
  eleveLabel: string;
  secondaryLabel: string;
  devise: string;
  totalRestant: number;
  echeancesCount: number;
  facturesCount: number;
  oldestDate: string;
};

export type FinanceDashboardTopFee = {
  label: string;
  count: number;
  montant: number;
};

export type FinanceDashboardActivity = {
  generatedAt: string;
  recentFactures: FactureWithRelations[];
  recentPaiements: PaiementWithRelations[];
  overdueEcheances: FinanceDashboardEcheance[];
  overdueStudents: FinanceDashboardOverdueStudent[];
  upcomingEcheances: FinanceDashboardEcheance[];
  topFrais: FinanceDashboardTopFee[];
};

class FinanceDashboardService extends Service {
  constructor() {
    super("finance-dashboard/summary");
  }

  async getSummary(etablissementId: string) {
    return this.getAll({
      where: JSON.stringify({ etablissement_id: etablissementId }),
    }) as Promise<{ status: { success: boolean; message?: string }; data: FinanceDashboardSummary }>;
  }

  async getActivity(etablissementId: string) {
    const activityService = new Service("finance-dashboard/activity");
    return activityService.getAll({
      where: JSON.stringify({ etablissement_id: etablissementId }),
    }) as Promise<{ status: { success: boolean; message?: string }; data: FinanceDashboardActivity }>;
  }
}

export default FinanceDashboardService;
