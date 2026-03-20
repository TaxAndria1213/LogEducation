import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type Programme } from "@prisma/client";
import Response from "../../../common/app/response";
import ProgrammeModel from "../models/programme.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";

type ProgrammeMatierePayload = {
  matiere_id: string;
  heures_semaine: number | null;
  coefficient: number | null;
};

type ProgrammePayload = Pick<
  Programme,
  "etablissement_id" | "annee_scolaire_id" | "niveau_scolaire_id" | "nom"
> & {
  matieres: ProgrammeMatierePayload[];
};

class ProgrammeApp {
  public app: Application;
  public router: Router;
  private programme: ProgrammeModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.programme = new ProgrammeModel();
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
      throw new Error("Conflit d'etablissement detecte pour le programme.");
    }

    return tenantCandidates[0];
  }

  private normalizeProgrammeMatiereLines(raw: unknown): ProgrammeMatierePayload[] {
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error("Le programme doit contenir au moins une matiere.");
    }

    const normalizedLines = raw.map((entry) => {
      const source = typeof entry === "object" && entry !== null ? entry : {};
      const matiere_id =
        typeof (source as { matiere_id?: unknown }).matiere_id === "string"
          ? (source as { matiere_id: string }).matiere_id.trim()
          : "";

      if (!matiere_id) {
        throw new Error("Chaque ligne de programme doit referencer une matiere.");
      }

      const heuresRaw = (source as { heures_semaine?: unknown }).heures_semaine;
      const coefficientRaw = (source as { coefficient?: unknown }).coefficient;

      const heures_semaine =
        heuresRaw === undefined || heuresRaw === null || heuresRaw === ""
          ? null
          : Number(heuresRaw);
      const coefficient =
        coefficientRaw === undefined || coefficientRaw === null || coefficientRaw === ""
          ? null
          : Number(coefficientRaw);

      if (heures_semaine !== null) {
        if (!Number.isInteger(heures_semaine) || heures_semaine < 0) {
          throw new Error("Les heures par semaine doivent etre un entier positif.");
        }
      }

      if (coefficient !== null) {
        if (!Number.isFinite(coefficient) || coefficient < 0) {
          throw new Error("Le coefficient doit etre un nombre positif.");
        }
      }

      return {
        matiere_id,
        heures_semaine,
        coefficient,
      };
    });

    const ids = normalizedLines.map((line) => line.matiere_id);
    if (new Set(ids).size !== ids.length) {
      throw new Error("Une matiere ne peut apparaitre qu'une seule fois dans un programme.");
    }

    return normalizedLines;
  }

  private normalizePayload(raw: Partial<ProgrammePayload>, tenantId: string): ProgrammePayload {
    const nom = typeof raw.nom === "string" ? raw.nom.trim().replace(/\s+/g, " ") : "";
    const annee_scolaire_id =
      typeof raw.annee_scolaire_id === "string" ? raw.annee_scolaire_id.trim() : "";
    const niveau_scolaire_id =
      typeof raw.niveau_scolaire_id === "string" ? raw.niveau_scolaire_id.trim() : "";

    if (!nom) {
      throw new Error("Le nom du programme est requis.");
    }

    if (!annee_scolaire_id) {
      throw new Error("L'annee scolaire du programme est requise.");
    }

    if (!niveau_scolaire_id) {
      throw new Error("Le niveau scolaire du programme est requis.");
    }

    return {
      etablissement_id: tenantId,
      annee_scolaire_id,
      niveau_scolaire_id,
      nom,
      matieres: this.normalizeProgrammeMatiereLines(raw.matieres),
    };
  }

  private async validateReferences(payload: ProgrammePayload): Promise<void> {
    const [annee, niveau, matieres] = await Promise.all([
      this.prisma.anneeScolaire.findFirst({
        where: {
          id: payload.annee_scolaire_id,
          etablissement_id: payload.etablissement_id,
        },
        select: { id: true },
      }),
      this.prisma.niveauScolaire.findFirst({
        where: {
          id: payload.niveau_scolaire_id,
          etablissement_id: payload.etablissement_id,
        },
        select: { id: true },
      }),
      this.prisma.matiere.findMany({
        where: {
          etablissement_id: payload.etablissement_id,
          id: {
            in: payload.matieres.map((line) => line.matiere_id),
          },
        },
        select: { id: true },
      }),
    ]);

    if (!annee) {
      throw new Error("L'annee scolaire selectionnee n'appartient pas a l'etablissement actif.");
    }

    if (!niveau) {
      throw new Error("Le niveau scolaire selectionne n'appartient pas a l'etablissement actif.");
    }

    if (matieres.length !== payload.matieres.length) {
      throw new Error("Au moins une matiere selectionnee n'appartient pas a l'etablissement actif.");
    }
  }

  private async ensureUniqueProgramme(payload: ProgrammePayload, excludeId?: string) {
    const existing = await this.prisma.programme.findFirst({
      where: {
        etablissement_id: payload.etablissement_id,
        annee_scolaire_id: payload.annee_scolaire_id,
        niveau_scolaire_id: payload.niveau_scolaire_id,
        nom: payload.nom,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error(
        "Un programme portant ce nom existe deja pour cette annee scolaire et ce niveau.",
      );
    }
  }

  private buildScopedWhere(
    existingWhere: Record<string, unknown>,
    tenantId: string,
  ): Record<string, unknown> {
    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return { etablissement_id: tenantId };
    }

    return {
      AND: [existingWhere, { etablissement_id: tenantId }],
    };
  }

  private async getScopedProgramme(id: string, tenantId: string) {
    return this.prisma.programme.findFirst({
      where: {
        id,
        etablissement_id: tenantId,
      },
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body, tenantId);

      await this.validateReferences(payload);
      await this.ensureUniqueProgramme(payload);

      const result = await this.prisma.$transaction(async (tx) => {
        const programme = await tx.programme.create({
          data: {
            etablissement_id: payload.etablissement_id,
            annee_scolaire_id: payload.annee_scolaire_id,
            niveau_scolaire_id: payload.niveau_scolaire_id,
            nom: payload.nom,
          },
        });

        await tx.programmeMatiere.createMany({
          data: payload.matieres.map((line) => ({
            programme_id: programme.id,
            matiere_id: line.matiere_id,
            heures_semaine: line.heures_semaine,
            coefficient: line.coefficient,
          })),
        });

        return tx.programme.findUnique({
          where: { id: programme.id },
          include: {
            annee: true,
            niveau: true,
            matieres: {
              include: {
                matiere: {
                  include: {
                    departement: true,
                  },
                },
              },
            },
          },
        });
      });

      Response.success(res, "Programme cree avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation du programme",
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
        orderBy:
          req.query.orderBy ??
          JSON.stringify([{ created_at: "desc" }]),
      };

      const result = await getAllPaginated(scopedQuery as typeof req.query, this.programme);
      Response.success(res, "Liste des programmes recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des programmes",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;

      const result = await this.prisma.programme.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
        },
        include: {
          annee: true,
          niveau: true,
          matieres: {
            include: {
              matiere: {
                include: {
                  departement: true,
                },
              },
            },
          },
        },
      });

      if (!result) {
        throw new Error("Programme introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail du programme.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation du programme",
        404,
        error as Error,
      );
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;
      const existing = await this.getScopedProgramme(id, tenantId);

      if (!existing) {
        throw new Error("Programme introuvable pour cet etablissement.");
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.programmeMatiere.deleteMany({
          where: { programme_id: id },
        });

        return tx.programme.delete({
          where: { id },
        });
      });

      Response.success(res, "Programme supprime avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression du programme",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;
      const existing = await this.getScopedProgramme(id, tenantId);

      if (!existing) {
        throw new Error("Programme introuvable pour cet etablissement.");
      }

      const payload = this.normalizePayload(req.body, tenantId);

      await this.validateReferences(payload);
      await this.ensureUniqueProgramme(payload, id);

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.programme.update({
          where: { id },
          data: {
            etablissement_id: payload.etablissement_id,
            annee_scolaire_id: payload.annee_scolaire_id,
            niveau_scolaire_id: payload.niveau_scolaire_id,
            nom: payload.nom,
          },
        });

        await tx.programmeMatiere.deleteMany({
          where: { programme_id: id },
        });

        await tx.programmeMatiere.createMany({
          data: payload.matieres.map((line) => ({
            programme_id: id,
            matiere_id: line.matiere_id,
            heures_semaine: line.heures_semaine,
            coefficient: line.coefficient,
          })),
        });

        return tx.programme.findUnique({
          where: { id },
          include: {
            annee: true,
            niveau: true,
            matieres: {
              include: {
                matiere: {
                  include: {
                    departement: true,
                  },
                },
              },
            },
          },
        });
      });

      Response.success(res, "Programme mis a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour du programme",
        400,
        error as Error,
      );
      next(error);
    }
  }
}

export default ProgrammeApp;
