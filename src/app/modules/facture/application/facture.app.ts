import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type Prisma, type StatutFacture } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { ensureFactureEcheances, syncFactureStatusFromEcheances } from "../../finance_shared/utils/echeance_paiement";
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
  numero_facture: string;
  date_emission: Date;
  date_echeance: Date | null;
  statut: StatutFacture;
  total_montant: number;
  devise: string;
  lignes: FactureLinePayload[];
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
        niveau_scolaire_id: niveauId,
      } as never,
      select: { id: true },
    });

    if (found.length !== ids.length) {
      throw new Error("Une ligne reference un frais catalogue qui ne correspond pas au niveau scolaire de l'eleve.");
    }
  }

  private async normalizePayload(
    raw: Record<string, unknown>,
    tenantId: string,
    current?: Record<string, unknown>,
  ): Promise<FacturePayload> {
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
    const requestedStatus =
      typeof raw.statut === "string"
        ? raw.statut
        : typeof current?.statut === "string"
          ? String(current.statut)
          : undefined;

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

    const total_montant = this.toNumber(
      lignes.reduce((sum, line) => sum + line.montant, 0),
    );

    const paidAmount = Array.isArray(current?.paiements)
      ? (current?.paiements as Array<{ montant?: unknown }>).reduce(
          (sum, payment) => sum + this.toNumber(payment?.montant ?? 0),
          0,
        )
      : 0;

    const statut = this.deriveStatus(requestedStatus, total_montant, paidAmount, date_echeance);

    await this.ensureNumeroUnique(tenantId, numero_facture, current?.id as string | undefined);

    return {
      etablissement_id: tenantId,
      eleve_id,
      annee_scolaire_id,
      numero_facture,
      date_emission,
      date_echeance,
      statut,
      total_montant,
      devise,
      lignes,
    };
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
            numero_facture: data.numero_facture,
            date_emission: data.date_emission,
            date_echeance: data.date_echeance,
            statut: data.statut,
            total_montant: data.total_montant,
            devise: data.devise,
          },
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

      if ((existing.paiements?.length ?? 0) > 0) {
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

      if ((existing.paiements?.length ?? 0) > 0) {
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
            numero_facture: data.numero_facture,
            date_emission: data.date_emission,
            date_echeance: data.date_echeance,
            statut: data.statut,
            total_montant: data.total_montant,
            devise: data.devise,
          },
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
}

export default FactureApp;
