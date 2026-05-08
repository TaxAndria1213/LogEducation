import { Application, NextFunction, Request, Response as R, Router } from "express";
import {
  AssessmentWorkflowStatus,
  PrismaClient,
  TypeEvaluation,
  type Evaluation,
} from "@prisma/client";
import Response from "../../../common/app/response";
import EvaluationModel from "../models/evaluation.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import {
  ACTIVE_ACADEMIC_ENROLLMENT_STATUSES,
  getRequestUserId,
  getRequiredActiveAcademicYear,
} from "../../pedagogie_shared/utils/academicScope";

type EvaluationPayload = Pick<
  Evaluation,
  | "cours_id"
  | "periode_id"
  | "pedagogical_item_id"
  | "grading_scale_id"
  | "type_evaluation_id"
  | "type"
  | "titre"
  | "description"
  | "date"
  | "note_max"
  | "poids"
  | "est_publiee"
  | "status"
  | "cree_par_enseignant_id"
> & {
  include_in_average?: boolean | null;
  show_in_report_card?: boolean | null;
  is_final_exam?: boolean | null;
};

type PersistedEvaluationPayload = Omit<
  EvaluationPayload,
  "include_in_average" | "show_in_report_card" | "is_final_exam"
> & {
  include_in_average: boolean;
  show_in_report_card: boolean;
  is_final_exam: boolean;
};

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
    this.router.post("/:id/results/validate", this.validateResults.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id/display-settings", this.updateDisplaySettings.bind(this));
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
    const pedagogical_item_id =
      typeof raw.pedagogical_item_id === "string" && raw.pedagogical_item_id.trim()
        ? raw.pedagogical_item_id.trim()
        : null;
    const grading_scale_id =
      typeof raw.grading_scale_id === "string" && raw.grading_scale_id.trim()
        ? raw.grading_scale_id.trim()
        : null;
    const titre = typeof raw.titre === "string" ? raw.titre.trim().replace(/\s+/g, " ") : "";
    const description =
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim()
        : null;
    const type =
      raw.type && Object.values(TypeEvaluation).includes(raw.type)
        ? raw.type
        : TypeEvaluation.AUTRE;
    const status =
      typeof raw.status === "string" &&
      Object.values(AssessmentWorkflowStatus).includes(
        raw.status as AssessmentWorkflowStatus,
      )
        ? (raw.status as AssessmentWorkflowStatus)
        : AssessmentWorkflowStatus.DRAFT;
    const dateValue = raw.date ? new Date(raw.date) : new Date();
    const noteMaxRaw = (raw as { note_max?: unknown }).note_max;
    const poidsRaw = (raw as { poids?: unknown }).poids;
    const est_publiee = Boolean(raw.est_publiee);
    const include_in_average =
      typeof raw.include_in_average === "boolean"
        ? raw.include_in_average
        : null;
    const show_in_report_card =
      typeof raw.show_in_report_card === "boolean"
        ? raw.show_in_report_card
        : null;
    const is_final_exam =
      typeof raw.is_final_exam === "boolean" ? raw.is_final_exam : null;
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
      pedagogical_item_id,
      grading_scale_id,
      type_evaluation_id,
      type,
      titre,
      description,
      date: dateValue,
      note_max,
      poids,
      est_publiee,
      status,
      include_in_average,
      show_in_report_card,
      is_final_exam,
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
      pedagogicalItem: {
        include: {
          matiere: true,
          niveau: true,
          parent: true,
        },
      },
      gradingScale: {
        include: {
          levels: {
            orderBy: [{ display_order: "asc" as const }, { code: "asc" as const }],
          },
        },
      },
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

  private async getScopedEvaluationWithValidationContext(id: string, tenantId: string) {
    return this.prisma.evaluation.findFirst({
      where: {
        id,
        cours: {
          etablissement_id: tenantId,
        },
      },
      include: {
        cours: {
          select: {
            id: true,
            classe_id: true,
            annee_scolaire_id: true,
          },
        },
        periode: {
          select: {
            id: true,
            annee_scolaire_id: true,
          },
        },
        assessmentResults: {
          select: {
            id: true,
            student_id: true,
            is_validated: true,
          },
        },
      },
    });
  }

  private async validateReferences(payload: EvaluationPayload, tenantId: string) {
    const [cours, periode, typeRef, pedagogicalItem, gradingScale, createur] =
      await Promise.all([
      this.prisma.cours.findFirst({
        where: {
          id: payload.cours_id,
          etablissement_id: tenantId,
        },
        select: {
          id: true,
          annee_scolaire_id: true,
          enseignant_id: true,
          matiere_id: true,
          classe: {
            select: {
              niveau_scolaire_id: true,
            },
          },
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
              default_max_score: true,
              include_in_average: true,
              show_in_report_card: true,
              is_final_exam: true,
            },
          })
        : Promise.resolve(null),
      payload.pedagogical_item_id
        ? this.prisma.pedagogicalItem.findFirst({
            where: {
              id: payload.pedagogical_item_id,
              etablissement_id: tenantId,
            },
            select: {
              id: true,
              annee_scolaire_id: true,
              niveau_scolaire_id: true,
              matiere_id: true,
              is_evaluable: true,
              is_active: true,
            },
          })
        : Promise.resolve(null),
      payload.grading_scale_id
        ? this.prisma.gradingScale.findFirst({
            where: {
              id: payload.grading_scale_id,
              etablissement_id: tenantId,
            },
            select: {
              id: true,
              annee_scolaire_id: true,
              is_active: true,
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

    if (payload.pedagogical_item_id && !pedagogicalItem) {
      throw new Error("L'element pedagogique selectionne n'appartient pas a l'etablissement actif.");
    }

    if (pedagogicalItem) {
      if (!pedagogicalItem.is_active) {
        throw new Error("L'element pedagogique selectionne est inactif.");
      }

      if (!pedagogicalItem.is_evaluable) {
        throw new Error("L'element pedagogique selectionne n'est pas evaluable.");
      }

      if (pedagogicalItem.annee_scolaire_id !== cours.annee_scolaire_id) {
        throw new Error("L'element pedagogique n'appartient pas a l'annee scolaire du cours.");
      }

      if (pedagogicalItem.niveau_scolaire_id !== cours.classe.niveau_scolaire_id) {
        throw new Error("L'element pedagogique n'appartient pas au niveau scolaire du cours.");
      }

      if (pedagogicalItem.matiere_id && pedagogicalItem.matiere_id !== cours.matiere_id) {
        throw new Error("L'element pedagogique ne correspond pas a la matiere du cours.");
      }
    }

    if (payload.grading_scale_id && !gradingScale) {
      throw new Error("L'echelle de notation selectionnee n'appartient pas a l'etablissement actif.");
    }

    if (gradingScale) {
      if (!gradingScale.is_active) {
        throw new Error("L'echelle de notation selectionnee est inactive.");
      }

      if (gradingScale.annee_scolaire_id !== cours.annee_scolaire_id) {
        throw new Error("L'echelle de notation n'appartient pas a l'annee scolaire du cours.");
      }
    }

    if (payload.cree_par_enseignant_id && !createur) {
      throw new Error("L'enseignant createur n'appartient pas a l'etablissement actif.");
    }

    return {
      cours,
      typeRef,
      pedagogicalItem,
      gradingScale,
      createurId: payload.cree_par_enseignant_id ?? cours.enseignant_id,
    };
  }

  private normalizeForPersistence(
    payload: EvaluationPayload,
    createurId: string,
    typeRef?: {
      poids_defaut: number | null;
      default_max_score: number | null;
      include_in_average: boolean;
      show_in_report_card: boolean;
      is_final_exam: boolean;
    } | null,
  ): PersistedEvaluationPayload {
    const defaultConfig = typeRef
      ? {
          include_in_average: typeRef.include_in_average,
          show_in_report_card: typeRef.show_in_report_card,
          is_final_exam: typeRef.is_final_exam,
        }
      : null;

    return {
      ...payload,
      pedagogical_item_id: payload.pedagogical_item_id ?? null,
      grading_scale_id: payload.grading_scale_id ?? null,
      description: payload.description ?? null,
      note_max: payload.note_max || typeRef?.default_max_score || payload.note_max,
      poids: payload.poids ?? typeRef?.poids_defaut ?? null,
      include_in_average:
        payload.include_in_average ?? defaultConfig?.include_in_average ?? true,
      show_in_report_card:
        payload.show_in_report_card ?? defaultConfig?.show_in_report_card ?? false,
      is_final_exam:
        payload.is_final_exam ?? defaultConfig?.is_final_exam ?? false,
      cree_par_enseignant_id: createurId,
    };
  }

  private normalizeDisplaySettingsPayload(raw: Partial<EvaluationPayload>) {
    const include_in_average =
      typeof raw.include_in_average === "boolean" ? raw.include_in_average : null;
    const show_in_report_card =
      typeof raw.show_in_report_card === "boolean" ? raw.show_in_report_card : null;
    const is_final_exam =
      typeof raw.is_final_exam === "boolean" ? raw.is_final_exam : null;

    if (
      include_in_average === null &&
      show_in_report_card === null &&
      is_final_exam === null
    ) {
      throw new Error("Aucune option d'affichage ou de calcul n'a ete fournie.");
    }

    return {
      include_in_average,
      show_in_report_card,
      is_final_exam,
    };
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body);
      const { typeRef, createurId } = await this.validateReferences(payload, tenantId);
      const data = this.normalizeForPersistence(
        payload,
        createurId,
        typeRef,
      );

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
      );    }
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
      );    }
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
      );    }
  }

  private async validateResults(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;
      const actorId = getRequestUserId(req);
      const existing = await this.getScopedEvaluationWithValidationContext(id, tenantId);

      if (!existing) {
        throw new Error("Evaluation introuvable pour cet etablissement.");
      }

      if (
        existing.status === AssessmentWorkflowStatus.LOCKED ||
        existing.status === AssessmentWorkflowStatus.ARCHIVED
      ) {
        throw new Error("Cette evaluation est verrouillee et ne peut plus etre validee.");
      }

      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);

      if (
        existing.cours.annee_scolaire_id !== activeYear.id ||
        existing.periode?.annee_scolaire_id !== activeYear.id
      ) {
        throw new Error("Cette evaluation n'appartient pas a l'annee scolaire courante.");
      }

      const enrolledStudents = await this.prisma.inscription.findMany({
        where: {
          classe_id: existing.cours.classe_id,
          annee_scolaire_id: activeYear.id,
          statut: { in: [...ACTIVE_ACADEMIC_ENROLLMENT_STATUSES] },
        },
        select: {
          eleve_id: true,
        },
      });

      if (enrolledStudents.length === 0) {
        throw new Error("Aucun eleve actif n'est inscrit dans la classe de cette evaluation.");
      }

      const expectedStudentIds = new Set(enrolledStudents.map((item) => item.eleve_id));
      const enteredStudentIds = new Set(
        existing.assessmentResults
          .map((item) => item.student_id)
          .filter((studentId) => expectedStudentIds.has(studentId)),
      );

      if (enteredStudentIds.size === 0) {
        throw new Error("Impossible de valider les resultats : aucune saisie n'est disponible.");
      }

      const missingCount = [...expectedStudentIds].filter(
        (studentId) => !enteredStudentIds.has(studentId),
      ).length;

      if (missingCount > 0) {
        throw new Error(
          `Impossible de valider les resultats : ${missingCount} eleve(s) n'ont pas encore de resultat.`,
        );
      }

      const pendingValidationCount = existing.assessmentResults.filter(
        (item) => !item.is_validated,
      ).length;

      await this.prisma.$transaction(async (tx) => {
        await tx.assessmentResult.updateMany({
          where: {
            assessment_id: existing.id,
            student_id: {
              in: [...expectedStudentIds],
            },
            is_validated: false,
          },
          data: {
            is_validated: true,
            validated_at: new Date(),
            validated_by: actorId,
          },
        });

        await tx.evaluation.update({
          where: { id: existing.id },
          data: {
            status: AssessmentWorkflowStatus.VALIDATED,
          },
        });
      });

      const result = await this.prisma.evaluation.findUnique({
        where: { id: existing.id },
        include: this.getDetailInclude(),
      });

      Response.success(res, "Resultats valides avec succes.", {
        evaluation: result,
        stats: {
          expectedStudents: expectedStudentIds.size,
          validatedResults: expectedStudentIds.size,
          newlyValidatedResults: pendingValidationCount,
        },
      });
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la validation des resultats de l'evaluation",
        400,
        error as Error,
      );
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
              assessmentResults: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("Evaluation introuvable pour cet etablissement.");
      }

      const resultCount =
        (existing._count.notes ?? 0) + (existing._count.assessmentResults ?? 0);

      if (resultCount > 0) {
        throw new Error(
          `Suppression impossible: cette evaluation contient deja ${resultCount} resultat(s).`,
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
      );    }
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
      const data = this.normalizeForPersistence(
        payload,
        createurId,
        typeRef,
      );

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
      );    }
  }
  private async updateDisplaySettings(
    req: Request,
    res: R,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;
      const existing = await this.getScopedEvaluation(id, tenantId);

      if (!existing) {
        throw new Error("Evaluation introuvable pour cet etablissement.");
      }

      const payload = this.normalizeDisplaySettingsPayload(
        req.body as Partial<EvaluationPayload>,
      );

      const result = await this.prisma.evaluation.update({
        where: { id },
        data: {
          ...(payload.include_in_average !== null
            ? { include_in_average: payload.include_in_average }
            : {}),
          ...(payload.show_in_report_card !== null
            ? { show_in_report_card: payload.show_in_report_card }
            : {}),
          ...(payload.is_final_exam !== null
            ? { is_final_exam: payload.is_final_exam }
            : {}),
        },
        include: this.getDetailInclude(),
      });

      Response.success(
        res,
        "Options d'affichage de l'evaluation enregistrees avec succes.",
        result,
      );
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour des options d'affichage de l'evaluation",
        400,
        error as Error,
      );
    }
  }
}

export default EvaluationApp;

