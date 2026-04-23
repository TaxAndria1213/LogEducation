import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type Cours } from "@prisma/client";
import Response from "../../../common/app/response";
import CoursModel from "../models/cours.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";

type CoursPayload = Pick<
  Cours,
  | "etablissement_id"
  | "annee_scolaire_id"
  | "classe_id"
  | "matiere_id"
  | "enseignant_id"
  | "coefficient_override"
>;

class CoursApp {
  public app: Application;
  public router: Router;
  private cours: CoursModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.cours = new CoursModel();
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
      throw new Error("Conflit d'etablissement detecte pour le cours.");
    }

    return tenantCandidates[0];
  }

  private normalizePayload(raw: Partial<Cours>, tenantId: string): CoursPayload {
    const annee_scolaire_id =
      typeof raw.annee_scolaire_id === "string" ? raw.annee_scolaire_id.trim() : "";
    const classe_id = typeof raw.classe_id === "string" ? raw.classe_id.trim() : "";
    const matiere_id = typeof raw.matiere_id === "string" ? raw.matiere_id.trim() : "";
    const enseignant_id =
      typeof raw.enseignant_id === "string" ? raw.enseignant_id.trim() : "";

    if (!annee_scolaire_id) {
      throw new Error("L'annee scolaire du cours est requise.");
    }

    if (!classe_id) {
      throw new Error("La classe du cours est requise.");
    }

    if (!matiere_id) {
      throw new Error("La matiere du cours est requise.");
    }

    if (!enseignant_id) {
      throw new Error("L'enseignant du cours est requis.");
    }

    const coefficientRaw = (raw as { coefficient_override?: unknown }).coefficient_override;
    const coefficient_override =
      coefficientRaw === undefined || coefficientRaw === null || coefficientRaw === ""
        ? null
        : Number(coefficientRaw);

    if (coefficient_override !== null) {
      if (!Number.isFinite(coefficient_override) || coefficient_override < 0) {
        throw new Error("Le coefficient du cours doit etre un nombre positif.");
      }
    }

    return {
      etablissement_id: tenantId,
      annee_scolaire_id,
      classe_id,
      matiere_id,
      enseignant_id,
      coefficient_override,
    };
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

  private async ensureUniqueCours(payload: CoursPayload, excludeId?: string) {
    const existing = await this.prisma.cours.findFirst({
      where: {
        etablissement_id: payload.etablissement_id,
        annee_scolaire_id: payload.annee_scolaire_id,
        classe_id: payload.classe_id,
        matiere_id: payload.matiere_id,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error(
        "Un cours existe deja pour cette classe, cette matiere et cette annee scolaire.",
      );
    }
  }

  private async validateReferences(payload: CoursPayload): Promise<void> {
    const [annee, classe, matiere, enseignant, programmes] = await Promise.all([
      this.prisma.anneeScolaire.findFirst({
        where: {
          id: payload.annee_scolaire_id,
          etablissement_id: payload.etablissement_id,
        },
        select: { id: true },
      }),
      this.prisma.classe.findFirst({
        where: {
          id: payload.classe_id,
          etablissement_id: payload.etablissement_id,
        },
        select: {
          id: true,
          annee_scolaire_id: true,
          niveau_scolaire_id: true,
        },
      }),
      this.prisma.matiere.findFirst({
        where: {
          id: payload.matiere_id,
          etablissement_id: payload.etablissement_id,
        },
        select: {
          id: true,
          nom: true,
          departement_id: true,
        },
      }),
      this.prisma.enseignant.findFirst({
        where: {
          id: payload.enseignant_id,
          personnel: {
            etablissement_id: payload.etablissement_id,
          },
        },
        select: {
          id: true,
          departement_principal_id: true,
        },
      }),
      this.prisma.programme.findMany({
        where: {
          etablissement_id: payload.etablissement_id,
          annee_scolaire_id: payload.annee_scolaire_id,
        },
        select: {
          id: true,
          niveau_scolaire_id: true,
          matieres: {
            select: {
              matiere_id: true,
            },
          },
        },
      }),
    ]);

    if (!annee) {
      throw new Error("L'annee scolaire selectionnee n'appartient pas a l'etablissement actif.");
    }

    if (!classe) {
      throw new Error("La classe selectionnee n'appartient pas a l'etablissement actif.");
    }

    if (classe.annee_scolaire_id !== payload.annee_scolaire_id) {
      throw new Error("La classe selectionnee n'est pas rattachee a l'annee scolaire choisie.");
    }

    if (!matiere) {
      throw new Error("La matiere selectionnee n'appartient pas a l'etablissement actif.");
    }

    if (!enseignant) {
      throw new Error("L'enseignant selectionne n'appartient pas a l'etablissement actif.");
    }

    if (
      matiere.departement_id &&
      enseignant.departement_principal_id &&
      matiere.departement_id !== enseignant.departement_principal_id
    ) {
      throw new Error(
        "La matiere selectionnee n'appartient pas au departement principal de l'enseignant choisi.",
      );
    }

    const matchingProgrammes = programmes.filter(
      (programme) => programme.niveau_scolaire_id === classe.niveau_scolaire_id,
    );

    if (matchingProgrammes.length > 0) {
      const allowedMatiereIds = new Set(
        matchingProgrammes.flatMap((programme) =>
          programme.matieres.map((line) => line.matiere_id),
        ),
      );

      if (!allowedMatiereIds.has(payload.matiere_id)) {
        throw new Error(
          `La matiere ${matiere.nom} n'est presente dans aucun programme de ce niveau pour l'annee selectionnee.`,
        );
      }
    }
  }

  private async getScopedCours(id: string, tenantId: string) {
    return this.prisma.cours.findFirst({
      where: {
        id,
        etablissement_id: tenantId,
      },
    });
  }

  private getDetailInclude() {
    return {
      annee: true,
      classe: {
        include: {
          niveau: true,
          site: true,
        },
      },
      matiere: {
        include: {
          departement: true,
        },
      },
      enseignant: {
        include: {
          departement: true,
          personnel: {
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
      evaluations: {
        select: {
          id: true,
        },
      },
      emploiDuTemps: {
        select: {
          id: true,
        },
      },
    };
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body, tenantId);

      await this.validateReferences(payload);
      await this.ensureUniqueCours(payload);

      const result = await this.prisma.cours.create({
        data: payload,
        include: this.getDetailInclude(),
      });

      Response.success(res, "Cours cree avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation du cours",
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
        orderBy: req.query.orderBy ?? JSON.stringify([{ created_at: "desc" }]),
      };

      const result = await getAllPaginated(scopedQuery as typeof req.query, this.cours);
      Response.success(res, "Liste des cours recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des cours",
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

      const result = await this.prisma.cours.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
        },
        include: this.getDetailInclude(),
      });

      if (!result) {
        throw new Error("Cours introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail du cours.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation du cours",
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

      const existing = await this.prisma.cours.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
        },
        include: {
          _count: {
            select: {
              evaluations: true,
              emploiDuTemps: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("Cours introuvable pour cet etablissement.");
      }

      const blockingRelations: string[] = [];

      if (existing._count.evaluations > 0) {
        blockingRelations.push(`${existing._count.evaluations} evaluation(s)`);
      }

      if (existing._count.emploiDuTemps > 0) {
        blockingRelations.push(`${existing._count.emploiDuTemps} element(s) d'emploi du temps`);
      }

      if (blockingRelations.length > 0) {
        throw new Error(
          `Suppression impossible: ce cours est encore utilise dans ${blockingRelations.join(", ")}.`,
        );
      }

      const result = await this.cours.delete(id);
      Response.success(res, "Cours supprime avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression du cours",
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
      const existing = await this.getScopedCours(id, tenantId);

      if (!existing) {
        throw new Error("Cours introuvable pour cet etablissement.");
      }

      const payload = this.normalizePayload(req.body, tenantId);

      await this.validateReferences(payload);
      await this.ensureUniqueCours(payload, id);

      const result = await this.prisma.cours.update({
        where: { id },
        data: payload,
        include: this.getDetailInclude(),
      });

      Response.success(res, "Cours mis a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour du cours",
        400,
        error as Error,
      );
      next(error);
    }
  }
}

export default CoursApp;

