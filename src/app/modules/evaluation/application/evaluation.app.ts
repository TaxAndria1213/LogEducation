import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, TypeEvaluation, type Evaluation } from "@prisma/client";
import Response from "../../../common/app/response";
import EvaluationModel from "../models/evaluation.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";

type EvaluationPayload = Pick<
  Evaluation,
  | "cours_id"
  | "periode_id"
  | "type_evaluation_id"
  | "type"
  | "titre"
  | "date"
  | "note_max"
  | "poids"
  | "est_publiee"
  | "cree_par_enseignant_id"
>;

class EvaluationApp {
  public app: Application;
  public router: Router;
  private evaluation: EvaluationModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.evaluation = new EvaluationModel();
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
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.cours === "object" &&
      queryWhere.cours !== null &&
      typeof (queryWhere.cours as { etablissement_id?: unknown }).etablissement_id === "string"
        ? ((queryWhere.cours as { etablissement_id: string }).etablissement_id).trim()
        : undefined;

    const tenantCandidates = [requestTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour l'evaluation.");
    }

    return tenantCandidates[0];
  }

  private normalizePayload(raw: Partial<Evaluation>): EvaluationPayload {
    const cours_id = typeof raw.cours_id === "string" ? raw.cours_id.trim() : "";
    const periode_id = typeof raw.periode_id === "string" ? raw.periode_id.trim() : "";
    const type_evaluation_id =
      typeof raw.type_evaluation_id === "string" && raw.type_evaluation_id.trim()
        ? raw.type_evaluation_id.trim()
        : null;
    const titre = typeof raw.titre === "string" ? raw.titre.trim().replace(/\s+/g, " ") : "";
    const type =
      raw.type && Object.values(TypeEvaluation).includes(raw.type)
        ? raw.type
        : TypeEvaluation.AUTRE;
    const dateValue = raw.date ? new Date(raw.date) : new Date();
    const noteMaxRaw = (raw as { note_max?: unknown }).note_max;
    const poidsRaw = (raw as { poids?: unknown }).poids;
    const est_publiee = Boolean(raw.est_publiee);
    const cree_par_enseignant_id =
      typeof raw.cree_par_enseignant_id === "string" && raw.cree_par_enseignant_id.trim()
        ? raw.cree_par_enseignant_id.trim()
        : null;

    if (!cours_id) {
      throw new Error("Le cours de l'evaluation est requis.");
    }

    if (!periode_id) {
      throw new Error("La periode de l'evaluation est requise.");
    }

    if (!titre) {
      throw new Error("Le titre de l'evaluation est requis.");
    }

    if (Number.isNaN(dateValue.getTime())) {
      throw new Error("La date de l'evaluation est invalide.");
    }

    const note_max = noteMaxRaw === undefined || noteMaxRaw === null || noteMaxRaw === ""
      ? 20
      : Number(noteMaxRaw);
    const poids = poidsRaw === undefined || poidsRaw === null || poidsRaw === ""
      ? null
      : Number(poidsRaw);

    if (!Number.isFinite(note_max) || note_max <= 0) {
      throw new Error("La note maximale doit etre un nombre strictement positif.");
    }

    if (poids !== null && (!Number.isFinite(poids) || poids <= 0)) {
      throw new Error("Le poids de l'evaluation doit etre un nombre strictement positif.");
    }

    return {
      cours_id,
      periode_id,
      type_evaluation_id,
      type,
      titre,
      date: dateValue,
      note_max,
      poids,
      est_publiee,
      cree_par_enseignant_id,
    };
  }

  private buildScopedWhere(
    existingWhere: Record<string, unknown>,
    tenantId: string,
  ): Record<string, unknown> {
    const scope = {
      cours: {
        etablissement_id: tenantId,
      },
    };

    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return scope;
    }

    return {
      AND: [existingWhere, scope],
    };
  }

  private getDetailInclude() {
    return {
      cours: {
        include: {
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
        },
      },
      periode: true,
      typeRef: true,
      createur: {
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
      notes: {
        select: {
          id: true,
          score: true,
        },
      },
    };
  }

  private async getScopedEvaluation(id: string, tenantId: string) {
    return this.prisma.evaluation.findFirst({
      where: {
        id,
        cours: {
          etablissement_id: tenantId,
        },
      },
    });
  }

  private async validateReferences(payload: EvaluationPayload, tenantId: string) {
    const [cours, periode, typeRef, createur] = await Promise.all([
      this.prisma.cours.findFirst({
        where: {
          id: payload.cours_id,
          etablissement_id: tenantId,
        },
        select: {
          id: true,
          annee_scolaire_id: true,
          enseignant_id: true,
        },
      }),
      this.prisma.periode.findFirst({
        where: {
          id: payload.periode_id,
          annee: {
            etablissement_id: tenantId,
          },
        },
        select: {
          id: true,
          annee_scolaire_id: true,
          date_debut: true,
          date_fin: true,
        },
      }),
      payload.type_evaluation_id
        ? this.prisma.typeEvaluationRef.findFirst({
            where: {
              id: payload.type_evaluation_id,
              etablissement_id: tenantId,
            },
            select: {
              id: true,
              poids_defaut: true,
            },
          })
        : Promise.resolve(null),
      payload.cree_par_enseignant_id
        ? this.prisma.enseignant.findFirst({
            where: {
              id: payload.cree_par_enseignant_id,
              personnel: {
                etablissement_id: tenantId,
              },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!cours) {
      throw new Error("Le cours selectionne n'appartient pas a l'etablissement actif.");
    }

    if (!periode) {
      throw new Error("La periode selectionnee n'appartient pas a l'etablissement actif.");
    }

    if (periode.annee_scolaire_id !== cours.annee_scolaire_id) {
      throw new Error("La periode choisie n'est pas rattachee a la meme annee scolaire que le cours.");
    }

    if (payload.date < periode.date_debut || payload.date > periode.date_fin) {
      throw new Error("La date de l'evaluation doit se situer dans l'intervalle de la periode choisie.");
    }

    if (payload.type_evaluation_id && !typeRef) {
      throw new Error("Le type d'evaluation reference n'appartient pas a l'etablissement actif.");
    }

    if (payload.cree_par_enseignant_id && !createur) {
      throw new Error("L'enseignant createur n'appartient pas a l'etablissement actif.");
    }

    return {
      cours,
      typeRef,
      createurId: payload.cree_par_enseignant_id ?? cours.enseignant_id,
    };
  }

  private normalizeForPersistence(
    payload: EvaluationPayload,
    createurId: string,
    typeRef?: { poids_defaut: number | null } | null,
  ): EvaluationPayload {
    return {
      ...payload,
      poids: payload.poids ?? typeRef?.poids_defaut ?? null,
      cree_par_enseignant_id: createurId,
    };
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body);
      const { typeRef, createurId } = await this.validateReferences(payload, tenantId);
      const data = this.normalizeForPersistence(payload, createurId, typeRef);

      const result = await this.prisma.evaluation.create({
        data,
        include: this.getDetailInclude(),
      });

      Response.success(res, "Evaluation creee avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de l'evaluation",
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
          req.query.orderBy ?? JSON.stringify([{ date: "desc" }, { created_at: "desc" }]),
      };

      const result = await getAllPaginated(scopedQuery as typeof req.query, this.evaluation);
      Response.success(res, "Liste des evaluations recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des evaluations",
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

      const result = await this.prisma.evaluation.findFirst({
        where: {
          id,
          cours: {
            etablissement_id: tenantId,
          },
        },
        include: this.getDetailInclude(),
      });

      if (!result) {
        throw new Error("Evaluation introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail de l'evaluation.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation de l'evaluation",
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

      const existing = await this.prisma.evaluation.findFirst({
        where: {
          id,
          cours: {
            etablissement_id: tenantId,
          },
        },
        include: {
          _count: {
            select: {
              notes: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("Evaluation introuvable pour cet etablissement.");
      }

      if (existing._count.notes > 0) {
        throw new Error(
          `Suppression impossible: cette evaluation contient deja ${existing._count.notes} note(s).`,
        );
      }

      const result = await this.evaluation.delete(id);
      Response.success(res, "Evaluation supprimee avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression de l'evaluation",
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
      const existing = await this.getScopedEvaluation(id, tenantId);

      if (!existing) {
        throw new Error("Evaluation introuvable pour cet etablissement.");
      }

      const payload = this.normalizePayload(req.body);
      const { typeRef, createurId } = await this.validateReferences(payload, tenantId);
      const data = this.normalizeForPersistence(payload, createurId, typeRef);

      const result = await this.prisma.evaluation.update({
        where: { id },
        data,
        include: this.getDetailInclude(),
      });

      Response.success(res, "Evaluation mise a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour de l'evaluation",
        400,
        error as Error,
      );
      next(error);
    }
  }
}

export default EvaluationApp;

