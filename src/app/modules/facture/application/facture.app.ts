import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type Prisma, type StatutFacture } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import {
  applyCreditToFactureEcheances,
  ensureFactureEcheances,
  syncFactureStatusFromEcheances,
} from "../../finance_shared/utils/echeance_paiement";
import FactureModel from "../models/facture.model";

type FactureLinePayload = {
  id?: string;
  catalogue_frais_id?: string | null;
  libelle: string;
  quantite: number;
  prix_unitaire: number;
  montant: number;
};

type FacturePayload = {
  etablissement_id: string;
  eleve_id: string;
  annee_scolaire_id: string;
  remise_id: string | null;
  facture_origine_id: string | null;
  nature: string;
  numero_facture: string;
  date_emission: Date;
  date_echeance: Date | null;
  statut: StatutFacture;
  total_montant: number;
  devise: string;
  lignes: FactureLinePayload[];
};

type ResolvedRemise = {
  id: string;
  nom: string;
  type: string;
  valeur: number;
};

type FactureOperationPayload = {
  motif: string | null;
  montant: number | null;
};

type OperationFinanciereDelegate = {
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
};

type TransactionWithFinance = Prisma.TransactionClient & {
  operationFinanciere: OperationFinanciereDelegate;
};

class FactureApp {
  public app: Application;
  public router: Router;
  private facture: FactureModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.facture = new FactureModel();
    this.prisma = new PrismaClient();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.post("/:id/cancel", this.cancel.bind(this));
    this.router.post("/:id/avoir", this.createCreditNote.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const bodyTenant =
      typeof req.body?.etablissement_id === "string"
        ? req.body.etablissement_id.trim()
        : undefined;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.etablissement_id === "string"
        ? queryWhere.etablissement_id.trim()
        : undefined;

    const tenantCandidates = [requestTenant, bodyTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour la facture.");
    }

    return tenantCandidates[0];
  }

  private parseDate(value: unknown, fallback?: Date) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    if (fallback) return fallback;
    throw new Error("Une date de facture est invalide.");
  }

  private normalizeText(value: unknown) {
    if (typeof value !== "string") return null;
    const normalized = value.trim().replace(/\s+/g, " ");
    return normalized || null;
  }

  private toNumber(value: unknown, fallback = 0) {
    const number = Number(value ?? fallback);
    if (!Number.isFinite(number)) throw new Error("Une valeur numerique de facture est invalide.");
    return Math.round(number * 100) / 100;
  }

  private normalizeLine(raw: Record<string, unknown>, index: number): FactureLinePayload {
    const libelle = typeof raw.libelle === "string" ? raw.libelle.trim().replace(/\s+/g, " ") : "";
    const quantite = Math.max(1, Number(raw.quantite ?? 1));
    const prix_unitaire = this.toNumber(raw.prix_unitaire ?? 0);
    const montant = this.toNumber(raw.montant ?? quantite * prix_unitaire);
    const catalogue_frais_id =
      typeof raw.catalogue_frais_id === "string" && raw.catalogue_frais_id.trim()
        ? raw.catalogue_frais_id.trim()
        : null;
    const id =
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : undefined;

    if (!libelle) {
      throw new Error(`Le libelle de la ligne ${index + 1} est requis.`);
    }

    if (!Number.isInteger(quantite) || quantite <= 0) {
      throw new Error(`La quantite de la ligne ${index + 1} doit etre un entier positif.`);
    }

    if (!Number.isFinite(prix_unitaire) || !Number.isFinite(montant)) {
      throw new Error(`Les montants de la ligne ${index + 1} sont invalides.`);
    }

    if (prix_unitaire < 0 || montant < 0) {
      throw new Error(
        `La ligne ${index + 1} ne peut pas porter de montant negatif hors remise calculee automatiquement.`,
      );
    }

    return {
      id,
      catalogue_frais_id,
      libelle,
      quantite,
      prix_unitaire,
      montant,
    };
  }

  private deriveStatus(
    requestedStatus: string | undefined,
    total: number,
    paidAmount: number,
    dueDate: Date | null,
  ): StatutFacture {
    const normalizedRequested = (requestedStatus ?? "").toUpperCase();

    if (normalizedRequested === "BROUILLON") return "BROUILLON";
    if (normalizedRequested === "ANNULEE") return "ANNULEE";

    if (total <= 0) return "PAYEE";
    if (paidAmount >= total) return "PAYEE";
    if (paidAmount > 0) return "PARTIELLE";
    if (dueDate && dueDate < new Date()) return "EN_RETARD";
    return "EMISE";
  }

  private async buildInvoiceNumber(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.facture.count({
      where: {
        etablissement_id: tenantId,
        numero_facture: {
          startsWith: `FAC-${year}-`,
        },
      },
    });
    return `FAC-${year}-${String(count + 1).padStart(4, "0")}`;
  }

  private async buildCreditNoteNumber(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.facture.count({
      where: {
        etablissement_id: tenantId,
        numero_facture: {
          startsWith: `AV-${year}-`,
        },
      },
    });
    return `AV-${year}-${String(count + 1).padStart(4, "0")}`;
  }

  private getActivePaiements(paiements: Array<{ statut?: string | null; montant?: unknown }>) {
    return paiements.filter((item) => (item.statut ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE");
  }

  private sumPaiements(paiements: Array<{ montant?: unknown }>) {
    return paiements.reduce((sum, item) => sum + Number(item.montant ?? 0), 0);
  }

  private async ensureEleveAndAnnee(
    eleveId: string,
    anneeId: string,
    tenantId: string,
  ) {
    const eleve = await this.prisma.eleve.findFirst({
      where: { id: eleveId, etablissement_id: tenantId },
      select: { id: true },
    });

    if (!eleve) {
      throw new Error("L'eleve selectionne n'appartient pas a cet etablissement.");
    }

    const annee = await this.prisma.anneeScolaire.findFirst({
      where: { id: anneeId, etablissement_id: tenantId },
      select: { id: true },
    });

    if (!annee) {
      throw new Error("L'annee scolaire selectionnee n'appartient pas a cet etablissement.");
    }
  }

  private async ensureNumeroUnique(
    tenantId: string,
    numeroFacture: string,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.facture.findFirst({
      where: {
        etablissement_id: tenantId,
        numero_facture: numeroFacture,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error("Une facture avec ce numero existe deja dans cet etablissement.");
    }
  }

  private async validateCatalogueLinks(
    tenantId: string,
    eleveId: string,
    anneeId: string,
    lignes: FactureLinePayload[],
  ) {
    const ids = Array.from(
      new Set(
        lignes
          .map((item) => item.catalogue_frais_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (ids.length === 0) return;

    const inscription = await this.prisma.inscription.findFirst({
      where: {
        eleve_id: eleveId,
        annee_scolaire_id: anneeId,
      },
      select: {
        classe: {
          select: {
            niveau_scolaire_id: true,
          },
        },
      },
    });

    const niveauId = inscription?.classe?.niveau_scolaire_id;
    if (!niveauId) {
      throw new Error("Impossible de determiner le niveau scolaire de l'eleve pour cette annee.");
    }

    const found = await this.prisma.catalogueFrais.findMany({
      where: {
        etablissement_id: tenantId,
        id: { in: ids },
        OR: [
          { niveau_scolaire_id: niveauId },
          { niveau_scolaire_id: null },
        ],
      } as never,
      select: { id: true },
    });

    if (found.length !== ids.length) {
      throw new Error("Une ligne reference un frais catalogue qui n'est pas applicable au niveau scolaire de l'eleve.");
    }
  }

  private async resolveRemise(
    remiseId: string | null,
    tenantId: string,
  ): Promise<ResolvedRemise | null> {
    if (!remiseId) return null;

    const remise = await this.prisma.remise.findFirst({
      where: {
        id: remiseId,
        etablissement_id: tenantId,
      },
      select: {
        id: true,
        nom: true,
        type: true,
        valeur: true,
      },
    });

    if (!remise) {
      throw new Error("La remise selectionnee n'appartient pas a cet etablissement.");
    }

    return {
      id: remise.id,
      nom: remise.nom,
      type: remise.type,
      valeur: this.toNumber(remise.valeur),
    };
  }

  private computeDiscount(total: number, remiseType: string, remiseValeur: number): number {
    if (total <= 0 || remiseValeur <= 0) return 0;

    if (remiseType.toUpperCase() === "PERCENT") {
      return this.toNumber(total * (remiseValeur / 100));
    }

    if (remiseType.toUpperCase() === "FIXED") {
      return Math.min(total, this.toNumber(remiseValeur));
    }

    return 0;
  }

  private isGeneratedDiscountLine(line: FactureLinePayload) {
    return !line.catalogue_frais_id && /^remise appliquee/i.test(line.libelle);
  }

  private applyDiscountToLines(lines: FactureLinePayload[], remise: ResolvedRemise | null) {
    const baseLines = lines.filter((line) => !this.isGeneratedDiscountLine(line));
    if (!remise) return baseLines;

    const grossTotal = this.toNumber(baseLines.reduce((sum, line) => sum + line.montant, 0));
    const discountAmount = this.computeDiscount(grossTotal, remise.type, remise.valeur);

    if (discountAmount <= 0) return baseLines;

    return [
      ...baseLines,
      {
        libelle: `Remise appliquee - ${remise.nom}`,
        quantite: 1,
        prix_unitaire: this.toNumber(-discountAmount),
        montant: this.toNumber(-discountAmount),
        catalogue_frais_id: null,
      },
    ];
  }

  private async normalizePayload(
    raw: Record<string, unknown>,
    tenantId: string,
    current?: Record<string, unknown>,
  ): Promise<FacturePayload> {
    const requestedNature =
      typeof raw.nature === "string" && raw.nature.trim() ? raw.nature.trim().toUpperCase() : null;
    const currentNature =
      typeof current?.nature === "string" && String(current.nature).trim()
        ? String(current.nature).trim().toUpperCase()
        : null;
    if ((requestedNature && requestedNature !== "FACTURE") || currentNature === "AVOIR") {
      throw new Error(
        "Les avoirs doivent etre geres uniquement depuis l'operation dediee, pas depuis le CRUD facture.",
      );
    }

    const rawFactureOrigine =
      typeof raw.facture_origine_id === "string" && raw.facture_origine_id.trim()
        ? raw.facture_origine_id.trim()
        : raw.facture_origine_id === null
          ? "__NULL__"
          : null;
    const currentFactureOrigine =
      typeof current?.facture_origine_id === "string" && String(current.facture_origine_id).trim()
        ? String(current.facture_origine_id).trim()
        : null;
    if (rawFactureOrigine !== null || currentFactureOrigine) {
      throw new Error(
        "Le lien vers une facture d'origine est reserve aux avoirs et ne peut pas etre modifie depuis ce formulaire.",
      );
    }

    const eleve_id =
      typeof raw.eleve_id === "string"
        ? raw.eleve_id.trim()
        : typeof current?.eleve_id === "string"
          ? String(current.eleve_id).trim()
          : "";
    const annee_scolaire_id =
      typeof raw.annee_scolaire_id === "string"
        ? raw.annee_scolaire_id.trim()
        : typeof current?.annee_scolaire_id === "string"
          ? String(current.annee_scolaire_id).trim()
          : "";
    const devise =
      typeof raw.devise === "string" && raw.devise.trim()
        ? raw.devise.trim().toUpperCase()
        : typeof current?.devise === "string" && String(current.devise).trim()
          ? String(current.devise).trim().toUpperCase()
          : "MGA";
    const remise_id =
      typeof raw.remise_id === "string" && raw.remise_id.trim()
        ? raw.remise_id.trim()
        : raw.remise_id === null
          ? null
          : typeof current?.remise_id === "string" && String(current.remise_id).trim()
            ? String(current.remise_id).trim()
            : null;
    const facture_origine_id =
      typeof raw.facture_origine_id === "string" && raw.facture_origine_id.trim()
        ? raw.facture_origine_id.trim()
        : raw.facture_origine_id === null
          ? null
          : typeof current?.facture_origine_id === "string" && String(current.facture_origine_id).trim()
            ? String(current.facture_origine_id).trim()
            : null;
    const nature =
      typeof raw.nature === "string" && raw.nature.trim()
        ? raw.nature.trim().toUpperCase()
        : typeof current?.nature === "string" && String(current.nature).trim()
          ? String(current.nature).trim().toUpperCase()
          : "FACTURE";
    const requestedStatus =
      typeof raw.statut === "string"
        ? raw.statut
        : typeof current?.statut === "string"
          ? String(current.statut)
          : undefined;
    const normalizedRequestedStatus = (requestedStatus ?? "").trim().toUpperCase();
    if (
      normalizedRequestedStatus &&
      normalizedRequestedStatus !== "BROUILLON" &&
      normalizedRequestedStatus !== "EMISE"
    ) {
      throw new Error(
        "Le CRUD facture n'autorise que les statuts BROUILLON ou EMISE. Utilise les operations dediees pour annuler.",
      );
    }

    const inputLines = Array.isArray(raw.lignes)
      ? raw.lignes
      : Array.isArray(current?.lignes)
        ? (current?.lignes as unknown[])
        : [];

    const lignes = inputLines.map((item, index) =>
      this.normalizeLine((item ?? {}) as Record<string, unknown>, index),
    );

    if (!eleve_id) throw new Error("L'eleve est requis.");
    if (!annee_scolaire_id) throw new Error("L'annee scolaire est requise.");
    if (lignes.length === 0) throw new Error("La facture doit contenir au moins une ligne.");

    await this.ensureEleveAndAnnee(eleve_id, annee_scolaire_id, tenantId);
    await this.validateCatalogueLinks(tenantId, eleve_id, annee_scolaire_id, lignes);
    const remise = await this.resolveRemise(remise_id, tenantId);

    const numero_facture =
      typeof raw.numero_facture === "string" && raw.numero_facture.trim()
        ? raw.numero_facture.trim().toUpperCase()
        : typeof current?.numero_facture === "string" && String(current.numero_facture).trim()
          ? String(current.numero_facture).trim().toUpperCase()
          : await this.buildInvoiceNumber(tenantId);

    const date_emission = this.parseDate(raw.date_emission ?? current?.date_emission ?? new Date());
    const date_echeance =
      raw.date_echeance === null
        ? null
        : current?.date_echeance === null && raw.date_echeance === undefined
          ? null
          : raw.date_echeance || current?.date_echeance
            ? this.parseDate(raw.date_echeance ?? current?.date_echeance)
            : null;

    const normalizedLines = this.applyDiscountToLines(lignes, remise);
    const total_montant = this.toNumber(
      normalizedLines.reduce((sum, line) => sum + line.montant, 0),
    );

    const paidAmount = Array.isArray(current?.paiements)
      ? this.sumPaiements(
          this.getActivePaiements(current?.paiements as Array<{ montant?: unknown; statut?: string | null }>),
        )
      : 0;

    const statut = this.deriveStatus(requestedStatus, total_montant, paidAmount, date_echeance);

    await this.ensureNumeroUnique(tenantId, numero_facture, current?.id as string | undefined);

    return {
      etablissement_id: tenantId,
      eleve_id,
      annee_scolaire_id,
      remise_id: remise?.id ?? null,
      facture_origine_id,
      nature,
      numero_facture,
      date_emission,
      date_echeance,
      statut,
      total_montant,
      devise,
      lignes: normalizedLines,
    };
  }

  private normalizeOperationPayload(raw: Record<string, unknown>): FactureOperationPayload {
    const montantValue = raw.montant;
    const montant =
      montantValue === null || montantValue === undefined || montantValue === ""
        ? null
        : this.toNumber(montantValue);

    return {
      motif: this.normalizeText(raw.motif),
      montant,
    };
  }

  private getOperationFinanciereDelegate(tx: Prisma.TransactionClient) {
    return (tx as unknown as TransactionWithFinance).operationFinanciere;
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return { etablissement_id: tenantId };
    }

    return {
      AND: [existingWhere, { etablissement_id: tenantId }],
    };
  }

  private getInclude() {
    return {
      eleve: {
        include: {
          utilisateur: { include: { profil: true } },
        },
      },
      annee: true,
      remise: true,
      factureOrigine: true,
      avoirs: true,
      lignes: {
        include: {
          frais: true,
        },
      },
      echeances: {
        include: {
          affectations: true,
        },
        orderBy: [{ ordre: "asc" as const }, { date_echeance: "asc" as const }],
      },
      paiements: true,
      operationsFinancieres: {
        orderBy: [{ created_at: "desc" as const }],
      },
    };
  }

  private async getScopedFacture(id: string, tenantId: string) {
    return this.prisma.facture.findFirst({
      where: { id, etablissement_id: tenantId },
      include: this.getInclude(),
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = await this.normalizePayload(req.body as Record<string, unknown>, tenantId);

      const result = await this.prisma.$transaction(async (tx) => {
        const facture = await tx.facture.create({
          data: {
            etablissement_id: data.etablissement_id,
            eleve_id: data.eleve_id,
            annee_scolaire_id: data.annee_scolaire_id,
            remise_id: data.remise_id,
            facture_origine_id: data.facture_origine_id,
            nature: data.nature,
            numero_facture: data.numero_facture,
            date_emission: data.date_emission,
            date_echeance: data.date_echeance,
            statut: data.statut,
            total_montant: data.total_montant,
            devise: data.devise,
          } as never,
        });

        if (data.lignes.length > 0) {
          await tx.factureLigne.createMany({
            data: data.lignes.map((line) => ({
              facture_id: facture.id,
              catalogue_frais_id: line.catalogue_frais_id ?? null,
              libelle: line.libelle,
              quantite: line.quantite,
              prix_unitaire: line.prix_unitaire,
              montant: line.montant,
            })),
          });
        }

        await ensureFactureEcheances(tx, { factureId: facture.id });
        await syncFactureStatusFromEcheances(tx, facture.id);

        return tx.facture.findUnique({
          where: { id: facture.id },
          include: this.getInclude(),
        });
      });

      Response.success(res, "Facture creee avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de la facture", 400, error as Error);
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId)),
        orderBy:
          req.query.orderBy ??
          JSON.stringify([{ date_emission: "desc" }, { created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.facture);
      Response.success(res, "Liste des factures recuperee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des factures", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, this.getInclude());
      const result = await this.prisma.facture.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId },
        include: includeSpec,
      });

      if (!result) {
        throw new Error("Facture introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail de la facture.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la facture", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedFacture(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Facture introuvable pour cet etablissement.");
      }

      if (this.getActivePaiements(existing.paiements ?? []).length > 0) {
        throw new Error("Cette facture contient deja des paiements et ne peut pas etre supprimee.");
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.factureLigne.deleteMany({
          where: { facture_id: req.params.id },
        });

        return tx.facture.delete({
          where: { id: req.params.id },
        });
      });

      Response.success(res, "Facture supprimee avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de la facture", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedFacture(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Facture introuvable pour cet etablissement.");
      }

      if (this.getActivePaiements(existing.paiements ?? []).length > 0) {
        throw new Error("Cette facture contient deja des paiements et ne peut plus etre modifiee.");
      }

      if (existing.echeances?.some((item) => item.plan_paiement_id)) {
        throw new Error("Cette facture suit un plan de paiement. Modifie les echeances depuis le module Plans de paiement.");
      }

      const data = await this.normalizePayload(
        req.body as Record<string, unknown>,
        tenantId,
        existing as unknown as Record<string, unknown>,
      );

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.facture.update({
          where: { id: req.params.id },
          data: {
            eleve_id: data.eleve_id,
            annee_scolaire_id: data.annee_scolaire_id,
            remise_id: data.remise_id,
            facture_origine_id: data.facture_origine_id,
            nature: data.nature,
            numero_facture: data.numero_facture,
            date_emission: data.date_emission,
            date_echeance: data.date_echeance,
            statut: data.statut,
            total_montant: data.total_montant,
            devise: data.devise,
          } as never,
        });

        await tx.factureLigne.deleteMany({
          where: { facture_id: req.params.id },
        });

        if (data.lignes.length > 0) {
          await tx.factureLigne.createMany({
            data: data.lignes.map((line) => ({
              facture_id: req.params.id,
              catalogue_frais_id: line.catalogue_frais_id ?? null,
              libelle: line.libelle,
              quantite: line.quantite,
              prix_unitaire: line.prix_unitaire,
              montant: line.montant,
            })),
          });
        }

        await ensureFactureEcheances(tx, { factureId: req.params.id });
        await syncFactureStatusFromEcheances(tx, req.params.id);

        return tx.facture.findUnique({
          where: { id: req.params.id },
          include: this.getInclude(),
        });
      });

      Response.success(res, "Facture mise a jour avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de la facture", 400, error as Error);
      next(error);
    }
  }

  private async cancel(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedFacture(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Facture introuvable pour cet etablissement.");
      }

      const activePayments = this.getActivePaiements(existing.paiements ?? []);
      if (activePayments.length > 0) {
        throw new Error("Cette facture comporte des paiements actifs. Annule ou rembourse d'abord les paiements.");
      }

      if ((existing.echeances ?? []).some((item) => item.plan_paiement_id)) {
        throw new Error("Cette facture est rattachee a un plan de paiement. Traite-la depuis le plan de paiement.");
      }

      const payload = this.normalizeOperationPayload(req.body as Record<string, unknown>);

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.facture.update({
          where: { id: existing.id },
          data: {
            statut: "ANNULEE",
          },
        });

        await tx.echeancePaiement.updateMany({
          where: { facture_id: existing.id },
          data: {
            statut: "ANNULEE",
            montant_restant: 0,
          },
        });

        await this.getOperationFinanciereDelegate(tx).create({
          data: {
            etablissement_id: tenantId,
            facture_id: existing.id,
            cree_par_utilisateur_id: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
            type: "ANNULATION_FACTURE",
            montant: existing.total_montant,
            motif: payload.motif,
            details_json: {
              numero_facture: existing.numero_facture,
              nature: (existing as { nature?: string | null }).nature ?? "FACTURE",
            },
          },
        });

        return tx.facture.findUnique({
          where: { id: existing.id },
          include: this.getInclude(),
        });
      });

      Response.success(res, "Facture annulee avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de l'annulation de la facture", 400, error as Error);
      next(error);
    }
  }

  private async createCreditNote(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedFacture(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Facture introuvable pour cet etablissement.");
      }

      if ((existing.statut ?? "").toUpperCase() === "ANNULEE") {
        throw new Error("Impossible de creer un avoir sur une facture deja annulee.");
      }

      const payload = this.normalizeOperationPayload(req.body as Record<string, unknown>);
      const outstandingAmount =
        (existing.echeances?.length ?? 0) > 0
          ? Number(
              existing.echeances?.reduce(
                (sum, item) => sum + Math.max(0, Number(item.montant_restant ?? 0)),
                0,
              ) ?? 0,
            )
          : Math.max(
              0,
              Number(existing.total_montant ?? 0) -
                this.sumPaiements(this.getActivePaiements(existing.paiements ?? [])),
            );
      const amount =
        payload.montant ??
        outstandingAmount ??
        Number(existing.total_montant ?? 0);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Le montant de l'avoir doit etre strictement positif.");
      }

      const creditNumber = await this.buildCreditNoteNumber(tenantId);

      const result = await this.prisma.$transaction(async (tx) => {
        const compensationAmount = Math.min(amount, outstandingAmount);
        const avoir = await tx.facture.create({
          data: {
            etablissement_id: tenantId,
            eleve_id: existing.eleve_id,
            annee_scolaire_id: existing.annee_scolaire_id,
            remise_id: null,
            facture_origine_id: existing.id,
            nature: "AVOIR",
            numero_facture: creditNumber,
            date_emission: new Date(),
            date_echeance: new Date(),
            statut: "PAYEE",
            total_montant: -Math.abs(amount),
            devise: existing.devise ?? "MGA",
          } as never,
        });

        await tx.factureLigne.create({
          data: {
            facture_id: avoir.id,
            catalogue_frais_id: null,
            libelle: `Avoir pour ${existing.numero_facture}`,
            quantite: 1,
            prix_unitaire: -Math.abs(amount),
            montant: -Math.abs(amount),
          },
        });

        if (compensationAmount > 0) {
          await applyCreditToFactureEcheances(tx, existing.id, compensationAmount);
        }

        await this.getOperationFinanciereDelegate(tx).create({
          data: {
            etablissement_id: tenantId,
            facture_id: existing.id,
            cree_par_utilisateur_id: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
            type: "AVOIR_FACTURE",
            montant: amount,
            motif: payload.motif,
            details_json: {
              facture_avoir_id: avoir.id,
              numero_avoir: avoir.numero_facture,
              montant_applique: compensationAmount,
              montant_non_affecte: Math.max(0, amount - compensationAmount),
            },
          },
        });

        return tx.facture.findUnique({
          where: { id: avoir.id },
          include: this.getInclude(),
        });
      });

      Response.success(res, "Avoir cree avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de l'avoir", 400, error as Error);
      next(error);
    }
  }
}

export default FactureApp;
