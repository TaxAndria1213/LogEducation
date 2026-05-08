import { Application, NextFunction, Request, Response as R, Router } from "express";
import {
  AssessmentResultStatus,
  Prisma,
  PrismaClient,
  type Note,
  type ReportCardTemplate,
} from "@prisma/client";
import Response from "../../../common/app/response";
import BulletinModel from "../models/bulletin.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { assertNoAdministrativeRestriction } from "../../finance_shared/utils/recovery_restrictions";
import {
  ACTIVE_ACADEMIC_ENROLLMENT_STATUSES,
  getRequiredActiveAcademicYear,
} from "../../pedagogie_shared/utils/academicScope";
import {
  loadPedagogieInitialisationConfig,
  type PedagogieNoteRules,
  type PedagogieEvaluationTypeConfig,
} from "../../pedagogie_shared/utils/reportCardTemplate";
import { prisma } from "../../../service/prisma";
import {
  BulletinDisplayService,
  type BulletinDisplayColumn,
  type BulletinDisplayLine,
  type BulletinDisplaySnapshot,
} from "./bulletin_display.service";

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
  blocked: boolean;
};

type RankedScore = {
  studentId: string;
  moyenne: number;
};

type EvaluationForAggregation = {
  id: string;
  type: string;
  include_in_average?: boolean | null;
  note_max: number;
  poids: number | null;
  cours: {
    matiere_id: string;
  };
};

type NoteForAggregation = Note & {
  evaluation: EvaluationForAggregation;
  eleve_id: string;
};

type AssessmentResultForAggregation = {
  assessment_id: string;
  student_id: string;
  raw_score: number | null;
  max_score: number | null;
  normalized_score: number | null;
  display_value: string | null;
  status: AssessmentResultStatus;
  observation?: string | null;
  assessment: EvaluationForAggregation;
};

type SubjectLineInput = {
  matiere_id: string;
  moyenne: number | null;
  rang: number | null;
  commentaire_enseignant: string | null;
};

type BulletinWithDisplay = Record<string, unknown> & {
  id: string;
  eleve_id?: string | null;
  periode_id?: string | null;
  classe_id?: string | null;
  report_card_template_id?: string | null;
  general_average?: Prisma.Decimal | number | null;
  total_coefficients?: Prisma.Decimal | number | null;
  total_points?: Prisma.Decimal | number | null;
  general_rank?: number | null;
  mention?: string | null;
  decision?: string | null;
  general_appreciation?: string | null;
  display_snapshot_json?: unknown;
  lignes?: Array<{
    matiere_id?: string | null;
    moyenne?: number | null;
    rang?: number | null;
    commentaire_enseignant?: string | null;
    matiere?: {
      id?: string | null;
      nom?: string | null;
    } | null;
  }> | null;
  affichage_bulletin?: BulletinDisplaySnapshot | null;
};

class BulletinApp {
  public app: Application;
  public router: Router;
  private bulletin: BulletinModel;
  private prisma: PrismaClient;
  private displayService: BulletinDisplayService;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.bulletin = new BulletinModel();
    this.prisma = prisma;
    this.displayService = new BulletinDisplayService(this.prisma);
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
    const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
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

    if (periode.annee_scolaire_id !== activeYear.id) {
      throw new Error("La periode selectionnee n'appartient pas a l'annee scolaire courante.");
    }

    const inscription = await this.prisma.inscription.findFirst({
      where: {
        eleve_id: payload.eleve_id,
        annee_scolaire_id: activeYear.id,
        statut: { in: [...ACTIVE_ACADEMIC_ENROLLMENT_STATUSES] },
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

    await assertNoAdministrativeRestriction(this.prisma, {
      tenantId,
      eleveId: payload.eleve_id,
      anneeScolaireId: periode.annee_scolaire_id,
      type: "BULLETIN",
    });

    return {
      activeYear,
      periode,
      inscription,
    };
  }

  private async ensureUniqueBulletin(
    tx: Prisma.TransactionClient | PrismaClient,
    eleve_id: string,
    periode_id: string,
    excludeId?: string,
  ) {
    const existing = await tx.bulletin.findFirst({
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

  private getCompetitionRank(subjectScores: RankedScore[], targetStudentId: string) {
    let previousScore: number | null = null;
    let currentRank = 0;

    for (let index = 0; index < subjectScores.length; index += 1) {
      const entry = subjectScores[index];

      if (previousScore === null || entry.moyenne !== previousScore) {
        currentRank = index + 1;
        previousScore = entry.moyenne;
      }

      if (entry.studentId === targetStudentId) {
        return currentRank;
      }
    }

    return null;
  }

  private getDenseRank(subjectScores: RankedScore[], targetStudentId: string) {
    let previousScore: number | null = null;
    let currentRank = 0;

    for (const entry of subjectScores) {
      if (previousScore === null || entry.moyenne !== previousScore) {
        currentRank += 1;
        previousScore = entry.moyenne;
      }

      if (entry.studentId === targetStudentId) {
        return currentRank;
      }
    }

    return null;
  }

  private getRank(
    subjectScores: RankedScore[],
    targetStudentId: string,
    noteRules: PedagogieNoteRules,
  ) {
    if (noteRules.ranking_mode === "DENSE") {
      return this.getDenseRank(subjectScores, targetStudentId);
    }

    return this.getCompetitionRank(subjectScores, targetStudentId);
  }

  private getRoundingIncrement(noteRules: PedagogieNoteRules) {
    switch (noteRules.arrondi) {
      case "1":
        return 1;
      case "0.5":
        return 0.5;
      default:
        return 0.25;
    }
  }

  private roundWithNoteRules(value: number, noteRules: PedagogieNoteRules) {
    const increment = this.getRoundingIncrement(noteRules);
    return Math.round(value / increment) * increment;
  }

  private roundToTwo(value: number) {
    return Math.round(value * 100) / 100;
  }

  private normalizeAssessmentScore(
    score: number,
    noteMax: number,
    typeConfig: PedagogieEvaluationTypeConfig | null,
  ) {
    const targetMax = typeConfig?.note_max ?? 20;
    return (score / noteMax) * targetMax;
  }

  private getAssessmentTypeLabel(
    type: string,
    typeConfigs: Map<string, PedagogieEvaluationTypeConfig>,
  ) {
    const configured = typeConfigs.get(type);
    if (configured?.label?.trim()) {
      return configured.label.trim();
    }

    switch (type) {
      case "DEVOIR":
        return "Devoirs";
      case "EXAMEN":
        return "Compositions / examens";
      case "ORAL":
        return "Oraux";
      default:
        return "Autres";
    }
  }

  private getMentionForAverage(average: number | null) {
    if (average === null) return null;
    if (average >= 16) return "Tres bien";
    if (average >= 14) return "Bien";
    if (average >= 12) return "Assez bien";
    if (average >= 10) return "Passable";
    return "Insuffisant";
  }

  private isIgnoredAssessmentResultStatus(status: AssessmentResultStatus) {
    return (
      status === AssessmentResultStatus.JUSTIFIED_ABSENCE ||
      status === AssessmentResultStatus.EXEMPTED ||
      status === AssessmentResultStatus.NOT_EVALUATED
    );
  }

  private isZeroAssessmentResultStatus(status: AssessmentResultStatus) {
    return (
      status === AssessmentResultStatus.UNJUSTIFIED_ABSENCE ||
      status === AssessmentResultStatus.NOT_SUBMITTED
    );
  }

  private aggregateNotesByStudentAndSubject(args: {
    studentIds: string[];
    evaluations: EvaluationForAggregation[];
    assessmentResults: AssessmentResultForAggregation[];
    notes: NoteForAggregation[];
    typeConfigs: Map<string, PedagogieEvaluationTypeConfig>;
    noteRules: PedagogieNoteRules;
  }) {
    const studentMap = new Map<string, Map<string, StudentSubjectAggregate>>();
    const resultByEvaluationAndStudent = new Map<string, AssessmentResultForAggregation>();
    const noteByEvaluationAndStudent = new Map<string, NoteForAggregation>();

    args.assessmentResults.forEach((result) => {
      resultByEvaluationAndStudent.set(
        `${result.assessment_id}::${result.student_id}`,
        result,
      );
    });

    args.notes.forEach((note) => {
      noteByEvaluationAndStudent.set(
        `${note.evaluation.id}::${note.eleve_id}`,
        note,
      );
    });

    args.evaluations.forEach((evaluation) => {
      const typeConfig = args.typeConfigs.get(evaluation.type) ?? null;
      const includeInAverage =
        evaluation.include_in_average ?? typeConfig?.include_in_average ?? true;

      if (!includeInAverage) {
        return;
      }

      const matiereId = evaluation.cours.matiere_id;
      const noteMax = evaluation.note_max;
      const evaluationWeight = evaluation.poids ?? typeConfig?.poids ?? 1;
      const appliedWeight =
        args.noteRules.moyenne === "SIMPLE" ? 1 : evaluationWeight;

      if (
        !matiereId ||
        !Number.isFinite(noteMax) ||
        noteMax <= 0 ||
        !Number.isFinite(appliedWeight) ||
        appliedWeight <= 0
      ) {
        return;
      }

      args.studentIds.forEach((studentId) => {
        const result = resultByEvaluationAndStudent.get(
          `${evaluation.id}::${studentId}`,
        );
        const note = noteByEvaluationAndStudent.get(
          `${evaluation.id}::${studentId}`,
        );
        const studentSubjects =
          studentMap.get(studentId) ??
          new Map<string, StudentSubjectAggregate>();
        const aggregate = studentSubjects.get(matiereId) ?? {
          sum: 0,
          weight: 0,
          comments: [],
          blocked: false,
        };

        if (result) {
          if (typeof result.observation === "string" && result.observation.trim()) {
            aggregate.comments.push(result.observation.trim());
          }

          if (result.status === AssessmentResultStatus.GRADED) {
            const normalizedScore =
              typeof result.normalized_score === "number"
                ? result.normalized_score
                : typeof result.raw_score === "number" &&
                    Number.isFinite(noteMax) &&
                    noteMax > 0
                  ? this.normalizeAssessmentScore(
                      result.raw_score,
                      noteMax,
                      typeConfig,
                    )
                  : null;

            if (normalizedScore !== null && Number.isFinite(normalizedScore)) {
              aggregate.sum += normalizedScore * appliedWeight;
              aggregate.weight += appliedWeight;
            }
          } else if (this.isIgnoredAssessmentResultStatus(result.status)) {
            // Absence justifiee, dispense et non evalue n'entrent pas dans la moyenne.
          } else if (this.isZeroAssessmentResultStatus(result.status)) {
            aggregate.weight += appliedWeight;
          }

          if (
            aggregate.blocked ||
            aggregate.weight > 0 ||
            aggregate.comments.length > 0
          ) {
            studentSubjects.set(matiereId, aggregate);
            studentMap.set(studentId, studentSubjects);
          }
          return;
        }

        if (
          note &&
          Number.isFinite(note.score) &&
          Number.isFinite(noteMax) &&
          noteMax > 0
        ) {
          const normalizedScore = this.normalizeAssessmentScore(
            note.score,
            noteMax,
            typeConfig,
          );
          aggregate.sum += normalizedScore * appliedWeight;
          aggregate.weight += appliedWeight;

          if (typeof note.commentaire === "string" && note.commentaire.trim()) {
            aggregate.comments.push(note.commentaire.trim());
          }
        } else if (args.noteRules.missing_grade_policy === "ZERO") {
          aggregate.weight += appliedWeight;
        } else if (args.noteRules.missing_grade_policy === "BLOCK") {
          aggregate.blocked = true;
        }

        if (
          aggregate.blocked ||
          aggregate.weight > 0 ||
          aggregate.comments.length > 0
        ) {
          studentSubjects.set(matiereId, aggregate);
          studentMap.set(studentId, studentSubjects);
        }
      });
    });

    return studentMap;
  }

  private buildBulletinLinesFromMap(
    studentMap: Map<string, Map<string, StudentSubjectAggregate>>,
    targetStudentId: string,
    noteRules: PedagogieNoteRules,
  ): SubjectLineInput[] {
    const targetSubjects = studentMap.get(targetStudentId) ?? new Map<string, StudentSubjectAggregate>();

    return [...targetSubjects.entries()]
      .map(([matiere_id, aggregate]) => {
        const moyenne = aggregate.blocked
          ? null
          : aggregate.weight > 0
            ? this.roundWithNoteRules(aggregate.sum / aggregate.weight, noteRules)
            : null;
        const subjectScores = [...studentMap.entries()]
          .map(([studentId, subjects]) => {
            const subjectAggregate = subjects.get(matiere_id);
            if (!subjectAggregate || subjectAggregate.blocked) {
              return null;
            }

            if (subjectAggregate.weight <= 0) {
              if (noteRules.exclude_ungraded_from_ranking) {
                return null;
              }

              return {
                studentId,
                moyenne: 0,
              };
            }

            return {
              studentId,
              moyenne: this.roundWithNoteRules(
                subjectAggregate.sum / subjectAggregate.weight,
                noteRules,
              ),
            };
          })
          .filter((entry): entry is RankedScore => Boolean(entry))
          .sort((left, right) => right.moyenne - left.moyenne);

        const uniqueComments = [...new Set(aggregate.comments)].slice(0, 3);
        const targetRank =
          moyenne === null && noteRules.exclude_ungraded_from_ranking
            ? null
            : this.getRank(subjectScores, targetStudentId, noteRules);

        return {
          matiere_id,
          moyenne,
          rang: targetRank,
          commentaire_enseignant: uniqueComments.length > 0 ? uniqueComments.join(" | ") : null,
        };
      })
      .sort((left, right) => (left.matiere_id > right.matiere_id ? 1 : -1));
  }

  private async buildGeneratedLines(
    eleveId: string,
    periodeId: string,
    classeId: string,
    academicYearId: string,
    tenantId: string,
  ) {
    const classStudentIds = await this.prisma.inscription.findMany({
      where: {
        classe_id: classeId,
        annee_scolaire_id: academicYearId,
        statut: { in: [...ACTIVE_ACADEMIC_ENROLLMENT_STATUSES] },
      },
      select: {
        eleve_id: true,
      },
    });

    const { config: pedagogieConfig } = await loadPedagogieInitialisationConfig(
      this.prisma,
      tenantId,
      academicYearId,
    );
    const typeConfigs: Map<string, PedagogieEvaluationTypeConfig> = new Map(
      pedagogieConfig.evaluation_types.map((item) => [item.code, item] as const),
    );
    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        periode_id: periodeId,
        cours: {
          classe_id: classeId,
        },
      },
      include: {
        cours: true,
      },
    });

    const assessmentResults = evaluations.length === 0
      ? []
      : await this.prisma.assessmentResult.findMany({
          where: {
            student_id: {
              in: classStudentIds.map((item) => item.eleve_id),
            },
            assessment_id: {
              in: evaluations.map((evaluation) => evaluation.id),
            },
          },
          include: {
            assessment: {
              include: {
                cours: true,
              },
            },
          },
        });

    const notes = evaluations.length === 0
      ? []
      : await this.prisma.note.findMany({
          where: {
            eleve_id: {
              in: classStudentIds.map((item) => item.eleve_id),
            },
            evaluation_id: {
              in: evaluations.map((evaluation) => evaluation.id),
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

    const studentMap = this.aggregateNotesByStudentAndSubject({
      studentIds: classStudentIds.map((item) => item.eleve_id),
      evaluations: evaluations as EvaluationForAggregation[],
      assessmentResults: assessmentResults as AssessmentResultForAggregation[],
      notes: notes as NoteForAggregation[],
      typeConfigs,
      noteRules: pedagogieConfig.note_rules,
    });

    return this.buildBulletinLinesFromMap(
      studentMap,
      eleveId,
      pedagogieConfig.note_rules,
    );
  }

  private async buildBulletinDisplaySnapshot(
    tenantId: string,
    eleveId: string,
    periodeId: string,
    classeId: string,
    academicYearId: string,
    storedLines: BulletinWithDisplay["lignes"],
    options?: {
      reportCardTemplateId?: string | null;
      generalRank?: number | null;
      mention?: string | null;
      decision?: string | null;
      generalAppreciation?: string | null;
      absenceCount?: number | null;
      lateCount?: number | null;
    },
  ): Promise<BulletinDisplaySnapshot> {
    let templateOverride: ReportCardTemplate | null = null;
    let templatePedagogicalItems:
      | Array<{
          pedagogical_item_id: string;
          is_visible: boolean;
          custom_label?: string | null;
          display_order: number;
          show_result: boolean;
          show_appreciation: boolean;
          show_children: boolean;
        }>
      | undefined;
    if (options?.reportCardTemplateId) {
      const templateRecord = await this.prisma.reportCardTemplate.findFirst({
        where: {
          id: options.reportCardTemplateId,
          etablissement_id: tenantId,
          annee_scolaire_id: academicYearId,
        },
        include: {
          pedagogicalItems: {
            orderBy: [{ display_order: "asc" }, { created_at: "asc" }],
          },
        } as any,
      });
      templateOverride = templateRecord;
      templatePedagogicalItems =
        ((templateRecord as any)?.pedagogicalItems as Array<Record<string, any>> | undefined)?.map((item) => ({
          pedagogical_item_id: item.pedagogical_item_id,
          is_visible: item.is_visible,
          custom_label: item.custom_label,
          display_order: item.display_order,
          show_result: item.show_result,
          show_appreciation: item.show_appreciation,
          show_children: item.show_children,
        })) ?? [];
    }

    return this.displayService.buildSnapshot({
      tenantId,
      eleveId,
      periodeId,
      classeId,
      academicYearId,
      storedLines: (storedLines ?? []) as Array<{
        matiere_id: string;
        moyenne: number | null;
        rang: number | null;
        commentaire_enseignant: string | null;
        matiere?: {
          id?: string | null;
          nom?: string | null;
        } | null;
      }>,
      templateOverride,
      templatePedagogicalItems,
      generalRank: options?.generalRank ?? null,
      mention: options?.mention ?? null,
      decision: options?.decision ?? null,
      generalAppreciation: options?.generalAppreciation ?? null,
      absenceCount: options?.absenceCount ?? null,
      lateCount: options?.lateCount ?? null,
    });
  }

  private async saveBulletinDisplaySnapshot(
    bulletinId: string,
    snapshot: BulletinDisplaySnapshot,
  ) {
    await this.prisma.bulletin.update({
      where: { id: bulletinId },
      data: {
        report_card_template_id: snapshot.template_id,
        general_average:
          snapshot.summary.general_average !== null
            ? new Prisma.Decimal(snapshot.summary.general_average)
            : null,
        total_coefficients: new Prisma.Decimal(
          snapshot.summary.total_coefficients,
        ),
        total_points: new Prisma.Decimal(snapshot.summary.total_points),
        general_rank: snapshot.summary.rank,
        mention: snapshot.summary.mention,
        decision: snapshot.summary.decision,
        general_appreciation: snapshot.summary.general_appreciation,
        display_snapshot_json: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private loadBulletinDisplaySnapshot(
    bulletin: BulletinWithDisplay | null,
  ): BulletinDisplaySnapshot | null {
    const snapshot = bulletin?.display_snapshot_json;

    if (
      typeof snapshot !== "object" ||
      snapshot === null ||
      Array.isArray(snapshot)
    ) {
      return null;
    }

    return snapshot as BulletinDisplaySnapshot;
  }

  private async attachDisplaySnapshotToBulletin(
    bulletin: BulletinWithDisplay | null,
    tenantId: string,
    options?: {
      academicYearId?: string | null;
      shouldPersist?: boolean;
      forceRefresh?: boolean;
    },
  ) {
    if (!bulletin) return null;

    if (!options?.forceRefresh) {
      const existingSnapshot = this.loadBulletinDisplaySnapshot(bulletin);
      if (existingSnapshot) {
        return {
          ...bulletin,
          affichage_bulletin: existingSnapshot,
        };
      }
    }

    if (!options?.academicYearId) {
      return {
        ...bulletin,
        affichage_bulletin: null,
      };
    }

    const snapshot = await this.buildBulletinDisplaySnapshot(
      tenantId,
      typeof bulletin.eleve_id === "string" ? bulletin.eleve_id : "",
      typeof bulletin.periode_id === "string" ? bulletin.periode_id : "",
      typeof bulletin.classe_id === "string" ? bulletin.classe_id : "",
      options.academicYearId,
      bulletin.lignes ?? [],
      {
        reportCardTemplateId:
          typeof bulletin.report_card_template_id === "string"
            ? bulletin.report_card_template_id
            : null,
        generalRank:
          typeof bulletin.general_rank === "number" ? bulletin.general_rank : null,
        mention:
          typeof bulletin.mention === "string" ? bulletin.mention : null,
        decision:
          typeof bulletin.decision === "string" ? bulletin.decision : null,
        generalAppreciation:
          typeof bulletin.general_appreciation === "string"
            ? bulletin.general_appreciation
            : null,
      },
    );

    if (options.shouldPersist) {
      await this.saveBulletinDisplaySnapshot(
        bulletin.id,
        snapshot,
      );
    }

    return {
      ...bulletin,
      report_card_template_id: snapshot.template_id,
      general_average: snapshot.summary.general_average,
      total_coefficients: snapshot.summary.total_coefficients,
      total_points: snapshot.summary.total_points,
      general_rank: snapshot.summary.rank,
      mention: snapshot.summary.mention,
      decision: snapshot.summary.decision,
      general_appreciation: snapshot.summary.general_appreciation,
      display_snapshot_json: snapshot,
      affichage_bulletin: snapshot,
    };
  }

  private async attachDisplaySnapshotsToCollection(
    bulletins: BulletinWithDisplay[],
    tenantId?: string,
    academicYearId?: string | null,
  ) {
    const enriched = await Promise.all(
      bulletins.map(async (bulletin) => {
        const existingSnapshot = this.loadBulletinDisplaySnapshot(bulletin);

        if (
          bulletin.statut === "PUBLIE" &&
          existingSnapshot
        ) {
          return {
            ...bulletin,
            affichage_bulletin: existingSnapshot,
          };
        }

        if (
          tenantId &&
          academicYearId &&
          typeof bulletin.eleve_id === "string" &&
          typeof bulletin.periode_id === "string" &&
          typeof bulletin.classe_id === "string"
        ) {
          return this.attachDisplaySnapshotToBulletin(bulletin, tenantId, {
            academicYearId,
            shouldPersist: bulletin.statut !== "PUBLIE",
            forceRefresh: bulletin.statut !== "PUBLIE" || !existingSnapshot,
          });
        }

        return {
          ...bulletin,
          affichage_bulletin: existingSnapshot,
        };
      }),
    );

    return enriched;
  }

  private async regenerateBulletinLines(
    bulletinId: string,
    eleveId: string,
    periodeId: string,
    classeId: string,
    academicYearId: string,
    tenantId: string,
    currentStatus?: string | null,
    currentPublishedAt?: Date | null,
  ) {
    const lines = await this.buildGeneratedLines(
      eleveId,
      periodeId,
      classeId,
      academicYearId,
      tenantId,
    );
    const hasLines = lines.length > 0;
    const preservePublication = currentStatus === "PUBLIE" && Boolean(currentPublishedAt);

    const bulletin = await this.prisma.$transaction(async (tx) => {
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
          statut: preservePublication ? "PUBLIE" : hasLines ? "GENERE" : "EN_COURS",
          publie_le: preservePublication ? currentPublishedAt : null,
        },
      });

      return tx.bulletin.findUnique({
        where: { id: bulletinId },
        include: this.getDetailInclude(),
      });
    });

    return this.attachDisplaySnapshotToBulletin(
      bulletin as BulletinWithDisplay | null,
      tenantId,
      {
        academicYearId,
        shouldPersist: !preservePublication,
        forceRefresh: !preservePublication,
      },
    );
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body);
      const { activeYear, inscription } = await this.validateContext(payload, tenantId);
      const classeId = inscription.classe_id ?? undefined;

      if (!classeId) {
        throw new Error("Impossible de creer un bulletin sans classe affectee.");
      }

      if (payload.statut === "PUBLIE" || payload.publie_le) {
        throw new Error("La publication du bulletin necessite une validation prealable.");
      }

      const bulletin = await this.prisma.$transaction(
        async (tx) => {
          await this.ensureUniqueBulletin(tx, payload.eleve_id, payload.periode_id);

          return tx.bulletin.create({
            data: {
              eleve_id: payload.eleve_id,
              periode_id: payload.periode_id,
              classe_id: classeId,
              publie_le: null,
              statut: "EN_COURS",
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      const result = await this.regenerateBulletinLines(
        bulletin.id,
        payload.eleve_id,
        payload.periode_id,
        classeId,
        activeYear.id,
        tenantId,
        bulletin.statut,
        bulletin.publie_le,
      );

      Response.success(res, "Bulletin cree avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation du bulletin",
        400,
        error as Error,
      );    }
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
        include: {
          periode: {
            select: {
              annee_scolaire_id: true,
            },
          },
        },
      });

      if (!bulletin) {
        throw new Error("Bulletin introuvable pour cet etablissement.");
      }

      if (bulletin.statut === "PUBLIE") {
        throw new Error(
          "Ce bulletin est deja publie et ne peut plus etre modifie automatiquement.",
        );
      }

      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);

      if (bulletin.periode?.annee_scolaire_id !== activeYear.id) {
        throw new Error("La periode du bulletin n'appartient pas a l'annee scolaire courante.");
      }

      const result = await this.regenerateBulletinLines(
        bulletin.id,
        bulletin.eleve_id,
        bulletin.periode_id,
        bulletin.classe_id,
        activeYear.id,
        tenantId,
        bulletin.statut,
        bulletin.publie_le,
      );

      Response.success(res, "Bulletin regenere avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la generation du bulletin",
        400,
        error as Error,
      );    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId)),
        orderBy: req.query.orderBy ?? JSON.stringify([{ created_at: "desc" }]),
      };

      const result = await getAllPaginated(scopedQuery as typeof req.query, this.bulletin);
      const rows = Array.isArray(result?.data)
        ? (result.data as BulletinWithDisplay[])
        : [];
      const enriched = await this.attachDisplaySnapshotsToCollection(
        rows,
        tenantId,
        activeYear.id,
      );

      Response.success(res, "Liste des bulletins recuperee.", {
        ...result,
        data: enriched,
      });
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des bulletins",
        400,
        error as Error,
      );    }
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
        include: {
          ...this.getDetailInclude(),
          periode: {
            select: {
              id: true,
              nom: true,
              date_debut: true,
              date_fin: true,
              ordre: true,
              annee_scolaire_id: true,
            },
          },
        },
      });

      if (!result) {
        throw new Error("Bulletin introuvable pour cet etablissement.");
      }

      const enriched = await this.attachDisplaySnapshotToBulletin(
        result as BulletinWithDisplay,
        tenantId,
        {
          academicYearId: result.periode?.annee_scolaire_id ?? null,
          shouldPersist: result.statut !== "PUBLIE",
          forceRefresh: result.statut !== "PUBLIE",
        },
      );

      Response.success(res, "Detail du bulletin.", enriched);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation du bulletin",
        404,
        error as Error,
      );    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;
      const existing = await this.getScopedBulletin(id, tenantId);

      if (!existing) {
        throw new Error("Bulletin introuvable pour cet etablissement.");
      }

      if (existing.statut === "PUBLIE") {
        throw new Error("Un bulletin publie ne peut pas etre supprime automatiquement.");
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
      );    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;
      const existing = await this.getScopedBulletin(id, tenantId);

      if (!existing) {
        throw new Error("Bulletin introuvable pour cet etablissement.");
      }

      if (existing.statut === "PUBLIE") {
        throw new Error(
          "Ce bulletin est deja publie et ne peut plus etre modifie automatiquement.",
        );
      }

      const payload = this.normalizePayload(req.body);
      const { activeYear, inscription } = await this.validateContext(payload, tenantId);
      const classeId = inscription.classe_id ?? undefined;

      if (!classeId) {
        throw new Error("Impossible de mettre a jour un bulletin sans classe affectee.");
      }

      if (payload.statut === "PUBLIE" || payload.publie_le) {
        throw new Error("La publication du bulletin necessite une validation prealable.");
      }

      await this.ensureUniqueBulletin(this.prisma, payload.eleve_id, payload.periode_id, id);

      await this.prisma.bulletin.update({
        where: { id },
        data: {
          eleve_id: payload.eleve_id,
          periode_id: payload.periode_id,
          classe_id: classeId,
          publie_le: existing.publie_le ?? null,
          statut: existing.statut ?? "EN_COURS",
        },
      });

      const result = await this.regenerateBulletinLines(
        id,
        payload.eleve_id,
        payload.periode_id,
        classeId,
        activeYear.id,
        tenantId,
        existing.statut,
        existing.publie_le,
      );

      Response.success(res, "Bulletin mis a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour du bulletin",
        400,
        error as Error,
      );    }
  }
}

export default BulletinApp;


