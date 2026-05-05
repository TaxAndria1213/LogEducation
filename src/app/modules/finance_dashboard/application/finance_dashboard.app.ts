import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient } from "@prisma/client";
import Response from "../../../common/app/response";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";

type ChannelKey = "cash" | "bank" | "electronic" | "family";

type ChannelSummary = {
  key: string;
  label: string;
  count: number;
  total: number;
};

class FinanceDashboardApp {
  public app: Application;
  public router: Router;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.prisma = prisma;
    this.routes();
  }

  public routes(): Router {
    this.router.get("/summary", this.summary.bind(this));
    this.router.get("/activity", this.activity.bind(this));
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.etablissement_id === "string"
        ? queryWhere.etablissement_id.trim()
        : undefined;

    const tenantCandidates = [requestTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour le dashboard finance.");
    }

    return tenantCandidates[0];
  }

  private toMoney(value: unknown) {
    const amount =
      typeof value === "object" && value !== null && "toNumber" in value
        ? (value as { toNumber: () => number }).toNumber()
        : Number(value ?? 0);
    return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
  }

  private startOfDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private diffInDays(from: Date, to: Date) {
    const diff = this.startOfDay(to).getTime() - this.startOfDay(from).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  private toDayKey(value?: Date | string | null) {
    if (!value) return "Sans date";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Sans date";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getPaymentChannel(method?: string | null): ChannelKey | "other" {
    switch ((method ?? "").toLowerCase()) {
      case "cash":
        return "cash";
      case "famille":
        return "family";
      case "bank":
      case "virement":
      case "cheque":
      case "card":
        return "bank";
      case "mobile_money":
        return "electronic";
      default:
        return "other";
    }
  }

  private buildPaymentChannelStats(rows: Array<{ methode: string | null; montant: unknown }>) {
    const grouped = new Map<ChannelKey, ChannelSummary>([
      ["cash", { key: "cash", label: "Caisse", count: 0, total: 0 }],
      ["bank", { key: "bank", label: "Banque", count: 0, total: 0 }],
      ["electronic", { key: "electronic", label: "Electronique", count: 0, total: 0 }],
      ["family", { key: "family", label: "Paiement famille", count: 0, total: 0 }],
    ]);

    rows.forEach((row) => {
      const key = this.getPaymentChannel(row.methode);
      if (key === "other") return;
      const current = grouped.get(key);
      if (!current) return;
      current.count += 1;
      current.total += this.toMoney(row.montant);
    });

    return [...grouped.values()].sort((a, b) => b.total - a.total || b.count - a.count);
  }

  private buildDailyReceipts(rows: Array<{ paye_le: Date; created_at: Date; methode: string | null; montant: unknown }>) {
    const grouped = new Map<
      string,
      { dayKey: string; count: number; total: number; cash: number; bank: number; electronic: number; family: number }
    >();

    rows.forEach((row) => {
      const dayKey = this.toDayKey(row.paye_le ?? row.created_at);
      const current = grouped.get(dayKey) ?? {
        dayKey,
        count: 0,
        total: 0,
        cash: 0,
        bank: 0,
        electronic: 0,
        family: 0,
      };
      const amount = this.toMoney(row.montant);
      current.count += 1;
      current.total += amount;
      const channel = this.getPaymentChannel(row.methode);
      if (channel !== "other") current[channel] += amount;
      grouped.set(dayKey, current);
    });

    return [...grouped.values()]
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
      .slice(0, 10);
  }

  private buildAgeingBuckets(rows: Array<{ date_echeance: Date; montant_restant: unknown }>, today: Date) {
    const buckets = [
      { key: "1-30", label: "1 a 30 jours", minDays: 1, maxDays: 30, count: 0, total: 0 },
      { key: "31-60", label: "31 a 60 jours", minDays: 31, maxDays: 60, count: 0, total: 0 },
      { key: "61-90", label: "61 a 90 jours", minDays: 61, maxDays: 90, count: 0, total: 0 },
      { key: "90+", label: "90+ jours", minDays: 91, maxDays: null as number | null, count: 0, total: 0 },
    ];

    rows.forEach((row) => {
      const lateDays = this.diffInDays(row.date_echeance, today);
      const bucket = buckets.find(
        (candidate) =>
          lateDays >= candidate.minDays &&
          (candidate.maxDays === null || lateDays <= candidate.maxDays),
      );
      if (!bucket) return;
      bucket.count += 1;
      bucket.total += this.toMoney(row.montant_restant);
    });

    return buckets.map(({ minDays, maxDays, ...bucket }) => bucket);
  }

  private buildOpenEcheanceWhere(tenantId: string, before?: Date) {
    return {
      montant_restant: { gt: 0 },
      statut: { notIn: ["PAYEE", "ANNULEE"] },
      ...(before ? { date_echeance: { lt: before } } : {}),
      OR: [
        { facture: { is: { etablissement_id: tenantId } } },
        { facture_id: null, eleve: { is: { etablissement_id: tenantId } } },
      ],
    };
  }

  private getStudentLabel(eleve?: {
    code_eleve?: string | null;
    utilisateur?: { profil?: { prenom?: string | null; nom?: string | null } | null } | null;
  } | null) {
    if (!eleve) return "Eleve non renseigne";
    const prenom = eleve.utilisateur?.profil?.prenom?.trim() ?? "";
    const nom = eleve.utilisateur?.profil?.nom?.trim() ?? "";
    const fullName = [prenom, nom].filter(Boolean).join(" ").trim();
    return fullName || eleve.code_eleve?.trim() || "Eleve non renseigne";
  }

  private getStudentSecondaryLabel(row: {
    eleve?: {
      code_eleve?: string | null;
      utilisateur?: { profil?: { prenom?: string | null; nom?: string | null } | null } | null;
    } | null;
    annee?: { nom?: string | null } | null;
  }) {
    const student = this.getStudentLabel(row.eleve);
    const code = row.eleve?.code_eleve?.trim();
    const year = row.annee?.nom?.trim();
    return [student, code && code !== student ? code : "", year].filter(Boolean).join(" - ");
  }

  private toDashboardEcheance(row: {
    id: string;
    facture_id: string | null;
    plan_paiement_id: string | null;
    ordre: number;
    libelle: string | null;
    date_echeance: Date;
    montant_prevu: unknown;
    montant_restant: unknown;
    devise: string | null;
    statut: string;
    facture?: {
      id: string;
      devise: string | null;
      eleve?: {
        code_eleve?: string | null;
        utilisateur?: { profil?: { prenom?: string | null; nom?: string | null } | null } | null;
      } | null;
      annee?: { nom?: string | null } | null;
    } | null;
    eleve?: {
      code_eleve?: string | null;
      utilisateur?: { profil?: { prenom?: string | null; nom?: string | null } | null } | null;
    } | null;
    annee?: { nom?: string | null } | null;
  }) {
    const owner = row.facture ?? row;
    return {
      id: row.id,
      factureId: row.facture_id,
      planPaiementId: row.plan_paiement_id,
      eleveLabel: this.getStudentLabel(owner.eleve),
      secondaryLabel: this.getStudentSecondaryLabel(owner),
      libelle: row.libelle?.trim() || `Tranche ${row.ordre}`,
      date: row.date_echeance.toISOString(),
      montant: this.toMoney(row.montant_prevu),
      montantRestant: Math.max(0, this.toMoney(row.montant_restant)),
      devise: row.devise ?? row.facture?.devise ?? "MGA",
      mode: row.plan_paiement_id ? "ECHELONNE" : "FACTURE",
      statut: String(row.statut ?? "A_VENIR").toUpperCase(),
    };
  }

  private buildOverdueStudents(rows: Array<ReturnType<FinanceDashboardApp["toDashboardEcheance"]>>) {
    const grouped = new Map<
      string,
      {
        id: string;
        eleveLabel: string;
        secondaryLabel: string;
        devise: string;
        totalRestant: number;
        echeancesCount: number;
        facturesCount: number;
        oldestDate: string;
      }
    >();

    rows.forEach((item) => {
      const key = `${item.eleveLabel}__${item.secondaryLabel}`;
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, {
          id: key,
          eleveLabel: item.eleveLabel,
          secondaryLabel: item.secondaryLabel,
          devise: item.devise,
          totalRestant: item.montantRestant,
          echeancesCount: 1,
          facturesCount: item.factureId ? 1 : 0,
          oldestDate: item.date,
        });
        return;
      }

      current.totalRestant += item.montantRestant;
      current.echeancesCount += 1;
      if (item.factureId) current.facturesCount += 1;
      if (new Date(item.date).getTime() < new Date(current.oldestDate).getTime()) {
        current.oldestDate = item.date;
      }
    });

    return [...grouped.values()]
      .sort(
        (a, b) =>
          b.totalRestant - a.totalRestant ||
          new Date(a.oldestDate).getTime() - new Date(b.oldestDate).getTime(),
      )
      .slice(0, 8);
  }

  private async activity(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const today = this.startOfDay(new Date());
      const nextThirtyDays = new Date(today);
      nextThirtyDays.setDate(nextThirtyDays.getDate() + 30);

      const echeanceSelect = {
        id: true,
        facture_id: true,
        plan_paiement_id: true,
        ordre: true,
        libelle: true,
        date_echeance: true,
        montant_prevu: true,
        montant_restant: true,
        devise: true,
        statut: true,
        facture: {
          select: {
            id: true,
            devise: true,
            eleve: {
              select: {
                code_eleve: true,
                utilisateur: {
                  select: {
                    profil: { select: { prenom: true, nom: true } },
                  },
                },
              },
            },
            annee: { select: { nom: true } },
          },
        },
        eleve: {
          select: {
            code_eleve: true,
            utilisateur: {
              select: {
                profil: { select: { prenom: true, nom: true } },
              },
            },
          },
        },
        annee: { select: { nom: true } },
      };

      const [
        recentFactures,
        recentPaiements,
        overdueRows,
        upcomingRows,
        topFraisRows,
      ] = await Promise.all([
        this.prisma.facture.findMany({
          where: { etablissement_id: tenantId },
          select: {
            id: true,
            numero_facture: true,
            nature: true,
            statut: true,
            total_montant: true,
            devise: true,
            date_emission: true,
            created_at: true,
            eleve_id: true,
            annee_scolaire_id: true,
            eleve: {
              select: {
                id: true,
                code_eleve: true,
                utilisateur: {
                  select: {
                    profil: { select: { prenom: true, nom: true } },
                  },
                },
              },
            },
            annee: { select: { id: true, nom: true } },
          },
          orderBy: [{ date_emission: "desc" }, { created_at: "desc" }],
          take: 6,
        }),
        this.prisma.paiement.findMany({
          where: { facture: { is: { etablissement_id: tenantId } } },
          select: {
            id: true,
            numero_recu: true,
            reference: true,
            paye_le: true,
            created_at: true,
            montant: true,
            statut: true,
            methode: true,
            facture: {
              select: {
                id: true,
                numero_facture: true,
                statut: true,
                devise: true,
                eleve: {
                  select: {
                    id: true,
                    code_eleve: true,
                    utilisateur: {
                      select: {
                        profil: { select: { prenom: true, nom: true } },
                      },
                    },
                  },
                },
                annee: { select: { id: true, nom: true } },
              },
            },
          },
          orderBy: [{ paye_le: "desc" }, { created_at: "desc" }],
          take: 6,
        }),
        this.prisma.echeancePaiement.findMany({
          where: this.buildOpenEcheanceWhere(tenantId, today) as never,
          select: echeanceSelect as never,
          orderBy: [{ date_echeance: "asc" }, { ordre: "asc" }],
        }),
        this.prisma.echeancePaiement.findMany({
          where: {
            ...this.buildOpenEcheanceWhere(tenantId),
            date_echeance: { gte: today, lte: nextThirtyDays },
          } as never,
          select: echeanceSelect as never,
          orderBy: [{ date_echeance: "asc" }, { ordre: "asc" }],
          take: 8,
        }),
        this.prisma.factureLigne.findMany({
          where: {
            facture: {
              is: {
                etablissement_id: tenantId,
                statut: { not: "ANNULEE" },
              },
            },
          },
          select: {
            libelle: true,
            montant: true,
            frais: { select: { nom: true } },
          },
          take: 1500,
        }),
      ]);

      const overdueEcheances = overdueRows
        .map((row) => this.toDashboardEcheance(row as never))
        .filter((row) => row.montantRestant > 0);
      const upcomingEcheances = upcomingRows
        .map((row) => this.toDashboardEcheance(row as never))
        .filter((row) => row.montantRestant > 0);
      const fraisUsage = new Map<string, { label: string; count: number; montant: number }>();
      topFraisRows.forEach((line) => {
        const label = line.frais?.nom?.trim() || line.libelle?.trim() || "Ligne sans libelle";
        const current = fraisUsage.get(label) ?? { label, count: 0, montant: 0 };
        current.count += 1;
        current.montant += this.toMoney(line.montant);
        fraisUsage.set(label, current);
      });

      Response.success(res, "Activite finance recuperee.", {
        generatedAt: new Date().toISOString(),
        recentFactures,
        recentPaiements,
        overdueEcheances: overdueEcheances.slice(0, 8),
        overdueStudents: this.buildOverdueStudents(overdueEcheances),
        upcomingEcheances,
        topFrais: [...fraisUsage.values()]
          .sort((a, b) => b.count - a.count || b.montant - a.montant)
          .slice(0, 5),
      });
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de l'activite finance", 400, error as Error);
    }
  }

  private async summary(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const today = this.startOfDay(new Date());
      const activePaymentWhere = {
        statut: "ENREGISTRE",
        facture: { is: { etablissement_id: tenantId } },
      };
      const factureWhere = { etablissement_id: tenantId };
      const activeFactureWhere = {
        etablissement_id: tenantId,
        statut: { not: "ANNULEE" as const },
      };
      const openEcheanceWhere = this.buildOpenEcheanceWhere(tenantId);
      const overdueEcheanceWhere = this.buildOpenEcheanceWhere(tenantId, today);

      const [
        totalFactureAggregate,
        totalEncaisseAggregate,
        activePaiementsCount,
        reversedPaiementsCount,
        partiallyPaidInvoices,
        openEcheancesAggregate,
        openEcheancesCount,
        overdueRows,
        activePaymentRows,
        reconciledCount,
        reconciledAmount,
        awaitingReconciliationCount,
        awaitingReconciliationAmount,
        untrackedReconciliationCount,
        untrackedReconciliationAmount,
      ] = await Promise.all([
        this.prisma.facture.aggregate({
          where: activeFactureWhere,
          _sum: { total_montant: true },
        }),
        this.prisma.paiement.aggregate({
          where: activePaymentWhere,
          _sum: { montant: true },
        }),
        this.prisma.paiement.count({ where: activePaymentWhere }),
        this.prisma.paiement.count({
          where: {
            facture: { is: { etablissement_id: tenantId } },
            statut: { not: "ENREGISTRE" },
          },
        }),
        this.prisma.facture.count({
          where: { ...factureWhere, statut: "PARTIELLE" },
        }),
        this.prisma.echeancePaiement.aggregate({
          where: openEcheanceWhere,
          _sum: { montant_restant: true },
        } as never),
        this.prisma.echeancePaiement.count({ where: openEcheanceWhere } as never),
        this.prisma.echeancePaiement.findMany({
          where: overdueEcheanceWhere,
          select: {
            id: true,
            facture_id: true,
            eleve_id: true,
            date_echeance: true,
            montant_restant: true,
          },
        } as never),
        this.prisma.paiement.findMany({
          where: activePaymentWhere,
          select: {
            id: true,
            montant: true,
            methode: true,
            paye_le: true,
            created_at: true,
          },
          orderBy: [{ paye_le: "desc" }, { created_at: "desc" }],
          take: 1000,
        }),
        this.prisma.paiement.count({
          where: {
            facture: { is: { etablissement_id: tenantId } },
            operationsFinancieres: { some: { type: "RAPPROCHEMENT_PAIEMENT" } },
          },
        }),
        this.prisma.paiement.aggregate({
          where: {
            ...activePaymentWhere,
            operationsFinancieres: { some: { type: "RAPPROCHEMENT_PAIEMENT" } },
          },
          _sum: { montant: true },
        }),
        this.prisma.paiement.count({
          where: {
            facture: { is: { etablissement_id: tenantId } },
            operationsFinancieres: {
              some: { type: "ENREGISTREMENT_PAIEMENT" },
              none: { type: "RAPPROCHEMENT_PAIEMENT" },
            },
          },
        }),
        this.prisma.paiement.aggregate({
          where: {
            ...activePaymentWhere,
            operationsFinancieres: {
              some: { type: "ENREGISTREMENT_PAIEMENT" },
              none: { type: "RAPPROCHEMENT_PAIEMENT" },
            },
          },
          _sum: { montant: true },
        }),
        this.prisma.paiement.count({
          where: {
            facture: { is: { etablissement_id: tenantId } },
            operationsFinancieres: {
              none: { type: { in: ["ENREGISTREMENT_PAIEMENT", "RAPPROCHEMENT_PAIEMENT"] } },
            },
          },
        }),
        this.prisma.paiement.aggregate({
          where: {
            ...activePaymentWhere,
            operationsFinancieres: {
              none: { type: { in: ["ENREGISTREMENT_PAIEMENT", "RAPPROCHEMENT_PAIEMENT"] } },
            },
          },
          _sum: { montant: true },
        }),
      ]);

      const overdueStudentIds = new Set(overdueRows.map((row) => row.eleve_id).filter(Boolean));
      const impactedOverdueInvoices = new Set(
        overdueRows.map((row) => row.facture_id).filter(Boolean),
      ).size;
      const overdueAmount = overdueRows.reduce(
        (sum, row) => sum + this.toMoney(row.montant_restant),
        0,
      );

      Response.success(res, "Synthese finance recuperee.", {
        generatedAt: new Date().toISOString(),
        metrics: {
          totalFacture: this.toMoney(totalFactureAggregate._sum?.total_montant),
          totalEncaisse: this.toMoney(totalEncaisseAggregate._sum.montant),
          activePaiementsCount,
          reversedPaiementsCount,
          partiallyPaidInvoices,
          openEcheancesCount,
          overdueEcheancesCount: overdueRows.length,
          overdueStudentsCount: overdueStudentIds.size,
          impactedOverdueInvoices,
          resteARecouvrer: this.toMoney(openEcheancesAggregate._sum?.montant_restant),
          overdueAmount: this.toMoney(overdueAmount),
        },
        dailyReceipts: this.buildDailyReceipts(activePaymentRows),
        paymentChannelStats: this.buildPaymentChannelStats(activePaymentRows),
        reconciliationStats: [
          {
            key: "Rapproche",
            label: "Rapproches",
            count: reconciledCount,
            total: this.toMoney(reconciledAmount._sum.montant),
          },
          {
            key: "En attente",
            label: "En attente",
            count: awaitingReconciliationCount,
            total: this.toMoney(awaitingReconciliationAmount._sum.montant),
          },
          {
            key: "Non renseigne",
            label: "Non renseignes",
            count: untrackedReconciliationCount,
            total: this.toMoney(untrackedReconciliationAmount._sum.montant),
          },
        ].sort((a, b) => b.total - a.total || b.count - a.count),
        ageingBuckets: this.buildAgeingBuckets(overdueRows, today),
      });
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la synthese finance", 400, error as Error);
    }
  }
}

export default FinanceDashboardApp;
