import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import LigneTransportModel from "../models/ligne_transport.model";
import { prisma } from "../../../service/prisma";

type LigneTransportPayload = {
  etablissement_id: string;
  nom: string;
  catalogue_frais_id: string;
  infos_vehicule_json: unknown;
};

type LigneTransportSettings = {
  zones: string[];
  zone_tarifs: Record<string, number>;
  inscriptions_ouvertes: boolean;
  prorata_mode: "MONTH" | "SCHOOL_YEAR";
  access_rules: {
    bloquer_si_a_facturer: boolean;
    bloquer_si_en_attente_reglement: boolean;
    bloquer_si_suspension_financiere: boolean;
    autoriser_avant_date_debut: boolean;
    validation_humaine_suspension_financiere: boolean;
  };
};

class LigneTransportApp {
  public app: Application;
  public router: Router;
  private ligneTransport: LigneTransportModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.ligneTransport = new LigneTransportModel();
    this.prisma = prisma;
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
      typeof req.body?.etablissement_id === "string" ? req.body.etablissement_id.trim() : undefined;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.etablissement_id === "string" ? queryWhere.etablissement_id.trim() : undefined;
    const candidates = [requestTenant, bodyTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (candidates.length === 0) throw new Error("Aucun etablissement actif n'a ete fourni.");
    if (new Set(candidates).size > 1) throw new Error("Conflit d'etablissement detecte pour les lignes de transport.");
    return candidates[0];
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    if (!existingWhere || Object.keys(existingWhere).length === 0) return { etablissement_id: tenantId };
    return { AND: [existingWhere, { etablissement_id: tenantId }] };
  }

  private parseLineSettings(raw: Record<string, unknown>): LigneTransportSettings {
    const rawZones = raw.zones_transport;
    const zones: string[] = [];
    const zoneTarifs: Record<string, number> = {};
    const sourceZones =
      Array.isArray(rawZones)
        ? rawZones
        : typeof rawZones === "string"
          ? rawZones.split(",")
          : [];

    sourceZones.forEach((item) => {
      if (typeof item !== "string") return;
      const [rawLabel, rawAmount] = item.split(":");
      const label = rawLabel?.trim();
      if (!label) return;
      zones.push(label);
      if (rawAmount != null && rawAmount.trim()) {
        const parsedAmount = Number(rawAmount.trim());
        if (Number.isFinite(parsedAmount) && parsedAmount >= 0) {
          zoneTarifs[label] = Math.round(parsedAmount * 100) / 100;
        }
      }
    });

    return {
      zones,
      zone_tarifs: zoneTarifs,
      inscriptions_ouvertes:
        raw.inscriptions_ouvertes === false ||
        raw.inscriptions_ouvertes === "false" ||
        raw.inscriptions_ouvertes === 0 ||
        raw.inscriptions_ouvertes === "0"
          ? false
          : true,
      prorata_mode:
        raw.prorata_mode === "SCHOOL_YEAR" || raw.prorata_mode === "ANNEE_SCOLAIRE"
          ? "SCHOOL_YEAR"
          : "MONTH",
      access_rules: {
        bloquer_si_a_facturer:
          raw.bloquer_si_a_facturer === false || raw.bloquer_si_a_facturer === "false"
            ? false
            : true,
        bloquer_si_en_attente_reglement:
          raw.bloquer_si_en_attente_reglement === false ||
          raw.bloquer_si_en_attente_reglement === "false"
            ? false
            : true,
        bloquer_si_suspension_financiere:
          raw.bloquer_si_suspension_financiere === false ||
          raw.bloquer_si_suspension_financiere === "false"
            ? false
            : true,
        autoriser_avant_date_debut:
          raw.autoriser_avant_date_debut === true || raw.autoriser_avant_date_debut === "true",
        validation_humaine_suspension_financiere:
          raw.validation_humaine_suspension_financiere === true ||
          raw.validation_humaine_suspension_financiere === "true",
      },
    };
  }

  private async normalizePayload(raw: Record<string, unknown>, tenantId: string): Promise<LigneTransportPayload> {
    const nom = typeof raw.nom === "string" ? raw.nom.trim() : "";
    const catalogue_frais_id =
      typeof raw.catalogue_frais_id === "string" && raw.catalogue_frais_id.trim()
        ? raw.catalogue_frais_id.trim()
        : "";

    if (!nom) {
      throw new Error("Le nom de la ligne de transport est obligatoire.");
    }

    if (!catalogue_frais_id) {
      throw new Error("Le frais catalogue de la ligne de transport est obligatoire.");
    }

    const frais = await this.prisma.catalogueFrais.findFirst({
      where: {
        id: catalogue_frais_id,
        etablissement_id: tenantId,
      },
      select: {
        id: true,
        usage_scope: true as never,
      },
    }) as { id: string; usage_scope: string | null } | null;

    if (!frais) {
      throw new Error("Le frais selectionne n'appartient pas a cet etablissement.");
    }

    const usageScope = (frais.usage_scope ?? "GENERAL").toUpperCase();
    if (!["GENERAL", "TRANSPORT"].includes(usageScope)) {
      throw new Error("Le frais selectionne n'est pas compatible avec le transport.");
    }

    const settings = this.parseLineSettings(raw);
    if (settings.zones.length === 0) {
      throw new Error("Au moins une zone de transport doit etre parametree.");
    }

    return {
      etablissement_id: tenantId,
      nom,
      catalogue_frais_id,
      infos_vehicule_json: {
        ...(raw.infos_vehicule_json && typeof raw.infos_vehicule_json === "object" && !Array.isArray(raw.infos_vehicule_json)
          ? (raw.infos_vehicule_json as Record<string, unknown>)
          : {}),
        zones: settings.zones,
        zone_tarifs: settings.zone_tarifs,
        inscriptions_ouvertes: settings.inscriptions_ouvertes,
        prorata_mode: settings.prorata_mode,
        bloquer_si_a_facturer: settings.access_rules.bloquer_si_a_facturer,
        bloquer_si_en_attente_reglement:
          settings.access_rules.bloquer_si_en_attente_reglement,
        bloquer_si_suspension_financiere:
          settings.access_rules.bloquer_si_suspension_financiere,
        autoriser_avant_date_debut: settings.access_rules.autoriser_avant_date_debut,
        validation_humaine_suspension_financiere:
          settings.access_rules.validation_humaine_suspension_financiere,
      },
    };
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = await this.normalizePayload(req.body as Record<string, unknown>, tenantId);
      const result = await this.ligneTransport.create(data);
      Response.success(res, "Ligne de transport creee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de la ligne de transport",
        400,
        error as Error,
      );
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
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.ligneTransport);
      Response.success(res, "Lignes de transport.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des lignes de transport",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const result = await this.prisma.ligneTransport.findFirst({
        where: { id, etablissement_id: tenantId },
        include: { arrets: true, abonnements: true, frais: true },
      });
      Response.success(res, "Ligne de transport.", result);
    } catch (error) {
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const existing = await this.prisma.ligneTransport.findFirst({
        where: { id, etablissement_id: tenantId },
        include: { abonnements: true, frais: true },
      });
      if (!existing) throw new Error("Ligne de transport introuvable.");
      if ((existing.abonnements?.length ?? 0) > 0) {
        throw new Error("Cette ligne est utilisee par des abonnements transport.");
      }
      const result = await this.ligneTransport.delete(id);
      Response.success(res, "Ligne de transport supprimee.", result);
    } catch (error) {
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const existing = await this.prisma.ligneTransport.findFirst({
        where: { id, etablissement_id: tenantId },
        select: { id: true },
      });
      if (!existing) throw new Error("Ligne de transport introuvable.");
      const data = await this.normalizePayload(req.body as Record<string, unknown>, tenantId);
      const result = await this.ligneTransport.update(id, data);
      Response.success(res, "Ligne de transport mise a jour.", result);
    } catch (error) {
      next(error);
    }
  }
}

export default LigneTransportApp;

