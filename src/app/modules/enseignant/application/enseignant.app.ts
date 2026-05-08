import { Application, NextFunction, Request, Response as R, Router } from "express";
import {
  AssessmentWorkflowStatus,
  AssessmentResultStatus,
  Enseignant,
  GradingType,
  Prisma,
  TypeEvaluation,
  type PrismaClient,
} from "@prisma/client";
import Response from "../../../common/app/response";
import EnseignantModel from "../models/enseignant.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { assertNoAdministrativeRestriction } from "../../finance_shared/utils/recovery_restrictions";
import { ACTIVE_ACADEMIC_ENROLLMENT_STATUSES } from "../../pedagogie_shared/utils/academicScope";
import { prisma } from "../../../service/prisma";

type AuthenticatedRequest = Request & {
  tenantId?: string;
  user?: {
    sub?: string;
    etablissement_id?: string | null;
    role?: string[];
  };
};

type TeacherContext = {
  tenantId: string;
  userId: string;
  today: Date;
  dayStart: Date;
  dayEnd: Date;
  weekday: number;
  teacher: Awaited<ReturnType<EnseignantApp["getScopedTeacher"]>>;
  activeYear: NonNullable<Awaited<ReturnType<EnseignantApp["getActiveYear"]>>>;
};

function getDayBounds(value: Date) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  const end = new Date(value);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getWeekdayNumber(value: Date) {
  const day = value.getDay();
  return day === 0 ? 7 : day;
}

function toMinutes(value?: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function formatPersonName(profile?: { prenom?: string | null; nom?: string | null } | null) {
  return [profile?.prenom?.trim(), profile?.nom?.trim()].filter(Boolean).join(" ").trim();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => item?.trim()).filter(Boolean) as string[]));
}

const TEACHER_ACTIVE_INSCRIPTION_STATUSES = ACTIVE_ACADEMIC_ENROLLMENT_STATUSES;
type TransactionClient = Prisma.TransactionClient;

class EnseignantApp {
  public app: Application;
  public router: Router;
  private enseignant: EnseignantModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.enseignant = new EnseignantModel();
    this.prisma = prisma;
    this.routes();
  }

  public routes(): Router {
    this.router.get("/mobile/dashboard", this.getMobileDashboard.bind(this));
    this.router.get("/mobile/classes", this.getMobileClasses.bind(this));
    this.router.get("/mobile/classes/:courseId", this.getMobileClassDetail.bind(this));
    this.router.get("/mobile/courses", this.getMobileCourses.bind(this));
    this.router.get("/mobile/notes-overview", this.getMobileNotesOverview.bind(this));
    this.router.get("/mobile/evaluation-form-options", this.getMobileEvaluationFormOptions.bind(this));
    this.router.post("/mobile/evaluations", this.createMobileEvaluation.bind(this));
    this.router.get("/mobile/evaluations/:id", this.getMobileEvaluationDetail.bind(this));
    this.router.put("/mobile/evaluations/:id", this.updateMobileEvaluation.bind(this));
    this.router.delete("/mobile/evaluations/:id", this.deleteMobileEvaluation.bind(this));
    this.router.get("/mobile/evaluations/:id/grade-sheet", this.getMobileGradeSheet.bind(this));
    this.router.put("/mobile/evaluations/:id/grade-sheet", this.saveMobileGradeSheet.bind(this));
    this.router.get("/mobile/profile", this.getMobileProfile.bind(this));

    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const tenantId = (req as AuthenticatedRequest).tenantId?.trim();
    if (!tenantId) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }
    return tenantId;
  }

  private resolveUserId(req: Request): string {
    const userId = (req as AuthenticatedRequest).user?.sub?.trim();
    if (!userId) {
      throw new Error("Le compte mobile n'est pas authentifie correctement.");
    }
    return userId;
  }

  private async getScopedTeacher(userId: string, tenantId: string) {
    return this.prisma.enseignant.findFirst({
      where: {
        personnel: {
          utilisateur_id: userId,
          etablissement_id: tenantId,
        },
      },
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
    });
  }

  private async getActiveYear(tenantId: string) {
    return this.prisma.anneeScolaire.findFirst({
      where: {
        etablissement_id: tenantId,
        est_active: true,
      },
      select: {
        id: true,
        nom: true,
        date_debut: true,
        date_fin: true,
      },
    });
  }

  private async buildTeacherContext(req: Request): Promise<TeacherContext> {
    const tenantId = this.resolveTenantId(req);
    const userId = this.resolveUserId(req);
    const [teacher, activeYear] = await Promise.all([
      this.getScopedTeacher(userId, tenantId),
      this.getActiveYear(tenantId),
    ]);

    if (!teacher) {
      throw new Error("Le compte connecte n'est rattache a aucun profil enseignant actif.");
    }

    if (!activeYear) {
      throw new Error("Aucune annee scolaire courante n'est definie.");
    }

    const today = new Date();
    const { start, end } = getDayBounds(today);

    return {
      tenantId,
      userId,
      today,
      dayStart: start,
      dayEnd: end,
      weekday: getWeekdayNumber(today),
      teacher,
      activeYear,
    };
  }

  private async getTeacherCourses(context: TeacherContext) {
    return this.prisma.cours.findMany({
      where: {
        enseignant_id: context.teacher!.id,
        etablissement_id: context.tenantId,
        annee_scolaire_id: context.activeYear.id,
      },
      include: {
        classe: {
          include: {
            niveau: true,
            site: true,
            inscriptions: {
              where: {
                annee_scolaire_id: context.activeYear.id,
                statut: { in: [...TEACHER_ACTIVE_INSCRIPTION_STATUSES] },
              },
              select: {
                id: true,
                eleve_id: true,
              },
            },
          },
        },
        matiere: true,
        evaluations: {
          include: {
            notes: {
              select: {
                id: true,
                score: true,
                eleve_id: true,
              },
            },
            assessmentResults: {
              select: {
                id: true,
                student_id: true,
                normalized_score: true,
              },
            },
          },
          orderBy: {
            date: "desc",
          },
        },
        emploiDuTemps: {
          select: {
            id: true,
            heure_debut: true,
            heure_fin: true,
            creneau: {
              select: {
                heure_debut: true,
                heure_fin: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          classe: {
            nom: "asc",
          },
        },
        {
          matiere: {
            nom: "asc",
          },
        },
      ],
    });
  }

  private async getTeacherCourseMap(context: TeacherContext) {
    const courses = await this.getTeacherCourses(context);
    return new Map(courses.map((course) => [course.id, course] as const));
  }

  private async getTodaySchedule(context: TeacherContext) {
    return this.prisma.emploiDuTemps.findMany({
      where: {
        enseignant_id: context.teacher!.id,
        jour_semaine: context.weekday,
        classe: {
          etablissement_id: context.tenantId,
          annee_scolaire_id: context.activeYear.id,
        },
        effectif_du: {
          lte: context.dayEnd,
        },
        effectif_au: {
          gte: context.dayStart,
        },
      },
      include: {
        classe: {
          include: {
            niveau: true,
            site: true,
          },
        },
        matiere: true,
        creneau: true,
        salle: true,
        cours: {
          include: {
            matiere: true,
          },
        },
      },
      orderBy: [
        {
          creneau: {
            heure_debut: "asc",
          },
        },
        {
          heure_debut: "asc",
        },
      ],
    });
  }

  private buildTodayCourseItem(
    row: Awaited<ReturnType<EnseignantApp["getTodaySchedule"]>>[number],
    now: Date,
  ) {
    const startsAt = row.heure_debut?.trim() || row.creneau?.heure_debut?.trim() || "";
    const endsAt = row.heure_fin?.trim() || row.creneau?.heure_fin?.trim() || "";
    const startMinutes = toMinutes(startsAt);
    const endMinutes = toMinutes(endsAt);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const status =
      startMinutes !== null && endMinutes !== null && nowMinutes >= startMinutes && nowMinutes < endMinutes
        ? "EN_COURS"
        : startMinutes !== null && nowMinutes < startMinutes
          ? "A_VENIR"
          : "TERMINE";

    return {
      id: row.id,
      classId: row.classe_id,
      className: row.classe?.nom?.trim() || "Classe",
      levelName: row.classe?.niveau?.nom?.trim() || "Niveau",
      subjectName:
        row.cours?.matiere?.nom?.trim() ||
        row.matiere?.nom?.trim() ||
        "Cours",
      roomName: row.salle?.nom?.trim() || "Salle non renseignee",
      startTime: startsAt,
      endTime: endsAt,
      slotLabel: startsAt && endsAt ? `${startsAt} - ${endsAt}` : row.creneau?.nom?.trim() || "Creneau",
      status,
    };
  }

  private getCourseAverage(course: {
    evaluations: Array<{
      note_max: number;
      assessmentResults?: Array<{
        normalized_score: number | null;
      }>;
      notes: Array<{
        score: number;
      }>;
    }>;
  }) {
    const normalizedScores = course.evaluations.flatMap((evaluation) =>
      this.getEvaluationNormalizedScores(evaluation),
    );

    if (!normalizedScores.length) return null;

    return Math.round(
      (normalizedScores.reduce((sum, score) => sum + score, 0) / normalizedScores.length) * 100,
    ) / 100;
  }

  private getEvaluationNormalizedScores(evaluation: {
    note_max: number;
    assessmentResults?: Array<{
      normalized_score: number | null;
    }>;
    notes: Array<{
      score: number;
    }>;
  }) {
    const resultScores = (evaluation.assessmentResults ?? [])
      .map((result) => result.normalized_score)
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

    if (resultScores.length > 0) {
      return resultScores;
    }

    return evaluation.notes
      .filter((note) => typeof note.score === "number" && evaluation.note_max > 0)
      .map((note) => (note.score / evaluation.note_max) * 20);
  }

  private getStudentEvaluationNormalizedScores(
    evaluation: {
      note_max: number;
      assessmentResults?: Array<{
        student_id: string;
        normalized_score: number | null;
      }>;
      notes: Array<{
        eleve_id: string;
        score: number;
      }>;
    },
    studentId: string,
  ) {
    const resultScores = (evaluation.assessmentResults ?? [])
      .filter((result) => result.student_id === studentId)
      .map((result) => result.normalized_score)
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

    if (resultScores.length > 0) {
      return resultScores;
    }

    return evaluation.notes
      .filter(
        (note) =>
          note.eleve_id === studentId &&
          typeof note.score === "number" &&
          evaluation.note_max > 0,
      )
      .map((note) => (note.score / evaluation.note_max) * 20);
  }

  private getEvaluationEnteredCount(evaluation: {
    notes: Array<{ id: string }>;
    assessmentResults?: Array<{ id: string }>;
  }) {
    const resultCount = evaluation.assessmentResults?.length ?? 0;
    return resultCount > 0 ? resultCount : evaluation.notes.length;
  }

  private getWeeklyMinutes(course: Awaited<ReturnType<EnseignantApp["getTeacherCourses"]>>[number]) {
    return course.emploiDuTemps.reduce((total, item) => {
      const start = toMinutes(item.heure_debut ?? item.creneau?.heure_debut ?? null);
      const end = toMinutes(item.heure_fin ?? item.creneau?.heure_fin ?? null);
      if (start === null || end === null || end <= start) return total;
      return total + (end - start);
    }, 0);
  }

  private async getClassAbsenceMap(context: TeacherContext, classIds: string[]) {
    if (!classIds.length) return new Map<string, number>();

    const periodStart = new Date(context.dayStart);
    periodStart.setDate(periodStart.getDate() - 30);

    const sessions = await this.prisma.sessionAppel.findMany({
      where: {
        classe_id: {
          in: classIds,
        },
        pris_par_enseignant_id: context.teacher!.id,
        date: {
          gte: periodStart,
          lte: context.dayEnd,
        },
      },
      select: {
        classe_id: true,
        presences: {
          select: {
            statut: true,
          },
        },
      },
    });

    const absenceMap = new Map<string, number>();
    for (const session of sessions) {
      const previous = absenceMap.get(session.classe_id) ?? 0;
      const absences = session.presences.filter((presence) => presence.statut === "ABSENT").length;
      absenceMap.set(session.classe_id, previous + absences);
    }

    return absenceMap;
  }

  private async getPendingRemarkCount(
    context: TeacherContext,
    courses: Awaited<ReturnType<EnseignantApp["getTeacherCourses"]>>,
  ) {
    const subjectIds = uniqueStrings(courses.map((course) => course.matiere_id));
    if (!subjectIds.length) return 0;

    return this.prisma.bulletinLigne.count({
      where: {
        matiere_id: {
          in: subjectIds,
        },
        OR: [{ commentaire_enseignant: null }, { commentaire_enseignant: "" }],
        bulletin: {
          classe: {
            annee_scolaire_id: context.activeYear.id,
          },
        },
      },
    });
  }

  private getTeacherDisplayName(context: TeacherContext) {
    return (
      formatPersonName(context.teacher?.personnel?.utilisateur?.profil) ||
      context.teacher?.personnel?.code_personnel?.trim() ||
      "Enseignant"
    );
  }

  private normalizeEvaluationType(raw: unknown) {
    const normalized = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    return Object.values(TypeEvaluation).includes(normalized as TypeEvaluation)
      ? (normalized as TypeEvaluation)
      : TypeEvaluation.AUTRE;
  }

  private parseMobileEvaluationInput(req: Request) {
    const courseId = typeof req.body?.cours_id === "string" ? req.body.cours_id.trim() : "";
    const periodId = typeof req.body?.periode_id === "string" ? req.body.periode_id.trim() : "";
    const title = typeof req.body?.titre === "string" ? req.body.titre.trim().replace(/\s+/g, " ") : "";
    const date = req.body?.date ? new Date(req.body.date) : new Date();
    const type = this.normalizeEvaluationType(req.body?.type);
    const noteMax = Number(req.body?.note_max ?? 20);
    const publish = Boolean(req.body?.est_publiee);
    const includeInAverage =
      typeof req.body?.include_in_average === "boolean"
        ? req.body.include_in_average
        : null;
    const showInReportCard =
      typeof req.body?.show_in_report_card === "boolean"
        ? req.body.show_in_report_card
        : null;
    const isFinalExam =
      typeof req.body?.is_final_exam === "boolean"
        ? req.body.is_final_exam
        : null;
    const weightRaw = req.body?.poids;
    const weight =
      weightRaw === undefined || weightRaw === null || weightRaw === ""
        ? null
        : Number(weightRaw);
    const typeRefId =
      typeof req.body?.type_evaluation_id === "string" && req.body.type_evaluation_id.trim()
        ? req.body.type_evaluation_id.trim()
        : null;
    const pedagogicalItemId =
      typeof req.body?.pedagogical_item_id === "string" && req.body.pedagogical_item_id.trim()
        ? req.body.pedagogical_item_id.trim()
        : null;
    const gradingScaleId =
      typeof req.body?.grading_scale_id === "string" && req.body.grading_scale_id.trim()
        ? req.body.grading_scale_id.trim()
        : null;

    if (!courseId) throw new Error("Le cours est requis.");
    if (!periodId) throw new Error("La periode est requise.");
    if (!title) throw new Error("Le titre de l'evaluation est requis.");
    if (Number.isNaN(date.getTime())) throw new Error("La date de l'evaluation est invalide.");
    if (!Number.isFinite(noteMax) || noteMax <= 0) {
      throw new Error("La note maximale doit etre un nombre strictement positif.");
    }
    if (weight !== null && (!Number.isFinite(weight) || weight <= 0)) {
      throw new Error("Le poids de l'evaluation doit etre un nombre strictement positif.");
    }

    return {
      courseId,
      periodId,
      title,
      date,
      type,
      noteMax,
      publish,
      includeInAverage,
      showInReportCard,
      isFinalExam,
      weight,
      typeRefId,
      pedagogicalItemId,
      gradingScaleId,
    };
  }

  private async getScopedTeacherEvaluation(
    context: TeacherContext,
    evaluationId: string,
  ) {
    return this.prisma.evaluation.findFirst({
      where: {
        id: evaluationId,
        cours: {
          enseignant_id: context.teacher!.id,
          etablissement_id: context.tenantId,
          annee_scolaire_id: context.activeYear.id,
        },
      },
      include: {
        cours: {
          include: {
            classe: {
              include: {
                niveau: true,
                inscriptions: {
                  where: {
                    annee_scolaire_id: context.activeYear.id,
                    statut: { in: [...TEACHER_ACTIVE_INSCRIPTION_STATUSES] },
                  },
                  include: {
                    eleve: {
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
            matiere: true,
          },
        },
        periode: true,
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
        typeRef: true,
        notes: true,
        assessmentResults: {
          include: {
            scaleLevel: true,
          },
        },
      },
    });
  }

  private resolveAssessmentGradingType(evaluation: {
    gradingScale?: {
      grading_type: GradingType;
    } | null;
  }) {
    return evaluation.gradingScale?.grading_type ?? GradingType.POINTS;
  }

  private resolveAssessmentBaseScore(evaluation: {
    gradingScale?: {
      base_score: number | null;
    } | null;
  }) {
    return evaluation.gradingScale?.base_score ?? 20;
  }

  private buildAssessmentDisplayValue(input: {
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

  private async createAssessmentResultHistoryIfNeeded(
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
    actorId: string,
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

  private async getMobileDashboard(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const coursesPromise = this.getTeacherCourses(context);
      const [courses, todayRows, upcomingEvaluations, recentAbsences] = await Promise.all([
        coursesPromise,
        this.getTodaySchedule(context),
        this.prisma.evaluation.findMany({
          where: {
            cree_par_enseignant_id: context.teacher!.id,
            cours: {
              etablissement_id: context.tenantId,
              annee_scolaire_id: context.activeYear.id,
            },
            date: {
              gte: context.dayStart,
            },
          },
          take: 4,
          orderBy: {
            date: "asc",
          },
          include: {
            cours: {
              include: {
                classe: true,
                matiere: true,
              },
            },
          },
        }),
        this.prisma.presenceEleve.count({
          where: {
            statut: "ABSENT",
            session: {
              pris_par_enseignant_id: context.teacher!.id,
              date: {
                gte: new Date(context.dayStart.getTime() - 7 * 24 * 60 * 60 * 1000),
                lte: context.dayEnd,
              },
              classe: {
                annee_scolaire_id: context.activeYear.id,
              },
            },
          },
        }),
      ]);
      const pendingRemarks = await this.getPendingRemarkCount(context, courses);

      const pendingGradeSheets = courses.reduce((count, course) => {
        const studentCount = course.classe.inscriptions.length;
        return (
          count +
          course.evaluations.filter(
            (evaluation) => this.getEvaluationEnteredCount(evaluation) < studentCount,
          ).length
        );
      }, 0);

      const classCount = new Set(courses.map((course) => course.classe_id)).size;
      const todayCourses = todayRows.map((row) => this.buildTodayCourseItem(row, context.today));

      Response.success(res, "Dashboard mobile enseignant.", {
        teacher: {
          id: context.teacher!.id,
          fullName: this.getTeacherDisplayName(context),
          firstName: context.teacher?.personnel?.utilisateur?.profil?.prenom?.trim() || null,
        },
        academicYear: {
          id: context.activeYear.id,
          name: context.activeYear.nom,
        },
        todayDate: context.today.toISOString(),
        stats: {
          classCount,
          totalCourses: courses.length,
          coursesToday: todayCourses.length,
          pendingGradeSheets,
          pendingRemarks,
          unreadMessages: 0,
          recentAbsences,
        },
        todayCourses,
        upcomingEvaluations: upcomingEvaluations.map((evaluation) => ({
          id: evaluation.id,
          title: evaluation.titre?.trim() || "Evaluation",
          date: evaluation.date,
          className: evaluation.cours?.classe?.nom?.trim() || "Classe",
          subjectName: evaluation.cours?.matiere?.nom?.trim() || "Matiere",
          status: evaluation.est_publiee ? "PUBLIEE" : "BROUILLON",
        })),
      });
    } catch (error) {
      Response.error(res, "Erreur lors du chargement du dashboard mobile enseignant", 400, error as Error);
    }
  }

  private async getMobileClasses(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const courses = await this.getTeacherCourses(context);
      const absenceMap = await this.getClassAbsenceMap(
        context,
        uniqueStrings(courses.map((course) => course.classe_id)),
      );

      const items = courses.map((course) => ({
        id: course.id,
        courseId: course.id,
        classId: course.classe_id,
        className: course.classe.nom?.trim() || "Classe",
        levelName: course.classe.niveau?.nom?.trim() || "Niveau",
        siteName: course.classe.site?.nom?.trim() || null,
        subjectName: course.matiere.nom?.trim() || "Matiere",
        studentCount: course.classe.inscriptions.length,
        evaluationCount: course.evaluations.length,
        recentAbsences: absenceMap.get(course.classe_id) ?? 0,
        averageScore: this.getCourseAverage(course),
      }));

      Response.success(res, "Classes mobiles enseignant.", {
        academicYear: {
          id: context.activeYear.id,
          name: context.activeYear.nom,
        },
        items,
      });
    } catch (error) {
      Response.error(res, "Erreur lors du chargement des classes mobiles enseignant", 400, error as Error);
    }
  }

  private async getMobileClassDetail(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const courseId = typeof req.params.courseId === "string" ? req.params.courseId.trim() : "";
      if (!courseId) {
        throw new Error("Le cours enseignant est requis.");
      }

      const course = await this.prisma.cours.findFirst({
        where: {
          id: courseId,
          enseignant_id: context.teacher!.id,
          etablissement_id: context.tenantId,
          annee_scolaire_id: context.activeYear.id,
        },
        include: {
          classe: {
            include: {
              niveau: true,
              site: true,
              inscriptions: {
                where: {
                  annee_scolaire_id: context.activeYear.id,
                  statut: { in: [...TEACHER_ACTIVE_INSCRIPTION_STATUSES] },
                },
                include: {
                  eleve: {
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
          matiere: true,
          evaluations: {
            include: {
              notes: true,
              assessmentResults: {
                select: {
                  id: true,
                  student_id: true,
                  normalized_score: true,
                },
              },
            },
          },
        },
      });

      if (!course) {
        throw new Error("Cette classe n'est pas accessible depuis le compte enseignant.");
      }

      const periodStart = new Date(context.dayStart);
      periodStart.setDate(periodStart.getDate() - 30);

      const attendanceRows = await this.prisma.presenceEleve.findMany({
        where: {
          eleve_id: {
            in: course.classe.inscriptions.map((inscription) => inscription.eleve_id),
          },
          session: {
            classe_id: course.classe_id,
            pris_par_enseignant_id: context.teacher!.id,
            date: {
              gte: periodStart,
              lte: context.dayEnd,
            },
          },
        },
        select: {
          eleve_id: true,
          statut: true,
          session: {
            select: {
              date: true,
            },
          },
        },
      });

      const attendanceMap = new Map<
        string,
        {
          absences: number;
          retards: number;
          lastStatus: string | null;
          lastDate: Date | null;
        }
      >();

      for (const row of attendanceRows) {
        const previous = attendanceMap.get(row.eleve_id) ?? {
          absences: 0,
          retards: 0,
          lastStatus: null,
          lastDate: null,
        };

        const next = {
          absences: previous.absences + (row.statut === "ABSENT" ? 1 : 0),
          retards: previous.retards + (row.statut === "RETARD" ? 1 : 0),
          lastStatus:
            !previous.lastDate || row.session.date > previous.lastDate
              ? row.statut
              : previous.lastStatus,
          lastDate:
            !previous.lastDate || row.session.date > previous.lastDate
              ? row.session.date
              : previous.lastDate,
        };

        attendanceMap.set(row.eleve_id, next);
      }

      const students = course.classe.inscriptions
        .map((inscription) => {
          const normalizedScores = course.evaluations.flatMap((evaluation) =>
            this.getStudentEvaluationNormalizedScores(evaluation, inscription.eleve_id),
          );

          const average =
            normalizedScores.length > 0
              ? Math.round(
                  (normalizedScores.reduce((sum, score) => sum + score, 0) / normalizedScores.length) * 100,
                ) / 100
              : null;

          const attendance = attendanceMap.get(inscription.eleve_id);
          const profile = inscription.eleve?.utilisateur?.profil;

          return {
            eleveId: inscription.eleve_id,
            code: inscription.eleve?.code_eleve?.trim() || "",
            fullName:
              formatPersonName(profile) ||
              inscription.eleve?.code_eleve?.trim() ||
              "Eleve",
            photoUrl: profile?.photo_url?.trim() || null,
            averageScore: average,
            absences: attendance?.absences ?? 0,
            retards: attendance?.retards ?? 0,
            lastAttendanceStatus: attendance?.lastStatus ?? null,
            difficulty: average !== null && average < 10,
          };
        })
        .sort((left, right) => left.fullName.localeCompare(right.fullName, "fr"));

      Response.success(res, "Detail de classe mobile enseignant.", {
        academicYear: {
          id: context.activeYear.id,
          name: context.activeYear.nom,
        },
        class: {
          courseId: course.id,
          classId: course.classe_id,
          className: course.classe.nom?.trim() || "Classe",
          levelName: course.classe.niveau?.nom?.trim() || "Niveau",
          siteName: course.classe.site?.nom?.trim() || null,
          subjectName: course.matiere.nom?.trim() || "Matiere",
          studentCount: course.classe.inscriptions.length,
          evaluationCount: course.evaluations.length,
          averageScore: this.getCourseAverage(course),
        },
        students,
      });
    } catch (error) {
      Response.error(res, "Erreur lors du chargement du detail de classe mobile enseignant", 400, error as Error);
    }
  }

  private async getMobileCourses(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const courses = await this.getTeacherCourses(context);

      const items = courses.map((course) => {
        const studentCount = course.classe.inscriptions.length;
        const totalNotes = course.evaluations.reduce(
          (sum, evaluation) => sum + this.getEvaluationEnteredCount(evaluation),
          0,
        );
        const pendingEvaluations = course.evaluations.filter(
          (evaluation) => this.getEvaluationEnteredCount(evaluation) < studentCount,
        ).length;
        const weeklyMinutes = this.getWeeklyMinutes(course);
        const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;

        return {
          id: course.id,
          classId: course.classe_id,
          className: course.classe.nom?.trim() || "Classe",
          levelName: course.classe.niveau?.nom?.trim() || "Niveau",
          subjectName: course.matiere.nom?.trim() || "Matiere",
          coefficient: course.coefficient_override ?? null,
          weeklyHours,
          evaluationCount: course.evaluations.length,
          totalNotes,
          pendingEvaluations,
          averageScore: this.getCourseAverage(course),
          progressionPercent: null,
        };
      });

      Response.success(res, "Cours mobiles enseignant.", {
        academicYear: {
          id: context.activeYear.id,
          name: context.activeYear.nom,
        },
        items,
      });
    } catch (error) {
      Response.error(res, "Erreur lors du chargement des cours mobiles enseignant", 400, error as Error);
    }
  }

  private async getMobileNotesOverview(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const courses = await this.getTeacherCourses(context);

      const items = courses.flatMap((course) =>
        course.evaluations.map((evaluation) => {
          const studentCount = course.classe.inscriptions.length;
          const enteredCount = this.getEvaluationEnteredCount(evaluation);
          const completionRate =
            studentCount > 0
              ? Math.round((enteredCount / studentCount) * 100)
              : 0;

          return {
            id: evaluation.id,
            title: evaluation.titre?.trim() || "Evaluation",
            date: evaluation.date,
            className: course.classe.nom?.trim() || "Classe",
            subjectName: course.matiere.nom?.trim() || "Matiere",
            noteMax: evaluation.note_max,
            enteredNotes: enteredCount,
            expectedNotes: studentCount,
            completionRate,
            status:
              enteredCount >= studentCount
                ? "COMPLET"
                : evaluation.est_publiee
                  ? "EN_SAISIE"
                  : "BROUILLON",
          };
        }),
      );

      const sorted = items.sort(
        (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
      );

      Response.success(res, "Vue notes mobile enseignant.", {
        academicYear: {
          id: context.activeYear.id,
          name: context.activeYear.nom,
        },
        stats: {
          totalCourses: courses.length,
          totalEvaluations: sorted.length,
          pendingEvaluations: sorted.filter((item) => item.completionRate < 100).length,
          completedEvaluations: sorted.filter((item) => item.completionRate >= 100).length,
        },
        items: sorted,
      });
    } catch (error) {
      Response.error(res, "Erreur lors du chargement de la vue notes mobile enseignant", 400, error as Error);
    }
  }

  private async getMobileEvaluationFormOptions(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const [courses, periods, typeRefs, pedagogicalItems, gradingScales] = await Promise.all([
        this.getTeacherCourses(context),
        this.prisma.periode.findMany({
          where: {
            annee_scolaire_id: context.activeYear.id,
          },
          orderBy: [{ ordre: "asc" }, { date_debut: "asc" }],
          select: {
            id: true,
            nom: true,
            date_debut: true,
            date_fin: true,
          },
        }),
        this.prisma.typeEvaluationRef.findMany({
          where: {
            etablissement_id: context.tenantId,
          },
          orderBy: {
            nom: "asc",
          },
            select: {
              id: true,
              nom: true,
              poids_defaut: true,
              default_max_score: true,
              include_in_average: true,
              show_in_report_card: true,
              is_final_exam: true,
            },
          }),
        this.prisma.pedagogicalItem.findMany({
          where: {
            etablissement_id: context.tenantId,
            annee_scolaire_id: context.activeYear.id,
            is_active: true,
            is_evaluable: true,
          },
          orderBy: [{ display_order: "asc" }, { nom: "asc" }],
          select: {
            id: true,
            nom: true,
            item_type: true,
            niveau_scolaire_id: true,
            matiere_id: true,
            parent_id: true,
            parent: {
              select: {
                id: true,
                nom: true,
              },
            },
          },
        }),
        this.prisma.gradingScale.findMany({
          where: {
            etablissement_id: context.tenantId,
            annee_scolaire_id: context.activeYear.id,
            is_active: true,
          },
          orderBy: [{ is_default: "desc" }, { nom: "asc" }],
          select: {
            id: true,
            nom: true,
            grading_type: true,
            base_score: true,
            use_for_calculation: true,
            allow_decimal: true,
            is_default: true,
          },
        }),
      ]);

      Response.success(res, "Options du formulaire d'evaluation mobile enseignant.", {
        academicYear: {
          id: context.activeYear.id,
          name: context.activeYear.nom,
        },
        courses: courses.map((course) => ({
          id: course.id,
          levelId: course.classe.niveau_scolaire_id,
          subjectId: course.matiere_id,
          className: course.classe.nom?.trim() || "Classe",
          levelName: course.classe.niveau?.nom?.trim() || "Niveau",
          subjectName: course.matiere.nom?.trim() || "Matiere",
        })),
        periods,
        typeOptions: Object.values(TypeEvaluation).map((item) => ({
          value: item,
          label: item,
        })),
        typeReferences: typeRefs,
        pedagogicalItems,
        gradingScales,
      });
    } catch (error) {
      Response.error(res, "Erreur lors du chargement des options d'evaluation mobile enseignant", 400, error as Error);
    }
  }

  private async createMobileEvaluation(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const {
        courseId,
        periodId,
        title,
        date,
        type,
        noteMax,
        publish,
        includeInAverage,
        showInReportCard,
        isFinalExam,
        weight,
        typeRefId,
        pedagogicalItemId,
        gradingScaleId,
      } =
        this.parseMobileEvaluationInput(req);

      const courseMap = await this.getTeacherCourseMap(context);
      const course = courseMap.get(courseId);
      if (!course) {
        throw new Error("Ce cours n'est pas accessible depuis le compte enseignant.");
      }

      const [period, typeRef, pedagogicalItem, gradingScale] = await Promise.all([
        this.prisma.periode.findFirst({
          where: {
            id: periodId,
            annee_scolaire_id: context.activeYear.id,
          },
          select: {
            id: true,
            date_debut: true,
            date_fin: true,
          },
        }),
        typeRefId
          ? this.prisma.typeEvaluationRef.findFirst({
              where: {
                id: typeRefId,
                etablissement_id: context.tenantId,
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
        pedagogicalItemId
          ? this.prisma.pedagogicalItem.findFirst({
              where: {
                id: pedagogicalItemId,
                etablissement_id: context.tenantId,
                annee_scolaire_id: context.activeYear.id,
                niveau_scolaire_id: course.classe.niveau_scolaire_id,
                is_active: true,
                is_evaluable: true,
              },
              select: {
                id: true,
                matiere_id: true,
              },
            })
          : Promise.resolve(null),
        gradingScaleId
          ? this.prisma.gradingScale.findFirst({
              where: {
                id: gradingScaleId,
                etablissement_id: context.tenantId,
                annee_scolaire_id: context.activeYear.id,
                is_active: true,
              },
              select: {
                id: true,
              },
            })
          : Promise.resolve(null),
      ]);

      if (!period) {
        throw new Error("La periode selectionnee n'appartient pas a l'annee scolaire courante.");
      }

      if (date < period.date_debut || date > period.date_fin) {
        throw new Error("La date de l'evaluation doit se situer dans la periode selectionnee.");
      }

      if (typeRefId && !typeRef) {
        throw new Error("Le type d'evaluation reference est invalide.");
      }

      if (pedagogicalItemId && !pedagogicalItem) {
        throw new Error("L'element pedagogique selectionne est invalide pour ce cours.");
      }

      if (pedagogicalItem?.matiere_id && pedagogicalItem.matiere_id !== course.matiere_id) {
        throw new Error("L'element pedagogique ne correspond pas a la matiere du cours.");
      }

      if (gradingScaleId && !gradingScale) {
        throw new Error("L'echelle de notation selectionnee est invalide.");
      }

      const created = await this.prisma.evaluation.create({
        data: {
          cours_id: course.id,
          periode_id: period.id,
          titre: title,
          date,
          type,
          note_max: noteMax || typeRef?.default_max_score || 20,
          poids: weight ?? typeRef?.poids_defaut ?? null,
          est_publiee: publish,
          include_in_average: includeInAverage ?? typeRef?.include_in_average ?? true,
          show_in_report_card: showInReportCard ?? typeRef?.show_in_report_card ?? type === "EXAMEN",
          is_final_exam: isFinalExam ?? typeRef?.is_final_exam ?? type === "EXAMEN",
          pedagogical_item_id: pedagogicalItem?.id ?? null,
          grading_scale_id: gradingScale?.id ?? null,
          type_evaluation_id: typeRef?.id ?? null,
          cree_par_enseignant_id: context.teacher!.id,
        },
        include: {
          cours: {
            include: {
              classe: true,
              matiere: true,
            },
          },
          periode: true,
        },
      });

      Response.success(res, "Evaluation enseignant creee avec succes.", {
        id: created.id,
        title: created.titre,
        date: created.date,
        className: created.cours.classe?.nom?.trim() || "Classe",
        subjectName: created.cours.matiere?.nom?.trim() || "Matiere",
        noteMax: created.note_max,
        includeInAverage: created.include_in_average,
        showInReportCard: created.show_in_report_card,
        isFinalExam: created.is_final_exam,
        pedagogicalItemId: created.pedagogical_item_id,
        gradingScaleId: created.grading_scale_id,
      });
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de l'evaluation mobile enseignant", 400, error as Error);
    }
  }

  private async getMobileEvaluationDetail(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const evaluation = await this.getScopedTeacherEvaluation(context, req.params.id);

      if (!evaluation) {
        throw new Error("Cette evaluation n'est pas accessible depuis le compte enseignant.");
      }

      Response.success(res, "Detail evaluation mobile enseignant.", {
        id: evaluation.id,
        cours_id: evaluation.cours_id,
        periode_id: evaluation.periode_id,
        pedagogical_item_id: evaluation.pedagogical_item_id,
        grading_scale_id: evaluation.grading_scale_id,
        titre: evaluation.titre,
        date: evaluation.date.toISOString(),
        type: evaluation.type,
        note_max: evaluation.note_max,
        poids: evaluation.poids,
        est_publiee: evaluation.est_publiee,
        include_in_average: evaluation.include_in_average,
        show_in_report_card: evaluation.show_in_report_card,
        is_final_exam: evaluation.is_final_exam,
        type_evaluation_id: evaluation.type_evaluation_id,
        className: evaluation.cours.classe.nom?.trim() || "Classe",
        subjectName: evaluation.cours.matiere.nom?.trim() || "Matiere",
      });
    } catch (error) {
      Response.error(res, "Erreur lors du chargement du detail d'evaluation mobile enseignant", 400, error as Error);
    }
  }

  private async updateMobileEvaluation(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const existing = await this.getScopedTeacherEvaluation(context, req.params.id);

      if (!existing) {
        throw new Error("Cette evaluation n'est pas accessible depuis le compte enseignant.");
      }

      const {
        courseId,
        periodId,
        title,
        date,
        type,
        noteMax,
        publish,
        includeInAverage,
        showInReportCard,
        isFinalExam,
        weight,
        typeRefId,
        pedagogicalItemId,
        gradingScaleId,
      } =
        this.parseMobileEvaluationInput(req);

      const courseMap = await this.getTeacherCourseMap(context);
      const course = courseMap.get(courseId);
      if (!course) {
        throw new Error("Ce cours n'est pas accessible depuis le compte enseignant.");
      }

      const [period, typeRef, pedagogicalItem, gradingScale] = await Promise.all([
        this.prisma.periode.findFirst({
          where: {
            id: periodId,
            annee_scolaire_id: context.activeYear.id,
          },
          select: {
            id: true,
            date_debut: true,
            date_fin: true,
          },
        }),
        typeRefId
          ? this.prisma.typeEvaluationRef.findFirst({
              where: {
                id: typeRefId,
                etablissement_id: context.tenantId,
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
        pedagogicalItemId
          ? this.prisma.pedagogicalItem.findFirst({
              where: {
                id: pedagogicalItemId,
                etablissement_id: context.tenantId,
                annee_scolaire_id: context.activeYear.id,
                niveau_scolaire_id: course.classe.niveau_scolaire_id,
                is_active: true,
                is_evaluable: true,
              },
              select: {
                id: true,
                matiere_id: true,
              },
            })
          : Promise.resolve(null),
        gradingScaleId
          ? this.prisma.gradingScale.findFirst({
              where: {
                id: gradingScaleId,
                etablissement_id: context.tenantId,
                annee_scolaire_id: context.activeYear.id,
                is_active: true,
              },
              select: {
                id: true,
              },
            })
          : Promise.resolve(null),
      ]);

      if (!period) {
        throw new Error("La periode selectionnee n'appartient pas a l'annee scolaire courante.");
      }

      if (date < period.date_debut || date > period.date_fin) {
        throw new Error("La date de l'evaluation doit se situer dans la periode selectionnee.");
      }

      if (typeRefId && !typeRef) {
        throw new Error("Le type d'evaluation reference est invalide.");
      }

      if (pedagogicalItemId && !pedagogicalItem) {
        throw new Error("L'element pedagogique selectionne est invalide pour ce cours.");
      }

      if (pedagogicalItem?.matiere_id && pedagogicalItem.matiere_id !== course.matiere_id) {
        throw new Error("L'element pedagogique ne correspond pas a la matiere du cours.");
      }

      if (gradingScaleId && !gradingScale) {
        throw new Error("L'echelle de notation selectionnee est invalide.");
      }

      const updated = await this.prisma.evaluation.update({
        where: { id: existing.id },
        data: {
          cours_id: course.id,
          periode_id: period.id,
          titre: title,
          date,
          type,
          note_max: noteMax || typeRef?.default_max_score || 20,
          poids: weight ?? typeRef?.poids_defaut ?? null,
          est_publiee: publish,
          include_in_average: includeInAverage ?? typeRef?.include_in_average ?? true,
          show_in_report_card: showInReportCard ?? typeRef?.show_in_report_card ?? type === "EXAMEN",
          is_final_exam: isFinalExam ?? typeRef?.is_final_exam ?? type === "EXAMEN",
          pedagogical_item_id: pedagogicalItem?.id ?? null,
          grading_scale_id: gradingScale?.id ?? null,
          type_evaluation_id: typeRef?.id ?? null,
        },
      });

      Response.success(res, "Evaluation enseignant mise a jour avec succes.", {
        id: updated.id,
      });
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de l'evaluation mobile enseignant", 400, error as Error);
    }
  }

  private async deleteMobileEvaluation(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const existing = await this.getScopedTeacherEvaluation(context, req.params.id);

      if (!existing) {
        throw new Error("Cette evaluation n'est pas accessible depuis le compte enseignant.");
      }

      const resultCount = existing.notes.length + existing.assessmentResults.length;

      if (resultCount > 0) {
        throw new Error(
          `Suppression impossible: cette evaluation contient deja ${resultCount} resultat(s).`,
        );
      }

      await this.prisma.evaluation.delete({
        where: { id: existing.id },
      });

      Response.success(res, "Evaluation enseignant supprimee avec succes.", {
        id: existing.id,
      });
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de l'evaluation mobile enseignant", 400, error as Error);
    }
  }

  private async getMobileGradeSheet(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const evaluation = await this.getScopedTeacherEvaluation(context, req.params.id);

      if (!evaluation) {
        throw new Error("Cette evaluation n'est pas accessible depuis le compte enseignant.");
      }

      const noteMap = new Map(evaluation.notes.map((note) => [note.eleve_id, note]));
      const resultMap = new Map(
        evaluation.assessmentResults.map((result) => [result.student_id, result]),
      );
      const gradingType = this.resolveAssessmentGradingType(evaluation);
      const gradingBaseScore = this.resolveAssessmentBaseScore(evaluation);
      const students = evaluation.cours.classe.inscriptions
        .map((inscription) => {
          const note = noteMap.get(inscription.eleve_id);
          const result = resultMap.get(inscription.eleve_id);
          return {
            eleveId: inscription.eleve_id,
            inscriptionId: inscription.id,
            noteId: note?.id ?? null,
            resultId: result?.id ?? null,
            fullName:
              formatPersonName(inscription.eleve?.utilisateur?.profil) ||
              inscription.eleve?.code_eleve?.trim() ||
              "Eleve",
            code: inscription.eleve?.code_eleve?.trim() || "",
            score:
              typeof result?.raw_score === "number"
                ? result.raw_score
                : typeof note?.score === "number"
                  ? note.score
                  : null,
            status: result?.status ?? AssessmentResultStatus.NOT_EVALUATED,
            scaleLevelId: result?.scale_level_id ?? null,
            textValue: result?.text_value ?? "",
            displayValue:
              result?.display_value ??
              this.buildAssessmentDisplayValue({
                gradingType,
                rawScore: typeof note?.score === "number" ? note.score : null,
                maxScore: evaluation.note_max,
                textValue: null,
                scaleLevel: null,
              }) ??
              "",
            comment: result?.observation ?? note?.commentaire ?? "",
          };
        })
        .sort((left, right) => left.fullName.localeCompare(right.fullName, "fr"));

      Response.success(res, "Feuille de notes mobile enseignant.", {
        evaluation: {
          id: evaluation.id,
          title: evaluation.titre,
          date: evaluation.date,
          noteMax: evaluation.note_max,
          status: evaluation.est_publiee ? "PUBLIEE" : "BROUILLON",
          workflowStatus: evaluation.status,
          gradingScaleId: evaluation.grading_scale_id,
          gradingScaleName: evaluation.gradingScale?.nom ?? null,
          gradingType,
          gradingBaseScore,
          gradingLevels: (evaluation.gradingScale?.levels ?? []).map((level) => ({
            id: level.id,
            code: level.code,
            label: level.label,
            color: level.color ?? null,
            numericValue: level.numeric_value ?? null,
          })),
          periodName: evaluation.periode?.nom?.trim() || "Periode",
          className: evaluation.cours.classe.nom?.trim() || "Classe",
          levelName: evaluation.cours.classe.niveau?.nom?.trim() || "Niveau",
          subjectName: evaluation.cours.matiere.nom?.trim() || "Matiere",
        },
        students,
      });
    } catch (error) {
      Response.error(res, "Erreur lors du chargement de la feuille de notes mobile enseignant", 400, error as Error);
    }
  }

  private async saveMobileGradeSheet(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const evaluation = await this.getScopedTeacherEvaluation(context, req.params.id);

      if (!evaluation) {
        throw new Error("Cette evaluation n'est pas accessible depuis le compte enseignant.");
      }

      if (
        evaluation.status === AssessmentWorkflowStatus.VALIDATED ||
        evaluation.status === AssessmentWorkflowStatus.LOCKED ||
        evaluation.status === AssessmentWorkflowStatus.ARCHIVED
      ) {
        throw new Error(
          "Cette evaluation est deja validee ou verrouillee et ne peut plus etre modifiee.",
        );
      }

      const rawRows = Array.isArray(req.body?.students) ? req.body.students : [];
      if (!rawRows.length) {
        throw new Error("Aucune note n'a ete fournie.");
      }

      const gradingType = this.resolveAssessmentGradingType(evaluation);
      const gradingBaseScore = this.resolveAssessmentBaseScore(evaluation);
      const useForCalculation = evaluation.gradingScale?.use_for_calculation ?? true;
      const gradingLevels = new Map(
        (evaluation.gradingScale?.levels ?? []).map((level) => [level.id, level] as const),
      );
      const existingResultMap = new Map(
        evaluation.assessmentResults.map((result) => [result.student_id, result] as const),
      );
      const enrolledStudents = new Map(
        evaluation.cours.classe.inscriptions.map((inscription) => [inscription.eleve_id, inscription]),
      );

      if ((evaluation.type ?? "").toUpperCase() === "EXAMEN") {
        for (const row of rawRows) {
          const eleveId = typeof row?.eleveId === "string" ? row.eleveId.trim() : "";
          const scoreRaw = row?.score;
          const scaleLevelId =
            typeof row?.scaleLevelId === "string" && row.scaleLevelId.trim()
              ? row.scaleLevelId.trim()
              : null;
          const textValue =
            typeof row?.textValue === "string" && row.textValue.trim()
              ? row.textValue.trim()
              : null;
          const hasScore = !(
            scoreRaw === undefined ||
            scoreRaw === null ||
            scoreRaw === ""
          );
          const hasAnyValue = hasScore || Boolean(scaleLevelId) || Boolean(textValue);

          if (!eleveId || !hasAnyValue) {
            continue;
          }

          await assertNoAdministrativeRestriction(this.prisma, {
            tenantId: context.tenantId,
            eleveId,
            anneeScolaireId: context.activeYear.id,
            type: "EXAMEN",
          });
        }
      }

      await this.prisma.$transaction(async (tx) => {
        for (const row of rawRows) {
          const eleveId = typeof row?.eleveId === "string" ? row.eleveId.trim() : "";
          if (!eleveId) {
            throw new Error("Chaque ligne de note doit contenir un eleve.");
          }

          if (!enrolledStudents.has(eleveId)) {
            throw new Error("Un eleve de la feuille n'appartient pas a cette classe.");
          }

          const scoreRaw = row?.score;
          const score =
            scoreRaw === undefined || scoreRaw === null || scoreRaw === ""
              ? null
              : Number(scoreRaw);
          const statusRaw =
            typeof row?.status === "string" && row.status.trim()
              ? row.status.trim().toUpperCase()
              : AssessmentResultStatus.GRADED;
          const status = Object.values(AssessmentResultStatus).includes(
            statusRaw as AssessmentResultStatus,
          )
            ? (statusRaw as AssessmentResultStatus)
            : AssessmentResultStatus.GRADED;
          const scaleLevelId =
            typeof row?.scaleLevelId === "string" && row.scaleLevelId.trim()
              ? row.scaleLevelId.trim()
              : null;
          const textValue =
            typeof row?.textValue === "string" && row.textValue.trim()
              ? row.textValue.trim()
              : null;
          const scaleLevel = scaleLevelId ? gradingLevels.get(scaleLevelId) ?? null : null;

          const comment =
            typeof row?.comment === "string" && row.comment.trim()
              ? row.comment.trim().replace(/\s+/g, " ")
              : null;

          const hasAnyValue =
            (typeof score === "number" && Number.isFinite(score)) ||
            Boolean(scaleLevelId) ||
            Boolean(textValue) ||
            status !== AssessmentResultStatus.GRADED ||
            Boolean(comment);

          if (!hasAnyValue) {
            await tx.assessmentResult.deleteMany({
              where: {
                assessment_id: evaluation.id,
                student_id: eleveId,
              },
            });
            await tx.note.deleteMany({
              where: {
                evaluation_id: evaluation.id,
                eleve_id: eleveId,
              },
            });
            continue;
          }

          let rawScore: number | null = null;
          let maxScore: number | null = null;
          let normalizedScore: number | null = null;
          let persistedScaleLevelId: string | null = null;
          let persistedTextValue: string | null = null;

          switch (gradingType) {
            case GradingType.LETTER:
            case GradingType.LEVEL:
            case GradingType.VALIDATION: {
              if (status === AssessmentResultStatus.GRADED) {
                if (!scaleLevel) {
                  throw new Error("Un niveau de notation est requis pour cette evaluation.");
                }
                persistedScaleLevelId = scaleLevel.id;
                normalizedScore =
                  useForCalculation && typeof scaleLevel.numeric_value === "number"
                    ? scaleLevel.numeric_value
                    : null;
              }
              break;
            }
            case GradingType.DESCRIPTIVE: {
              if (status === AssessmentResultStatus.GRADED) {
                if (!textValue) {
                  throw new Error("Une valeur descriptive est requise pour cette evaluation.");
                }
                persistedTextValue = textValue;
              }
              break;
            }
            case GradingType.PERCENTAGE:
            case GradingType.POINTS:
            default: {
              if (status === AssessmentResultStatus.GRADED) {
                if (score === null || !Number.isFinite(score) || score < 0) {
                  throw new Error("Chaque score doit etre un nombre positif ou nul.");
                }
                if (score > evaluation.note_max) {
                  throw new Error(
                    `Le score ne peut pas depasser la note maximale (${evaluation.note_max}).`,
                  );
                }
                rawScore = score;
                maxScore = evaluation.note_max;
                normalizedScore =
                  useForCalculation && evaluation.note_max > 0
                    ? (score / evaluation.note_max) * gradingBaseScore
                    : null;
              }
              break;
            }
          }

          const displayValue =
            status === AssessmentResultStatus.GRADED
              ? this.buildAssessmentDisplayValue({
                  gradingType,
                  rawScore,
                  maxScore: maxScore ?? evaluation.note_max,
                  textValue: persistedTextValue,
                  scaleLevel,
                })
              : status;

          await this.createAssessmentResultHistoryIfNeeded(
            tx,
            existingResultMap.get(eleveId) ?? null,
            {
              rawScore,
              maxScore,
              normalizedScore,
              scaleLevelId: persistedScaleLevelId,
              textValue: persistedTextValue,
              displayValue,
              status,
            },
            context.userId,
          );

          await tx.assessmentResult.upsert({
            where: {
              assessment_id_student_id: {
                assessment_id: evaluation.id,
                student_id: eleveId,
              },
            },
            create: {
              assessment_id: evaluation.id,
              student_id: eleveId,
              raw_score: rawScore,
              max_score: maxScore,
              normalized_score: normalizedScore,
              scale_level_id: persistedScaleLevelId,
              text_value: persistedTextValue,
              display_value: displayValue,
              status,
              observation: comment,
            },
            update: {
              raw_score: rawScore,
              max_score: maxScore,
              normalized_score: normalizedScore,
              scale_level_id: persistedScaleLevelId,
              text_value: persistedTextValue,
              display_value: displayValue,
              status,
              observation: comment,
            },
          });

          const shouldPersistLegacyNote =
            status === AssessmentResultStatus.GRADED &&
            ((gradingType === GradingType.POINTS || gradingType === GradingType.PERCENTAGE) ||
              (typeof normalizedScore === "number" &&
                Number.isFinite(normalizedScore) &&
                Math.abs(evaluation.note_max - gradingBaseScore) < 0.0001));

          if (!shouldPersistLegacyNote) {
            await tx.note.deleteMany({
              where: {
                evaluation_id: evaluation.id,
                eleve_id: eleveId,
              },
            });
            continue;
          }

          const legacyScore =
            gradingType === GradingType.POINTS || gradingType === GradingType.PERCENTAGE
              ? rawScore
              : normalizedScore;

          if (legacyScore === null || !Number.isFinite(legacyScore)) {
            await tx.note.deleteMany({
              where: {
                evaluation_id: evaluation.id,
                eleve_id: eleveId,
              },
            });
            continue;
          }

          await tx.note.upsert({
            where: {
              evaluation_id_eleve_id: {
                evaluation_id: evaluation.id,
                eleve_id: eleveId,
              },
            },
            create: {
              evaluation_id: evaluation.id,
              eleve_id: eleveId,
              score: legacyScore,
              commentaire: comment,
              note_le: new Date(),
              note_par: context.userId,
            },
            update: {
              score: legacyScore,
              commentaire: comment,
              note_le: new Date(),
              note_par: context.userId,
            },
          });
        }
      });

      const refreshed = await this.getScopedTeacherEvaluation(context, evaluation.id);
      const enteredNotes = refreshed ? this.getEvaluationEnteredCount(refreshed) : 0;
      const expectedNotes = refreshed?.cours.classe.inscriptions.length ?? 0;

      Response.success(res, "Feuille de notes mobile enseignant enregistree.", {
        evaluationId: evaluation.id,
        enteredNotes,
        expectedNotes,
        completionRate: expectedNotes > 0 ? Math.round((enteredNotes / expectedNotes) * 100) : 0,
      });
    } catch (error) {
      Response.error(res, "Erreur lors de l'enregistrement de la feuille de notes mobile enseignant", 400, error as Error);
    }
  }

  private async getMobileProfile(req: Request, res: R): Promise<void> {
    try {
      const context = await this.buildTeacherContext(req);
      const courses = await this.getTeacherCourses(context);

      const profile = context.teacher?.personnel?.utilisateur?.profil;
      const subjects = uniqueStrings(courses.map((course) => course.matiere.nom));
      const classes = uniqueStrings(courses.map((course) => course.classe.nom));

      Response.success(res, "Profil mobile enseignant.", {
        id: context.teacher!.id,
        fullName: this.getTeacherDisplayName(context),
        matricule: context.teacher?.personnel?.code_personnel?.trim() || null,
        email: context.teacher?.personnel?.utilisateur?.email?.trim() || null,
        telephone: context.teacher?.personnel?.utilisateur?.telephone?.trim() || null,
        address: profile?.adresse?.trim() || null,
        photoUrl: profile?.photo_url?.trim() || null,
        specialty: context.teacher?.departement?.nom?.trim() || null,
        academicYearName: context.activeYear.nom,
        subjects,
        classes,
      });
    } catch (error) {
      Response.error(res, "Erreur lors du chargement du profil mobile enseignant", 400, error as Error);
    }
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const data: Enseignant = req.body;
      const result = await this.enseignant.create(data);
      Response.success(res, "Enseignant cree.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de l'enseignant", 400, error as Error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const result = await getAllPaginated(req.query, this.enseignant);
      Response.success(res, "Liste des enseignants.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des enseignants", 400, error as Error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const result = await this.enseignant.findUnique(id);
      Response.success(res, "Detail enseignant.", result);
    } catch (error) {
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const result = await this.enseignant.delete(id);
      Response.success(res, "Enseignant supprime.", result);
    } catch (error) {
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const data: Enseignant = req.body;
      const result = await this.enseignant.update(id, data);
      Response.success(res, "Enseignant mis a jour.", result);
    } catch (error) {
      next(error);
    }
  }
}

export default EnseignantApp;
