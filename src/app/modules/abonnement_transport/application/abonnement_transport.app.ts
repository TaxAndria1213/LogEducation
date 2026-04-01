import { Application, NextFunction, Request, Response as R, Router } from "express";
import { Prisma, PrismaClient, type AbonnementTransport } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import AbonnementTransportModel from "../models/abonnement_transport.model";
import {
  createServiceSubscriptionFacture,
  regularizeServiceSubscriptionFacture,
} from "../../finance_shared/utils/service_subscription_finance";

type AbonnementTransportPayload = {
  eleve_id: string;
  annee_scolaire_id: string;
  ligne_transport_id: string;
  arret_transport_id: string | null;
  statut: string;
  date_debut_service: Date | null;
  date_fin_service: Date | null;
  prorata_ratio: number | null;
};

type AbonnementTransportBillingPayload = {
  facturer_maintenant: boolean;
  catalogue_frais_id: string | null;
  mode_paiement: string;
  nombre_tranches: number;
  jour_paiement_mensuel: number | null;
  date_echeance: Date | null;
};

type ChangeTransportLinePayload = {
  ligne_transport_id: string;
  arret_transport_id: string | null;
  date_effet: Date;
  facturer_regularisation: boolean;
};

type AbonnementTransportScopedRecord = Awaited<ReturnType<AbonnementTransportApp["getScopedRecord"]>>;

class AbonnementTransportApp {
  public app: Application;
  public router: Router;
  private abonnementTransport: AbonnementTransportModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.abonnementTransport = new AbonnementTransportModel();
    this.prisma = new PrismaClient();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.post("/:id/change-line", this.changeLine.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));
    return this.router;
  }

  private async resolveTenantIdForWrite(req: Request): Promise<string> {
    try {
      return this.resolveTenantId(req);
    } catch (error) {
      const eleveId =
        typeof req.body?.eleve_id === "string" ? req.body.eleve_id.trim() : "";
      const ligneId =
        typeof req.body?.ligne_transport_id === "string"
          ? req.body.ligne_transport_id.trim()
          : "";

      if (eleveId) {
        const eleve = await this.prisma.eleve.findUnique({
          where: { id: eleveId },
          select: { etablissement_id: true },
        });
        if (eleve?.etablissement_id) return eleve.etablissement_id;
      }

      if (ligneId) {
        const ligne = await this.prisma.ligneTransport.findUnique({
          where: { id: ligneId },
          select: { etablissement_id: true },
        });
        if (ligne?.etablissement_id) return ligne.etablissement_id;
      }

      throw error;
    }
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const bodyTenant =
      typeof req.body?.etablissement_id === "string" ? req.body.etablissement_id.trim() : undefined;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof (queryWhere?.eleve as { is?: { etablissement_id?: unknown } } | undefined)?.is
        ?.etablissement_id === "string"
        ? ((queryWhere.eleve as { is?: { etablissement_id?: string } }).is?.etablissement_id ?? "").trim()
        : undefined;

    const candidates = [requestTenant, bodyTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (candidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(candidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour l'abonnement transport.");
    }

    return candidates[0];
  }

  private normalizePayload(raw: Partial<AbonnementTransport>): AbonnementTransportPayload {
    const eleve_id = typeof raw.eleve_id === "string" ? raw.eleve_id.trim() : "";
    const annee_scolaire_id =
      typeof raw.annee_scolaire_id === "string" ? raw.annee_scolaire_id.trim() : "";
    const ligne_transport_id =
      typeof raw.ligne_transport_id === "string" ? raw.ligne_transport_id.trim() : "";
    const arret_transport_id =
      typeof raw.arret_transport_id === "string" && raw.arret_transport_id.trim()
        ? raw.arret_transport_id.trim()
        : null;
    const requestedStatus =
      typeof raw.statut === "string" && raw.statut.trim()
        ? raw.statut.trim().toUpperCase()
        : "EN_ATTENTE_VALIDATION_FINANCIERE";
    const dateDebutRaw =
      typeof (raw as Record<string, unknown>).date_debut_service === "string" &&
      String((raw as Record<string, unknown>).date_debut_service).trim()
        ? String((raw as Record<string, unknown>).date_debut_service).trim()
        : null;
    const dateFinRaw =
      typeof (raw as Record<string, unknown>).date_fin_service === "string" &&
      String((raw as Record<string, unknown>).date_fin_service).trim()
        ? String((raw as Record<string, unknown>).date_fin_service).trim()
        : null;
    const date_debut_service = dateDebutRaw ? new Date(dateDebutRaw) : null;
    const date_fin_service = dateFinRaw ? new Date(dateFinRaw) : null;
    const statut = [
      "EN_ATTENTE_VALIDATION_FINANCIERE",
      "EN_ATTENTE_REGLEMENT",
      "ACTIF",
      "SUSPENDU",
      "INACTIF",
      "ANNULE",
      "RESILIE",
    ].includes(requestedStatus)
      ? requestedStatus
      : "EN_ATTENTE_VALIDATION_FINANCIERE";

    if (!eleve_id || !annee_scolaire_id || !ligne_transport_id) {
      throw new Error("L'eleve, l'annee scolaire et la ligne de transport sont requis.");
    }

    if (date_debut_service && Number.isNaN(date_debut_service.getTime())) {
      throw new Error("La date de debut du transport est invalide.");
    }
    if (date_fin_service && Number.isNaN(date_fin_service.getTime())) {
      throw new Error("La date de fin du transport est invalide.");
    }
    if (date_debut_service && date_fin_service && date_fin_service < date_debut_service) {
      throw new Error("La date de fin du transport doit etre posterieure a la date de debut.");
    }

    const prorata_ratio = this.computeProrataRatio(date_debut_service, date_fin_service);

    return {
      eleve_id,
      annee_scolaire_id,
      ligne_transport_id,
      arret_transport_id,
      statut,
      date_debut_service,
      date_fin_service,
      prorata_ratio,
    };
  }

  private normalizeBillingPayload(raw: Record<string, unknown>): AbonnementTransportBillingPayload {
    const facturer_maintenant =
      raw.facturer_maintenant === true ||
      raw.facturer_maintenant === "true" ||
      raw.facturer_maintenant === 1 ||
      raw.facturer_maintenant === "1";
    const catalogue_frais_id =
      typeof raw.catalogue_frais_id === "string" && raw.catalogue_frais_id.trim()
        ? raw.catalogue_frais_id.trim()
        : null;
    const mode_paiement =
      typeof raw.mode_paiement === "string" && raw.mode_paiement.trim().toUpperCase() === "ECHELONNE"
        ? "ECHELONNE"
        : "COMPTANT";
    const parsedTranches = Number.parseInt(String(raw.nombre_tranches ?? 1), 10);
    const nombre_tranches = Number.isFinite(parsedTranches) && parsedTranches > 0 ? parsedTranches : 1;
    const parsedJour = Number.parseInt(String(raw.jour_paiement_mensuel ?? ""), 10);
    const jour_paiement_mensuel =
      Number.isFinite(parsedJour) && parsedJour >= 1
        ? Math.max(1, Math.min(28, parsedJour))
        : null;
    const date_echeance_raw =
      typeof raw.date_echeance === "string" && raw.date_echeance.trim()
        ? raw.date_echeance.trim()
        : null;
    const date_echeance = date_echeance_raw ? new Date(date_echeance_raw) : null;

    if (date_echeance_raw && Number.isNaN(date_echeance?.getTime())) {
      throw new Error("La date d'echeance du service transport est invalide.");
    }

    return {
      facturer_maintenant,
      catalogue_frais_id,
      mode_paiement,
      nombre_tranches,
      jour_paiement_mensuel,
      date_echeance,
    };
  }

  private normalizeChangeLinePayload(raw: Record<string, unknown>): ChangeTransportLinePayload {
    const ligne_transport_id =
      typeof raw.ligne_transport_id === "string" && raw.ligne_transport_id.trim()
        ? raw.ligne_transport_id.trim()
        : "";
    const arret_transport_id =
      typeof raw.arret_transport_id === "string" && raw.arret_transport_id.trim()
        ? raw.arret_transport_id.trim()
        : null;
    const dateEffetRaw =
      typeof raw.date_effet === "string" && raw.date_effet.trim()
        ? raw.date_effet.trim()
        : "";
    const date_effet = new Date(dateEffetRaw || new Date().toISOString());
    if (!ligne_transport_id) {
      throw new Error("La nouvelle ligne de transport est obligatoire.");
    }
    if (Number.isNaN(date_effet.getTime())) {
      throw new Error("La date d'effet du changement de circuit est invalide.");
    }

    return {
      ligne_transport_id,
      arret_transport_id,
      date_effet,
      facturer_regularisation:
        raw.facturer_regularisation === true ||
        raw.facturer_regularisation === "true" ||
        raw.facturer_regularisation === 1 ||
        raw.facturer_regularisation === "1",
    };
  }

  private daysInMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  }

  private computeProrataRatio(startDate: Date | null, endDate: Date | null) {
    if (!startDate && !endDate) return null;
    const anchor = startDate ?? endDate ?? new Date();
    const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), this.daysInMonth(anchor)));
    const effectiveStart = startDate && startDate > monthStart ? startDate : monthStart;
    const effectiveEnd = endDate && endDate < monthEnd ? endDate : monthEnd;
    const diff = effectiveEnd.getTime() - effectiveStart.getTime();
    if (diff < 0) return 0;
    const activeDays = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    return Number((activeDays / this.daysInMonth(anchor)).toFixed(4));
  }

  private applyProrata(montant: number, ratio: number | null) {
    if (ratio == null) return Number(montant.toFixed(2));
    return Number((montant * Math.max(0, Math.min(1, ratio))).toFixed(2));
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { eleve: { is: { etablissement_id: tenantId } } };
    if (!existingWhere || Object.keys(existingWhere).length === 0) return scope;
    return { AND: [existingWhere, scope] };
  }

  private async ensureScopedRelations(data: AbonnementTransportPayload, tenantId: string, excludeId?: string) {
    const [eleve, annee, ligne] = await Promise.all([
      this.prisma.eleve.findFirst({
        where: { id: data.eleve_id, etablissement_id: tenantId },
        select: { id: true },
      }),
      this.prisma.anneeScolaire.findFirst({
        where: { id: data.annee_scolaire_id, etablissement_id: tenantId },
        select: { id: true },
      }),
      this.prisma.ligneTransport.findFirst({
        where: { id: data.ligne_transport_id, etablissement_id: tenantId },
        select: { id: true },
      }),
    ]);

    if (!eleve) throw new Error("L'eleve selectionne n'appartient pas a cet etablissement.");
    if (!annee) throw new Error("L'annee scolaire selectionnee n'appartient pas a cet etablissement.");
    if (!ligne) throw new Error("La ligne de transport selectionnee n'appartient pas a cet etablissement.");

    if (data.arret_transport_id) {
      const arret = await this.prisma.arretTransport.findFirst({
        where: { id: data.arret_transport_id, ligne_transport_id: data.ligne_transport_id },
        select: { id: true },
      });
      if (!arret) {
        throw new Error("L'arret selectionne n'appartient pas a la ligne de transport.");
      }
    }

    const duplicate = await this.prisma.abonnementTransport.findFirst({
      where: {
        eleve_id: data.eleve_id,
        annee_scolaire_id: data.annee_scolaire_id,
        OR: [
          { statut: null },
          { statut: { notIn: ["RESILIE", "ANNULE", "INACTIF"] } },
        ],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error("Un abonnement transport existe deja pour cet eleve sur cette annee scolaire.");
    }
  }

  private async readFactureId(id: string) {
    const rows = await this.prisma.$queryRaw<Array<{ facture_id: string | null }>>(
      Prisma.sql`SELECT facture_id FROM abonnements_transport WHERE id = ${id} LIMIT 1`,
    );
    return rows[0]?.facture_id ?? null;
  }

  private async attachFinanceMetadata<T extends { id: string }>(records: T[]) {
    if (records.length === 0) return records.map((item) => ({ ...item, facture_id: null, facture: null }));
    const ids = records.map((item) => item.id);
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        facture_id: string | null;
        date_debut_service: Date | null;
        date_fin_service: Date | null;
        prorata_ratio: Prisma.Decimal | number | null;
      }>
    >(
      Prisma.sql`SELECT id, facture_id, date_debut_service, date_fin_service, prorata_ratio FROM abonnements_transport WHERE id IN (${Prisma.join(ids)})`,
    );
    const factureIdByRecord = new Map(rows.map((item) => [item.id, item.facture_id ?? null]));
    const factureIds = rows
      .map((item) => item.facture_id)
      .filter((value): value is string => Boolean(value));
    const factures = factureIds.length
      ? await this.prisma.facture.findMany({
          where: { id: { in: factureIds } },
          select: { id: true, numero_facture: true, statut: true },
        })
      : [];
    const facturesById = new Map(factures.map((item) => [item.id, item]));
    const rowsById = new Map(rows.map((item) => [item.id, item]));
    return records.map((item) => {
      const facture_id = factureIdByRecord.get(item.id) ?? null;
      const row = rowsById.get(item.id);
      return {
        ...item,
        facture_id,
        facture: facture_id ? facturesById.get(facture_id) ?? null : null,
        date_debut_service: row?.date_debut_service ?? null,
        date_fin_service: row?.date_fin_service ?? null,
        prorata_ratio: row?.prorata_ratio != null ? Number(row.prorata_ratio) : null,
      };
    });
  }

  private async getScopedRecord(id: string, tenantId: string) {
    const record = await this.prisma.abonnementTransport.findFirst({
      where: { id, eleve: { is: { etablissement_id: tenantId } } },
      include: {
        eleve: { include: { utilisateur: { include: { profil: true } } } },
        annee: true,
        ligne: true,
        arret: true,
      },
    });
    if (!record) return null;
    const [enriched] = await this.attachFinanceMetadata([record]);
    return enriched;
  }

  private ensureMutable(existing: NonNullable<AbonnementTransportScopedRecord>) {
    if (existing?.facture && (existing.facture.statut ?? "").toUpperCase() !== "ANNULEE") {
      throw new Error(
        `Cet abonnement transport est deja facture par ${existing.facture.numero_facture}. Regularisez d'abord la facture liee.`,
      );
    }
  }

  private async updateOperationalStatus(
    id: string,
    statut: "ACTIF" | "SUSPENDU" | "INACTIF",
  ) {
    return this.prisma.abonnementTransport.update({
      where: { id },
      data: { statut },
    });
  }

  private async terminateSubscription(
    tenantId: string,
    existing: NonNullable<AbonnementTransportScopedRecord>,
    actorId: string | null,
  ) {
    if ((existing.statut ?? "").toUpperCase() === "RESILIE") {
      return existing;
    }

    if (!existing.facture_id) {
      return this.abonnementTransport.delete(existing.id);
    }

    return this.prisma.$transaction(async (tx) => {
      await regularizeServiceSubscriptionFacture(tx, {
        tenantId,
        factureId: existing.facture_id as string,
        eleveId: existing.eleve_id,
        anneeScolaireId: existing.annee_scolaire_id,
        catalogueFraisId: existing.ligne?.catalogue_frais_id ?? null,
        libellePrefix: "Transport -",
        serviceLabel: existing.ligne?.nom
          ? `transport ${existing.ligne.nom}`
          : "transport",
        createdByUtilisateurId: actorId,
        motif: "Resiliation abonnement transport",
      });

      return tx.abonnementTransport.update({
        where: { id: existing.id },
        data: {
          statut: "RESILIE",
        },
      });
    });
  }

  private async createScopedSubscriptionWithOptionalBilling(
    tenantId: string,
    data: AbonnementTransportPayload,
    billing: AbonnementTransportBillingPayload,
    actorId: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneTransport.findFirst({
        where: { id: data.ligne_transport_id, etablissement_id: tenantId },
        select: { nom: true, catalogue_frais_id: true },
      });
      const resolvedCatalogueFraisId = billing.catalogue_frais_id ?? ligne?.catalogue_frais_id ?? null;
      const selectedCatalogue = resolvedCatalogueFraisId
        ? await tx.catalogueFrais.findFirst({
            where: { id: resolvedCatalogueFraisId, etablissement_id: tenantId },
            select: { montant: true },
          })
        : null;
      const abonnement = await tx.abonnementTransport.create({
        data: {
          eleve_id: data.eleve_id,
          annee_scolaire_id: data.annee_scolaire_id,
          ligne_transport_id: data.ligne_transport_id,
          arret_transport_id: data.arret_transport_id,
          statut: data.statut,
        },
      });

      await tx.$executeRaw(
        Prisma.sql`UPDATE abonnements_transport
          SET date_debut_service = ${data.date_debut_service},
              date_fin_service = ${data.date_fin_service},
              prorata_ratio = ${data.prorata_ratio}
          WHERE id = ${abonnement.id}`,
      );

      let factureId: string | null = null;

      if (billing.facturer_maintenant) {
        if (!resolvedCatalogueFraisId) {
          throw new Error("La ligne de transport selectionnee n'est reliee a aucun frais catalogue.");
        }

        const { facture } = await createServiceSubscriptionFacture(tx, {
          tenantId,
          eleveId: data.eleve_id,
          anneeScolaireId: data.annee_scolaire_id,
          catalogueFraisId: resolvedCatalogueFraisId,
          allowedScopes: ["GENERAL", "TRANSPORT"],
          libelle: `Transport - ${ligne?.nom ?? "service"}`,
          modePaiement: billing.mode_paiement,
          nombreTranches: billing.nombre_tranches,
          jourPaiementMensuel: billing.jour_paiement_mensuel,
          createdByUtilisateurId: actorId,
          dateEcheance: billing.date_echeance,
          montantOverride:
            data.prorata_ratio != null && selectedCatalogue
              ? this.applyProrata(
                  Number(selectedCatalogue.montant ?? 0),
                  data.prorata_ratio,
                )
              : null,
        });
        factureId = facture.id;
        await tx.$executeRaw(
          Prisma.sql`UPDATE abonnements_transport SET facture_id = ${facture.id} WHERE id = ${abonnement.id}`,
        );
      }

      return {
        ...abonnement,
        facture_id: factureId,
      };
    });
  }

  private async create(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const data = this.normalizePayload({
        ...req.body,
        statut: "EN_ATTENTE_VALIDATION_FINANCIERE",
      });
      await this.ensureScopedRelations(data, tenantId);
      const result = await this.prisma.$transaction(async (tx) => {
        const abonnement = await tx.abonnementTransport.create({
          data: {
            eleve_id: data.eleve_id,
            annee_scolaire_id: data.annee_scolaire_id,
            ligne_transport_id: data.ligne_transport_id,
            arret_transport_id: data.arret_transport_id,
            statut: data.statut,
          },
        });

        await tx.$executeRaw(
          Prisma.sql`UPDATE abonnements_transport
            SET date_debut_service = ${data.date_debut_service},
                date_fin_service = ${data.date_fin_service},
                prorata_ratio = ${data.prorata_ratio}
            WHERE id = ${abonnement.id}`,
        );

        return abonnement;
      });
      Response.success(
        res,
        "Abonnement transport cree en attente de validation financiere.",
        result,
      );
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de l'abonnement transport", 400, error as Error);
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId)),
        orderBy:
          req.query.orderBy ??
          JSON.stringify([{ created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.abonnementTransport);
      const data = await this.attachFinanceMetadata((result?.data ?? []) as Array<{ id: string }>);
      Response.success(res, "Abonnements transport.", { ...result, data });
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des abonnements transport", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, {});
      const result =
        Object.keys(includeSpec).length > 0
          ? await this.prisma.abonnementTransport.findFirst({
              where: { id: req.params.id, eleve: { is: { etablissement_id: tenantId } } },
              include: includeSpec as never,
            })
          : await this.getScopedRecord(req.params.id, tenantId);
      if (!result) throw new Error("Abonnement transport introuvable.");
      Response.success(res, "Abonnement transport.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de l'abonnement transport", 404, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");
      const requestedStatus =
        typeof req.body?.statut === "string" ? req.body.statut.trim().toUpperCase() : null;
      if (existing.facture && (existing.facture.statut ?? "").toUpperCase() !== "ANNULEE") {
        if (requestedStatus === "RESILIE") {
          const result = await this.terminateSubscription(
            tenantId,
            existing,
            (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
          );
          return Response.success(res, "Abonnement transport resilie.", result);
        }
        if (requestedStatus === "SUSPENDU" || requestedStatus === "ACTIF" || requestedStatus === "INACTIF") {
          const result = await this.updateOperationalStatus(req.params.id, requestedStatus);
          return Response.success(res, "Statut operationnel du transport mis a jour.", result);
        }
        this.ensureMutable(existing);
      }
      const data = this.normalizePayload({ ...existing, ...req.body });
      await this.ensureScopedRelations(data, tenantId, req.params.id);
      const result = await this.abonnementTransport.update(req.params.id, {
        eleve_id: data.eleve_id,
        annee_scolaire_id: data.annee_scolaire_id,
        ligne_transport_id: data.ligne_transport_id,
        arret_transport_id: data.arret_transport_id,
        statut: data.statut,
      });
      await this.prisma.$executeRaw(
        Prisma.sql`UPDATE abonnements_transport
          SET date_debut_service = ${data.date_debut_service},
              date_fin_service = ${data.date_fin_service},
              prorata_ratio = ${data.prorata_ratio}
          WHERE id = ${req.params.id}`,
      );
      Response.success(res, "Abonnement transport mis a jour.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de l'abonnement transport", 400, error as Error);
      next(error);
    }
  }

  private async changeLine(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");
      const payload = this.normalizeChangeLinePayload(req.body as Record<string, unknown>);
      if (payload.ligne_transport_id === existing.ligne_transport_id && payload.arret_transport_id === existing.arret_transport_id) {
        throw new Error("Le nouvel abonnement transport doit pointer vers un autre circuit ou arret.");
      }

      const [newLine, oldLine] = await Promise.all([
        this.prisma.ligneTransport.findFirst({
          where: { id: payload.ligne_transport_id, etablissement_id: tenantId },
          select: { id: true, nom: true, catalogue_frais_id: true },
        }),
        this.prisma.ligneTransport.findFirst({
          where: { id: existing.ligne_transport_id, etablissement_id: tenantId },
          select: { id: true, nom: true, catalogue_frais_id: true },
        }),
      ]);
      if (!newLine) throw new Error("La nouvelle ligne de transport n'appartient pas a cet etablissement.");
      if (!oldLine) throw new Error("La ligne de transport actuelle est introuvable.");

      const prorataRatio = this.computeProrataRatio(payload.date_effet, null);
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;

      const result = await this.prisma.$transaction(async (tx) => {
        let newFactureId = existing.facture_id ?? null;
        if (existing.facture_id && payload.facturer_regularisation) {
          await regularizeServiceSubscriptionFacture(tx, {
            tenantId,
            factureId: existing.facture_id,
            eleveId: existing.eleve_id,
            anneeScolaireId: existing.annee_scolaire_id,
            catalogueFraisId: oldLine.catalogue_frais_id ?? null,
            libellePrefix: "Transport -",
            serviceLabel: oldLine.nom ? `transport ${oldLine.nom}` : "transport",
            createdByUtilisateurId: actorId,
            motif: "Changement de circuit transport",
          });

          if (newLine.catalogue_frais_id) {
            const selectedCatalogue = await tx.catalogueFrais.findFirst({
              where: { id: newLine.catalogue_frais_id, etablissement_id: tenantId },
              select: { montant: true },
            });
            const montantOverride = this.applyProrata(Number(selectedCatalogue?.montant ?? 0), prorataRatio);
            const { facture } = await createServiceSubscriptionFacture(tx, {
              tenantId,
              eleveId: existing.eleve_id,
              anneeScolaireId: existing.annee_scolaire_id,
              catalogueFraisId: newLine.catalogue_frais_id,
              allowedScopes: ["GENERAL", "TRANSPORT"],
              libelle: `Transport - ${newLine.nom} (regularisation)`,
              modePaiement: "COMPTANT",
              nombreTranches: 1,
              createdByUtilisateurId: actorId,
              dateEmission: payload.date_effet,
              dateEcheance: payload.date_effet,
              montantOverride,
            });
            newFactureId = facture.id;
          }
        }

        await tx.$executeRaw(
          Prisma.sql`UPDATE abonnements_transport
            SET ligne_transport_id = ${payload.ligne_transport_id},
                arret_transport_id = ${payload.arret_transport_id},
                date_debut_service = ${payload.date_effet},
                prorata_ratio = ${prorataRatio},
                facture_id = ${newFactureId}
            WHERE id = ${existing.id}`,
        );

        return tx.abonnementTransport.findUnique({ where: { id: existing.id } });
      });

      Response.success(res, "Circuit transport mis a jour.", result);
    } catch (error) {
      Response.error(res, "Erreur lors du changement de circuit transport", 400, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");
      const result = await this.terminateSubscription(
        tenantId,
        existing,
        (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
      );
      Response.success(
        res,
        existing.facture_id ? "Abonnement transport resilie et regularise." : "Abonnement transport supprime.",
        result,
      );
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de l'abonnement transport", 400, error as Error);
      next(error);
    }
  }
}

export default AbonnementTransportApp;
