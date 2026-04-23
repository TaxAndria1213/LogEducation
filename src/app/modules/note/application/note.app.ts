import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type Note } from "@prisma/client";
import Response from "../../../common/app/response";
import NoteModel from "../models/note.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { assertNoAdministrativeRestriction } from "../../finance_shared/utils/recovery_restrictions";
import { prisma } from "../../../service/prisma";

type NotePayload = Pick<
  Note,
  "evaluation_id" | "eleve_id" | "score" | "commentaire" | "note_le" | "note_par"
>;

class NoteApp {
  public app: Application;
  public router: Router;
  private note: NoteModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.note = new NoteModel();
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
      typeof queryWhere?.eleve === "object" &&
      queryWhere.eleve !== null &&
      typeof (queryWhere.eleve as { etablissement_id?: unknown }).etablissement_id === "string"
        ? ((queryWhere.eleve as { etablissement_id: string }).etablissement_id).trim()
        : undefined;

    const tenantCandidates = [requestTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour la note.");
    }

    return tenantCandidates[0];
  }

  private normalizePayload(raw: Partial<Note>): NotePayload {
    const evaluation_id = typeof raw.evaluation_id === "string" ? raw.evaluation_id.trim() : "";
    const eleve_id = typeof raw.eleve_id === "string" ? raw.eleve_id.trim() : "";
    const commentaire =
      typeof raw.commentaire === "string" && raw.commentaire.trim()
        ? raw.commentaire.trim().replace(/\s+/g, " ")
        : null;
    const note_par = typeof raw.note_par === "string" && raw.note_par.trim() ? raw.note_par.trim() : null;
    const noteLeValue = raw.note_le ? new Date(raw.note_le) : new Date();
    const scoreRaw = (raw as { score?: unknown }).score;
    const score = Number(scoreRaw);

    if (!evaluation_id) {
      throw new Error("L'evaluation de la note est requise.");
    }

    if (!eleve_id) {
      throw new Error("L'eleve de la note est requis.");
    }

    if (!Number.isFinite(score) || score < 0) {
      throw new Error("Le score doit etre un nombre positif ou nul.");
    }

    if (Number.isNaN(noteLeValue.getTime())) {
      throw new Error("La date de notation est invalide.");
    }

    return {
      evaluation_id,
      eleve_id,
      score,
      commentaire,
      note_le: noteLeValue,
      note_par,
    };
  }

  private buildScopedWhere(
    existingWhere: Record<string, unknown>,
    tenantId: string,
  ): Record<string, unknown> {
    const scope = {
      eleve: {
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
      evaluation: {
        include: {
          periode: true,
          typeRef: true,
          createur: {
            include: {
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
        },
      },
      eleve: {
        include: {
          utilisateur: {
            include: {
              profil: true,
            },
          },
          inscriptions: {
            include: {
              classe: true,
            },
          },
        },
      },
    };
  }

  private async getScopedNote(id: string, tenantId: string) {
    return this.prisma.note.findFirst({
      where: {
        id,
        eleve: {
          etablissement_id: tenantId,
        },
      },
    });
  }

  private async ensureUniqueNote(payload: NotePayload, excludeId?: string) {
    const existing = await this.prisma.note.findFirst({
      where: {
        evaluation_id: payload.evaluation_id,
        eleve_id: payload.eleve_id,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Une note existe deja pour cet eleve sur cette evaluation.");
    }
  }

  private async validateReferences(payload: NotePayload, tenantId: string) {
    const [evaluation, eleve] = await Promise.all([
      this.prisma.evaluation.findFirst({
        where: {
          id: payload.evaluation_id,
          cours: {
            etablissement_id: tenantId,
          },
        },
        select:
        {
          id: true,
          type: true,
          note_max: true,
          cours: {
            select: {
              classe_id: true,
              annee_scolaire_id: true,
            },
          },
        },
      }),
      this.prisma.eleve.findFirst({
        where: {
          id: payload.eleve_id,
          etablissement_id: tenantId,
        },
        select: {
          id: true,
          inscriptions: {
            select: {
              id: true,
              classe_id: true,
              annee_scolaire_id: true,
            },
          },
        },
      }),
    ]);

    if (!evaluation) {
      throw new Error("L'evaluation selectionnee n'appartient pas a l'etablissement actif.");
    }

    if (!eleve) {
      throw new Error("L'eleve selectionne n'appartient pas a l'etablissement actif.");
    }

    if (payload.score > evaluation.note_max) {
      throw new Error(`Le score ne peut pas depasser la note maximale (${evaluation.note_max}).`);
    }

    const isRegisteredInTargetClass = eleve.inscriptions.some(
      (inscription) =>
        inscription.classe_id === evaluation.cours.classe_id &&
        inscription.annee_scolaire_id === evaluation.cours.annee_scolaire_id,
    );

    if (!isRegisteredInTargetClass) {
      throw new Error(
        "L'eleve selectionne n'est pas inscrit dans la classe de cette evaluation pour l'annee scolaire concernee.",
      );
    }

    if ((evaluation.type ?? "").toUpperCase() === "EXAMEN") {
      await assertNoAdministrativeRestriction(this.prisma, {
        tenantId,
        eleveId: payload.eleve_id,
        anneeScolaireId: evaluation.cours.annee_scolaire_id,
        type: "EXAMEN",
      });
    }
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body);

      await this.validateReferences(payload, tenantId);
      await this.ensureUniqueNote(payload);

      const result = await this.prisma.note.create({
        data: payload,
        include: this.getDetailInclude(),
      });

      Response.success(res, "Note creee avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de la note",
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
          req.query.orderBy ?? JSON.stringify([{ note_le: "desc" }, { created_at: "desc" }]),
      };

      const result = await getAllPaginated(scopedQuery as typeof req.query, this.note);
      Response.success(res, "Liste des notes recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des notes",
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

      const result = await this.prisma.note.findFirst({
        where: {
          id,
          eleve: {
            etablissement_id: tenantId,
          },
        },
        include: this.getDetailInclude(),
      });

      if (!result) {
        throw new Error("Note introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail de la note.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation de la note",
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
      const existing = await this.getScopedNote(id, tenantId);

      if (!existing) {
        throw new Error("Note introuvable pour cet etablissement.");
      }

      const result = await this.note.delete(id);
      Response.success(res, "Note supprimee avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression de la note",
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
      const existing = await this.getScopedNote(id, tenantId);

      if (!existing) {
        throw new Error("Note introuvable pour cet etablissement.");
      }

      const payload = this.normalizePayload(req.body);

      await this.validateReferences(payload, tenantId);
      await this.ensureUniqueNote(payload, id);

      const result = await this.prisma.note.update({
        where: { id },
        data: payload,
        include: this.getDetailInclude(),
      });

      Response.success(res, "Note mise a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour de la note",
        400,
        error as Error,
      );
      next(error);
    }
  }
}

export default NoteApp;





