import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type Note } from "@prisma/client";
import Response from "../../../common/app/response";
import BulletinModel from "../models/bulletin.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";

type BulletinPayload = {
  eleve_id: string;
  periode_id: string;
  publie_le?: Date | string | null;
  statut?: string | null;
};

type StudentSubjectAggregate = {
  sum: number;
  weight: number;
  comments: string[];
};

type SubjectLineInput = {
  matiere_id: string;
  moyenne: number | null;
  rang: number | null;
  commentaire_enseignant: string | null;
};

class BulletinApp {
  public app: Application;
  public router: Router;
  private bulletin: BulletinModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.bulletin = new BulletinModel();
    this.prisma = new PrismaClient();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.post("/:id/generer", this.generate.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.classe === "object" &&
      queryWhere.classe !== null &&
      typeof (queryWhere.classe as { etablissement_id?: unknown }).etablissement_id === "string"
        ? ((queryWhere.classe as { etablissement_id: string }).etablissement_id).trim()
        : undefined;

    const tenantCandidates = [requestTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour le bulletin.");
    }

    return tenantCandidates[0];
  }

  private normalizePayload(raw: Partial<BulletinPayload>): BulletinPayload {
    const eleve_id = typeof raw.eleve_id === "string" ? raw.eleve_id.trim() : "";
    const periode_id = typeof raw.periode_id === "string" ? raw.periode_id.trim() : "";

    if (!eleve_id) {
      throw new Error("L'eleve du bulletin est requis.");
    }

    if (!periode_id) {
      throw new Error("La periode du bulletin est requise.");
    }

    const publie_le = raw.publie_le ? new Date(raw.publie_le) : null;
    if (publie_le && Number.isNaN(publie_le.getTime())) {
      throw new Error("La date de publication du bulletin est invalide.");
    }

    const statut = typeof raw.statut === "string" && raw.statut.trim()
      ? raw.statut.trim().replace(/\s+/g, " ")
      : null;

    return {
      eleve_id,
      periode_id,
      publie_le,
      statut,
    };
  }

  private buildScopedWhere(
    existingWhere: Record<string, unknown>,
    tenantId: string,
  ): Record<string, unknown> {
    const scope = {
      classe: {
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
      eleve: {
        include: {
          utilisateur: {
            include: {
              profil: true,
            },
          },
        },
      },
      periode: true,
      classe: {
        include: {
          niveau: true,
          site: true,
        },
      },
      lignes: {
        include: {
          matiere: {
            include: {
              departement: true,
            },
          },
        },
      },
    };
  }

  private async getScopedBulletin(id: string, tenantId: string) {
    return this.prisma.bulletin.findFirst({
      where: {
        id,
        classe: {
          etablissement_id: tenantId,
        },
      },
    });
  }

  private async validateContext(payload: BulletinPayload, tenantId: string) {
    const [eleve, periode] = await Promise.all([
      this.prisma.eleve.findFirst({
        where: {
          id: payload.eleve_id,
          etablissement_id: tenantId,
        },
        select: { id: true },
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
        },
      }),
    ]);

    if (!eleve) {
      throw new Error("L'eleve selectionne n'appartient pas a l'etablissement actif.");
    }

    if (!periode) {
      throw new Error("La periode selectionnee n'appartient pas a l'etablissement actif.");
    }

    const inscription = await this.prisma.inscription.findFirst({
      where: {
        eleve_id: payload.eleve_id,
        annee_scolaire_id: periode.annee_scolaire_id,
      },
      include: {
        classe: true,
      },
      orderBy: [{ created_at: "desc" }],
    });

    if (!inscription?.classe || inscription.classe.etablissement_id !== tenantId) {
      throw new Error(
        "L'eleve selectionne n'a pas d'inscription valide dans l'etablissement pour l'annee de cette periode.",
      );
    }

    return {
      periode,
      inscription,
    };
  }

  private async ensureUniqueBulletin(
    eleve_id: string,
    periode_id: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.bulletin.findFirst({
      where: {
        eleve_id,
        periode_id,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Un bulletin existe deja pour cet eleve sur cette periode.");
    }
  }

  private aggregateNotesByStudentAndSubject(notes: Array<Note & {
    evaluation: {
      eleveId?: string;
      cours: {
        matiere_id: string;
      };
      note_max: number;
      poids: number | null;
    };
    eleve_id: string;
  }>) {
    const studentMap = new Map<string, Map<string, StudentSubjectAggregate>>();

    notes.forEach((note) => {
      const studentId = note.eleve_id;
      const matiereId = note.evaluation.cours.matiere_id;
      const noteMax = note.evaluation.note_max;
      const weight = note.evaluation.poids ?? 1;

      if (!matiereId || !Number.isFinite(note.score) || !Number.isFinite(noteMax) || noteMax <= 0) {
        return;
      }

      const normalizedScore = (note.score / noteMax) * 20;
      const studentSubjects = studentMap.get(studentId) ?? new Map<string, StudentSubjectAggregate>();
      const existing = studentSubjects.get(matiereId) ?? {
        sum: 0,
        weight: 0,
        comments: [],
      };

      existing.sum += normalizedScore * weight;
      existing.weight += weight;
      if (typeof note.commentaire === "string" && note.commentaire.trim()) {
        existing.comments.push(note.commentaire.trim());
      }

      studentSubjects.set(matiereId, existing);
      studentMap.set(studentId, studentSubjects);
    });

    return studentMap;
  }

  private buildBulletinLinesFromMap(
    studentMap: Map<string, Map<string, StudentSubjectAggregate>>,
    targetStudentId: string,
  ): SubjectLineInput[] {
    const targetSubjects = studentMap.get(targetStudentId) ?? new Map<string, StudentSubjectAggregate>();

    return [...targetSubjects.entries()]
      .map(([matiere_id, aggregate]) => {
        const moyenne = aggregate.weight > 0 ? Math.round((aggregate.sum / aggregate.weight) * 100) / 100 : null;
        const subjectScores = [...studentMap.entries()]
          .map(([studentId, subjects]) => {
            const subjectAggregate = subjects.get(matiere_id);
            if (!subjectAggregate || subjectAggregate.weight <= 0) {
              return null;
            }

            return {
              studentId,
              moyenne: Math.round((subjectAggregate.sum / subjectAggregate.weight) * 100) / 100,
            };
          })
          .filter((entry): entry is { studentId: string; moyenne: number } => Boolean(entry))
          .sort((left, right) => right.moyenne - left.moyenne);

        const rankIndex = moyenne === null
          ? -1
          : subjectScores.findIndex((entry) => entry.studentId === targetStudentId);

        const uniqueComments = [...new Set(aggregate.comments)].slice(0, 3);

        return {
          matiere_id,
          moyenne,
          rang: rankIndex >= 0 ? rankIndex + 1 : null,
          commentaire_enseignant: uniqueComments.length > 0 ? uniqueComments.join(" | ") : null,
        };
      })
      .sort((left, right) => (left.matiere_id > right.matiere_id ? 1 : -1));
  }

  private async buildGeneratedLines(
    eleveId: string,
    periodeId: string,
    classeId: string,
  ) {
    const classStudentIds = await this.prisma.inscription.findMany({
      where: {
        classe_id: classeId,
      },
      select: {
        eleve_id: true,
      },
    });

    const notes = await this.prisma.note.findMany({
      where: {
        eleve_id: {
          in: classStudentIds.map((item) => item.eleve_id),
        },
        evaluation: {
          periode_id: periodeId,
          cours: {
            classe_id: classeId,
          },
        },
      },
      include: {
        evaluation: {
          include: {
            cours: true,
          },
        },
      },
    });

    const studentMap = this.aggregateNotesByStudentAndSubject(
      notes as Array<Note & {
        evaluation: {
          cours: {
            matiere_id: string;
          };
          note_max: number;
          poids: number | null;
        };
        eleve_id: string;
      }>,
    );

    return this.buildBulletinLinesFromMap(studentMap, eleveId);
  }

  private async regenerateBulletinLines(
    bulletinId: string,
    eleveId: string,
    periodeId: string,
    classeId: string,
    markPublished = false,
  ) {
    const lines = await this.buildGeneratedLines(eleveId, periodeId, classeId);

    return this.prisma.$transaction(async (tx) => {
      await tx.bulletinLigne.deleteMany({
        where: { bulletin_id: bulletinId },
      });

      if (lines.length > 0) {
        await tx.bulletinLigne.createMany({
          data: lines.map((line) => ({
            bulletin_id: bulletinId,
            matiere_id: line.matiere_id,
            moyenne: line.moyenne,
            rang: line.rang,
            commentaire_enseignant: line.commentaire_enseignant,
          })),
        });
      }

      await tx.bulletin.update({
        where: { id: bulletinId },
        data: {
          statut: markPublished ? "PUBLIE" : lines.length > 0 ? "GENERE" : "EN_COURS",
          publie_le: markPublished ? new Date() : undefined,
        },
      });

      return tx.bulletin.findUnique({
        where: { id: bulletinId },
        include: this.getDetailInclude(),
      });
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body);
      const { inscription } = await this.validateContext(payload, tenantId);

      await this.ensureUniqueBulletin(payload.eleve_id, payload.periode_id);

      const bulletin = await this.prisma.bulletin.create({
        data: {
          eleve_id: payload.eleve_id,
          periode_id: payload.periode_id,
          classe_id: inscription.classe_id,
          publie_le: payload.publie_le ?? null,
          statut: payload.statut ?? "EN_COURS",
        },
      });

      const result = await this.regenerateBulletinLines(
        bulletin.id,
        payload.eleve_id,
        payload.periode_id,
        inscription.classe_id,
        Boolean(payload.publie_le) || payload.statut === "PUBLIE",
      );

      Response.success(res, "Bulletin cree avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation du bulletin",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async generate(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const bulletinId = req.params.id;

      const bulletin = await this.prisma.bulletin.findFirst({
        where: {
          id: bulletinId,
          classe: {
            etablissement_id: tenantId,
          },
        },
      });

      if (!bulletin) {
        throw new Error("Bulletin introuvable pour cet etablissement.");
      }

      const result = await this.regenerateBulletinLines(
        bulletin.id,
        bulletin.eleve_id,
        bulletin.periode_id,
        bulletin.classe_id,
        true,
      );

      Response.success(res, "Bulletin regenere avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la generation du bulletin",
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

      const result = await getAllPaginated(scopedQuery as typeof req.query, this.bulletin);
      Response.success(res, "Liste des bulletins recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des bulletins",
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

      const result = await this.prisma.bulletin.findFirst({
        where: {
          id,
          classe: {
            etablissement_id: tenantId,
          },
        },
        include: this.getDetailInclude(),
      });

      if (!result) {
        throw new Error("Bulletin introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail du bulletin.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation du bulletin",
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
      const existing = await this.getScopedBulletin(id, tenantId);

      if (!existing) {
        throw new Error("Bulletin introuvable pour cet etablissement.");
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.bulletinLigne.deleteMany({
          where: {
            bulletin_id: id,
          },
        });

        return tx.bulletin.delete({
          where: { id },
        });
      });

      Response.success(res, "Bulletin supprime avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression du bulletin",
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
      const existing = await this.getScopedBulletin(id, tenantId);

      if (!existing) {
        throw new Error("Bulletin introuvable pour cet etablissement.");
      }

      const payload = this.normalizePayload(req.body);
      const { inscription } = await this.validateContext(payload, tenantId);

      await this.ensureUniqueBulletin(payload.eleve_id, payload.periode_id, id);

      await this.prisma.bulletin.update({
        where: { id },
        data: {
          eleve_id: payload.eleve_id,
          periode_id: payload.periode_id,
          classe_id: inscription.classe_id,
          publie_le: payload.publie_le ?? null,
          statut: payload.statut ?? existing.statut ?? "EN_COURS",
        },
      });

      const result = await this.regenerateBulletinLines(
        id,
        payload.eleve_id,
        payload.periode_id,
        inscription.classe_id,
        Boolean(payload.publie_le) || payload.statut === "PUBLIE",
      );

      Response.success(res, "Bulletin mis a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour du bulletin",
        400,
        error as Error,
      );
      next(error);
    }
  }
}

export default BulletinApp;
