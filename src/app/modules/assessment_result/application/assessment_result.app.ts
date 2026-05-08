import { Application, NextFunction, Request, Response as R, Router } from "express";
import {
  AssessmentResultStatus,
  GradingType,
  Prisma,
  type AssessmentResult,
  type PrismaClient,
} from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import {
  ACTIVE_ACADEMIC_ENROLLMENT_STATUSES,
  getRequestUserId,
  getRequiredActiveAcademicYear,
} from "../../pedagogie_shared/utils/academicScope";
import { assertNoAdministrativeRestriction } from "../../finance_shared/utils/recovery_restrictions";
import { prisma } from "../../../service/prisma";
import AssessmentResultModel from "../models/assessment_result.model";

type AssessmentResultPayload = {
  assessment_id: string;
  student_id: string;
  raw_score: number | null;
  scale_level_id: string | null;
  text_value: string | null;
  status: AssessmentResultStatus;
  observation: string | null;
  validated_at: Date | null;
  is_validated: boolean;
};

type TransactionClient = Prisma.TransactionClient;

class AssessmentResultApp {
  public app: Application;
  public router: Router;
  private assessmentResult: AssessmentResultModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.assessmentResult = new AssessmentResultModel();
    this.prisma = prisma;
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.get("/:id/history", this.getHistory.bind(this));
    this.router.post("/:id/validate", this.validate.bind(this));
    this.router.put("/:id", this.update.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.student === "object" &&
      queryWhere.student !== null &&
      typeof (queryWhere.student as { etablissement_id?: unknown }).etablissement_id === "string"
        ? ((queryWhere.student as { etablissement_id: string }).etablissement_id).trim()
        : undefined;

    const tenantCandidates = [requestTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour le resultat.");
    }

    return tenantCandidates[0];
  }

  private normalizePayload(raw: Partial<AssessmentResult> & Record<string, unknown>): AssessmentResultPayload {
    const assessment_id =
      typeof raw.assessment_id === "string" ? raw.assessment_id.trim() : "";
    const student_id = typeof raw.student_id === "string" ? raw.student_id.trim() : "";
    const scale_level_id =
      typeof raw.scale_level_id === "string" && raw.scale_level_id.trim()
        ? raw.scale_level_id.trim()
        : null;
    const text_value =
      typeof raw.text_value === "string" && raw.text_value.trim()
        ? raw.text_value.trim().replace(/\s+/g, " ")
        : null;
    const observation =
      typeof raw.observation === "string" && raw.observation.trim()
        ? raw.observation.trim().replace(/\s+/g, " ")
        : null;
    const rawScoreValue = raw.raw_score as unknown;
    const raw_score =
      rawScoreValue === undefined || rawScoreValue === null || rawScoreValue === ""
        ? null
        : Number(rawScoreValue);
    const normalizedStatus =
      typeof raw.status === "string" ? raw.status.trim().toUpperCase() : "GRADED";
    const status = Object.values(AssessmentResultStatus).includes(
      normalizedStatus as AssessmentResultStatus,
    )
      ? (normalizedStatus as AssessmentResultStatus)
      : AssessmentResultStatus.GRADED;
    const validatedAt =
      raw.validated_at instanceof Date
        ? raw.validated_at
        : raw.validated_at
          ? new Date(raw.validated_at as string)
          : null;

    if (!assessment_id) {
      throw new Error("L'evaluation est requise.");
    }

    if (!student_id) {
      throw new Error("L'eleve est requis.");
    }

    if (raw_score !== null && (!Number.isFinite(raw_score) || raw_score < 0)) {
      throw new Error("Le score doit etre un nombre positif ou nul.");
    }

    if (validatedAt && Number.isNaN(validatedAt.getTime())) {
      throw new Error("La date de validation est invalide.");
    }

    return {
      assessment_id,
      student_id,
      raw_score,
      scale_level_id,
      text_value,
      status,
      observation,
      validated_at: validatedAt,
      is_validated: Boolean(raw.is_validated),
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = {
      student: {
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
      assessment: {
        include: {
          periode: true,
          typeRef: true,
          pedagogicalItem: {
            include: {
              parent: true,
              matiere: true,
            },
          },
          gradingScale: {
            include: {
              levels: {
                orderBy: [{ display_order: "asc" as const }, { code: "asc" as const }],
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
            },
          },
        },
      },
      student: {
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
      scaleLevel: true,
      history: {
        orderBy: [{ changed_at: "desc" as const }],
      },
    };
  }

  private async getScopedResult(id: string, tenantId: string) {
    return this.prisma.assessmentResult.findFirst({
      where: {
        id,
        student: {
          etablissement_id: tenantId,
        },
      },
    });
  }

  private buildDisplayValue(input: {
    gradingType: GradingType;
    rawScore: number | null;
    maxScore: number | null;
    textValue: string | null;
    scaleLevel?: {
      code: string;
      label: string;
    } | null;
  }) {
    if (input.textValue?.trim()) {
      return input.textValue.trim();
    }

    if (input.scaleLevel) {
      if (input.gradingType === GradingType.LEVEL) {
        return input.scaleLevel.label?.trim() || input.scaleLevel.code;
      }
      return input.scaleLevel.code;
    }

    if (
      typeof input.rawScore === "number" &&
      Number.isFinite(input.rawScore) &&
      typeof input.maxScore === "number" &&
      Number.isFinite(input.maxScore) &&
      input.maxScore > 0
    ) {
      return `${input.rawScore}/${input.maxScore}`;
    }

    return null;
  }

  private async validateAndResolve(payload: AssessmentResultPayload, tenantId: string) {
    const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
    const [assessment, student] = await Promise.all([
      this.prisma.evaluation.findFirst({
        where: {
          id: payload.assessment_id,
          cours: {
            etablissement_id: tenantId,
            annee_scolaire_id: activeYear.id,
          },
        },
        include: {
          cours: {
            select: {
              classe_id: true,
              annee_scolaire_id: true,
            },
          },
          periode: {
            select: {
              annee_scolaire_id: true,
            },
          },
          gradingScale: {
            include: {
              levels: true,
            },
          },
        },
      }),
      this.prisma.eleve.findFirst({
        where: {
          id: payload.student_id,
          etablissement_id: tenantId,
        },
        select: {
          id: true,
          inscriptions: {
            where: {
              annee_scolaire_id: activeYear.id,
              statut: { in: [...ACTIVE_ACADEMIC_ENROLLMENT_STATUSES] },
            },
            select: {
              classe_id: true,
              annee_scolaire_id: true,
            },
          },
        },
      }),
    ]);

    if (!assessment) {
      throw new Error("L'evaluation selectionnee n'appartient pas a l'annee scolaire courante.");
    }

    if (!student) {
      throw new Error("L'eleve selectionne n'appartient pas a l'etablissement actif.");
    }

    if (
      assessment.cours.annee_scolaire_id !== activeYear.id ||
      assessment.periode?.annee_scolaire_id !== activeYear.id
    ) {
      throw new Error("L'evaluation selectionnee n'appartient pas a l'annee scolaire courante.");
    }

    const isRegisteredInTargetClass = student.inscriptions.some(
      (inscription) =>
        inscription.classe_id === assessment.cours.classe_id &&
        inscription.annee_scolaire_id === assessment.cours.annee_scolaire_id,
    );

    if (!isRegisteredInTargetClass) {
      throw new Error(
        "L'eleve selectionne n'est pas inscrit dans la classe de cette evaluation pour l'annee scolaire concernee.",
      );
    }

    if ((assessment.type ?? "").toUpperCase() === "EXAMEN") {
      await assertNoAdministrativeRestriction(this.prisma, {
        tenantId,
        eleveId: payload.student_id,
        anneeScolaireId: assessment.cours.annee_scolaire_id,
        type: "EXAMEN",
      });
    }

    const gradingType = assessment.gradingScale?.grading_type ?? GradingType.POINTS;
    const gradingBaseScore = assessment.gradingScale?.base_score ?? 20;
    const useForCalculation = assessment.gradingScale?.use_for_calculation ?? true;
    const scaleLevel = payload.scale_level_id
      ? assessment.gradingScale?.levels.find((level) => level.id === payload.scale_level_id) ?? null
      : null;

    if (
      payload.status === AssessmentResultStatus.GRADED &&
      (gradingType === GradingType.LETTER ||
        gradingType === GradingType.LEVEL ||
        gradingType === GradingType.VALIDATION) &&
      !scaleLevel
    ) {
      throw new Error("Un niveau de notation est requis pour cette evaluation.");
    }

    if (
      payload.status === AssessmentResultStatus.GRADED &&
      gradingType === GradingType.DESCRIPTIVE &&
      !payload.text_value
    ) {
      throw new Error("Une valeur descriptive est requise pour cette evaluation.");
    }

    if (
      payload.status === AssessmentResultStatus.GRADED &&
      (gradingType === GradingType.POINTS || gradingType === GradingType.PERCENTAGE)
    ) {
      if (payload.raw_score === null || !Number.isFinite(payload.raw_score)) {
        throw new Error("Le score est requis pour cette evaluation.");
      }

      if (payload.raw_score > assessment.note_max) {
        throw new Error(`Le score ne peut pas depasser la note maximale (${assessment.note_max}).`);
      }
    }

    let rawScore: number | null = null;
    let maxScore: number | null = null;
    let normalizedScore: number | null = null;
    let scaleLevelId: string | null = null;
    let textValue: string | null = null;

    if (payload.status === AssessmentResultStatus.GRADED) {
      switch (gradingType) {
        case GradingType.LETTER:
        case GradingType.LEVEL:
        case GradingType.VALIDATION:
          scaleLevelId = scaleLevel?.id ?? null;
          normalizedScore =
            useForCalculation && typeof scaleLevel?.numeric_value === "number"
              ? scaleLevel.numeric_value
              : null;
          break;
        case GradingType.DESCRIPTIVE:
          textValue = payload.text_value;
          break;
        case GradingType.PERCENTAGE:
        case GradingType.POINTS:
        default:
          rawScore = payload.raw_score;
          maxScore = assessment.note_max;
          normalizedScore =
            useForCalculation && rawScore !== null && assessment.note_max > 0
              ? (rawScore / assessment.note_max) * gradingBaseScore
              : null;
          break;
      }
    }

    const displayValue =
      payload.status === AssessmentResultStatus.GRADED
        ? this.buildDisplayValue({
            gradingType,
            rawScore,
            maxScore: maxScore ?? assessment.note_max,
            textValue,
            scaleLevel,
          })
        : payload.status;

    return {
      assessment,
      gradingType,
      gradingBaseScore,
      rawScore,
      maxScore,
      normalizedScore,
      scaleLevelId,
      textValue,
      displayValue,
    };
  }

  private async syncLegacyNote(
    tx: TransactionClient,
    input: {
      assessment: {
        id: string;
        note_max: number;
      };
      studentId: string;
      gradingType: GradingType;
      gradingBaseScore: number;
      rawScore: number | null;
      normalizedScore: number | null;
      observation: string | null;
      actorId: string | null;
      status: AssessmentResultStatus;
    },
  ) {
    const shouldPersistLegacyNote =
      input.status === AssessmentResultStatus.GRADED &&
      ((input.gradingType === GradingType.POINTS ||
        input.gradingType === GradingType.PERCENTAGE) ||
        (typeof input.normalizedScore === "number" &&
          Number.isFinite(input.normalizedScore) &&
          Math.abs(input.assessment.note_max - input.gradingBaseScore) < 0.0001));

    if (!shouldPersistLegacyNote) {
      await tx.note.deleteMany({
        where: {
          evaluation_id: input.assessment.id,
          eleve_id: input.studentId,
        },
      });
      return;
    }

    const legacyScore =
      input.gradingType === GradingType.POINTS || input.gradingType === GradingType.PERCENTAGE
        ? input.rawScore
        : input.normalizedScore;

    if (legacyScore === null || !Number.isFinite(legacyScore)) {
      await tx.note.deleteMany({
        where: {
          evaluation_id: input.assessment.id,
          eleve_id: input.studentId,
        },
      });
      return;
    }

    await tx.note.upsert({
      where: {
        evaluation_id_eleve_id: {
          evaluation_id: input.assessment.id,
          eleve_id: input.studentId,
        },
      },
      create: {
        evaluation_id: input.assessment.id,
        eleve_id: input.studentId,
        score: legacyScore,
        commentaire: input.observation,
        note_le: new Date(),
        note_par: input.actorId,
      },
      update: {
        score: legacyScore,
        commentaire: input.observation,
        note_le: new Date(),
        note_par: input.actorId,
      },
    });
  }

  private async createHistoryIfNeeded(
    tx: TransactionClient,
    existing: {
      id: string;
      raw_score: number | null;
      max_score: number | null;
      normalized_score: number | null;
      scale_level_id: string | null;
      text_value: string | null;
      display_value: string | null;
      status: AssessmentResultStatus;
    } | null,
    next: {
      rawScore: number | null;
      maxScore: number | null;
      normalizedScore: number | null;
      scaleLevelId: string | null;
      textValue: string | null;
      displayValue: string | null;
      status: AssessmentResultStatus;
    },
    actorId: string | null,
  ) {
    if (!existing) return;

    const hasChanged =
      existing.raw_score !== next.rawScore ||
      existing.max_score !== next.maxScore ||
      existing.normalized_score !== next.normalizedScore ||
      existing.scale_level_id !== next.scaleLevelId ||
      existing.text_value !== next.textValue ||
      existing.display_value !== next.displayValue ||
      existing.status !== next.status;

    if (!hasChanged) return;

    await tx.assessmentResultHistory.create({
      data: {
        assessment_result_id: existing.id,
        old_raw_score: existing.raw_score,
        new_raw_score: next.rawScore,
        old_max_score: existing.max_score,
        new_max_score: next.maxScore,
        old_normalized_score: existing.normalized_score,
        new_normalized_score: next.normalizedScore,
        old_scale_level_id: existing.scale_level_id,
        new_scale_level_id: next.scaleLevelId,
        old_text_value: existing.text_value,
        new_text_value: next.textValue,
        old_display_value: existing.display_value,
        new_display_value: next.displayValue,
        old_status: existing.status,
        new_status: next.status,
        changed_by: actorId,
      },
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body);
      const actorId = getRequestUserId(req);
      const resolved = await this.validateAndResolve(payload, tenantId);

      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.assessmentResult.findFirst({
          where: {
            assessment_id: payload.assessment_id,
            student_id: payload.student_id,
          },
          select: {
            id: true,
            raw_score: true,
            max_score: true,
            normalized_score: true,
            scale_level_id: true,
            text_value: true,
            display_value: true,
            status: true,
            is_validated: true,
          },
        });

        if (existing?.is_validated) {
          throw new Error("Ce resultat est deja valide et ne peut plus etre modifie.");
        }

        await this.createHistoryIfNeeded(
          tx,
          existing,
          {
            rawScore: resolved.rawScore,
            maxScore: resolved.maxScore,
            normalizedScore: resolved.normalizedScore,
            scaleLevelId: resolved.scaleLevelId,
            textValue: resolved.textValue,
            displayValue: resolved.displayValue,
            status: payload.status,
          },
          actorId,
        );

        const saved = await tx.assessmentResult.upsert({
          where: {
            assessment_id_student_id: {
              assessment_id: payload.assessment_id,
              student_id: payload.student_id,
            },
          },
          create: {
            assessment_id: payload.assessment_id,
            student_id: payload.student_id,
            raw_score: resolved.rawScore,
            max_score: resolved.maxScore,
            normalized_score: resolved.normalizedScore,
            scale_level_id: resolved.scaleLevelId,
            text_value: resolved.textValue,
            display_value: resolved.displayValue,
            status: payload.status,
            observation: payload.observation,
            is_validated: payload.is_validated,
            validated_at: payload.validated_at,
            validated_by: actorId,
          },
          update: {
            raw_score: resolved.rawScore,
            max_score: resolved.maxScore,
            normalized_score: resolved.normalizedScore,
            scale_level_id: resolved.scaleLevelId,
            text_value: resolved.textValue,
            display_value: resolved.displayValue,
            status: payload.status,
            observation: payload.observation,
            is_validated: payload.is_validated,
            validated_at: payload.validated_at,
            validated_by: actorId,
          },
        });

        await this.syncLegacyNote(tx, {
          assessment: {
            id: resolved.assessment.id,
            note_max: resolved.assessment.note_max,
          },
          studentId: payload.student_id,
          gradingType: resolved.gradingType,
          gradingBaseScore: resolved.gradingBaseScore,
          rawScore: resolved.rawScore,
          normalizedScore: resolved.normalizedScore,
          observation: payload.observation,
          actorId,
          status: payload.status,
        });

        return tx.assessmentResult.findUnique({
          where: { id: saved.id },
          include: this.getDetailInclude(),
        });
      });

      Response.success(res, "Resultat enregistre avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de l'enregistrement du resultat", 400, error as Error);
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
          JSON.stringify([{ updated_at: "desc" }, { created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.assessmentResult);
      Response.success(res, "Liste des resultats recuperee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des resultats", 400, error as Error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.prisma.assessmentResult.findFirst({
        where: {
          id: req.params.id,
          student: {
            etablissement_id: tenantId,
          },
        },
        include: this.getDetailInclude(),
      });

      if (!result) {
        throw new Error("Resultat introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail du resultat.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation du resultat", 404, error as Error);
    }
  }

  private async getHistory(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedResult(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Resultat introuvable pour cet etablissement.");
      }

      const result = await this.prisma.assessmentResultHistory.findMany({
        where: {
          assessment_result_id: existing.id,
        },
        orderBy: [{ changed_at: "desc" }],
      });

      Response.success(res, "Historique du resultat.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de l'historique du resultat", 404, error as Error);
    }
  }

  private async validate(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedResult(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Resultat introuvable pour cet etablissement.");
      }

      if (existing.is_validated) {
        const current = await this.prisma.assessmentResult.findUnique({
          where: { id: existing.id },
          include: this.getDetailInclude(),
        });
        Response.success(res, "Resultat deja valide.", current);
        return;
      }

      const actorId = getRequestUserId(req);
      const result = await this.prisma.assessmentResult.update({
        where: { id: existing.id },
        data: {
          is_validated: true,
          validated_at: new Date(),
          validated_by: actorId,
        },
        include: this.getDetailInclude(),
      });

      Response.success(res, "Resultat valide avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la validation du resultat", 400, error as Error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedResult(req.params.id, tenantId);
      if (!existing) {
        throw new Error("Resultat introuvable pour cet etablissement.");
      }

      if (existing.is_validated) {
        throw new Error("Ce resultat est deja valide et ne peut plus etre modifie.");
      }

      const payload = this.normalizePayload({
        ...req.body,
        assessment_id: existing.assessment_id,
        student_id: existing.student_id,
      });
      const actorId = getRequestUserId(req);
      const resolved = await this.validateAndResolve(payload, tenantId);

      const result = await this.prisma.$transaction(async (tx) => {
        await this.createHistoryIfNeeded(
          tx,
          existing,
          {
            rawScore: resolved.rawScore,
            maxScore: resolved.maxScore,
            normalizedScore: resolved.normalizedScore,
            scaleLevelId: resolved.scaleLevelId,
            textValue: resolved.textValue,
            displayValue: resolved.displayValue,
            status: payload.status,
          },
          actorId,
        );

        const saved = await tx.assessmentResult.update({
          where: { id: existing.id },
          data: {
            raw_score: resolved.rawScore,
            max_score: resolved.maxScore,
            normalized_score: resolved.normalizedScore,
            scale_level_id: resolved.scaleLevelId,
            text_value: resolved.textValue,
            display_value: resolved.displayValue,
            status: payload.status,
            observation: payload.observation,
            is_validated: payload.is_validated,
            validated_at: payload.validated_at,
            validated_by: actorId,
          },
        });

        await this.syncLegacyNote(tx, {
          assessment: {
            id: resolved.assessment.id,
            note_max: resolved.assessment.note_max,
          },
          studentId: payload.student_id,
          gradingType: resolved.gradingType,
          gradingBaseScore: resolved.gradingBaseScore,
          rawScore: resolved.rawScore,
          normalizedScore: resolved.normalizedScore,
          observation: payload.observation,
          actorId,
          status: payload.status,
        });

        return tx.assessmentResult.findUnique({
          where: { id: saved.id },
          include: this.getDetailInclude(),
        });
      });

      Response.success(res, "Resultat mis a jour avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour du resultat", 400, error as Error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedResult(req.params.id, tenantId);
      if (!existing) {
        throw new Error("Resultat introuvable pour cet etablissement.");
      }

      if (existing.is_validated) {
        throw new Error("Ce resultat est deja valide et ne peut plus etre supprime.");
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.assessmentResult.delete({
          where: { id: existing.id },
        });
        await tx.note.deleteMany({
          where: {
            evaluation_id: existing.assessment_id,
            eleve_id: existing.student_id,
          },
        });
      });

      Response.success(res, "Resultat supprime avec succes.", { id: existing.id });
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression du resultat", 400, error as Error);
    }
  }
}

export default AssessmentResultApp;
