import {
  AssessmentResultStatus,
  GradingType,
  ReportAverageCalculationMode,
  type PrismaClient,
} from "@prisma/client";
import {
  ACTIVE_ACADEMIC_ENROLLMENT_STATUSES,
  getRequiredActiveAcademicYear,
} from "../../pedagogie_shared/utils/academicScope";

type CalculationRequest = {
  tenantId: string;
  classeId: string;
  periodeId: string;
  calculationMode?: ReportAverageCalculationMode;
  roundingPrecision?: number;
  baseScore?: number | null;
  includeCodeGradesInGeneralAverage?: boolean;
  excludeNonEvaluatedItems?: boolean;
  minimumRequiredResults?: number;
  useWeights?: boolean;
  useCoefficients?: boolean;
};

type PersistedAverageRow = {
  etablissement_id: string;
  annee_scolaire_id: string;
  periode_id: string;
  classe_id: string;
  eleve_id: string;
  pedagogical_item_id: string;
  student_average: number | null;
  class_average: number | null;
  display_value: string | null;
  calculation_mode: ReportAverageCalculationMode;
  rounding_precision: number;
  status: string | null;
  calculated_at: Date;
};

type DirectItemAggregate = {
  average: number | null;
  displayValue: string | null;
};

type StudentGeneralAverage = {
  student_id: string;
  average: number | null;
};

type CalculationResult = {
  classeId: string;
  periodeId: string;
  academicYearId: string;
  calculationMode: ReportAverageCalculationMode;
  roundingPrecision: number;
  baseScore: number | null;
  includeCodeGradesInGeneralAverage: boolean;
  excludeNonEvaluatedItems: boolean;
  minimumRequiredResults: number;
  useWeights: boolean;
  useCoefficients: boolean;
  studentsCount: number;
  itemsCount: number;
  savedRowsCount: number;
  studentGeneralAverages: StudentGeneralAverage[];
  classGeneralAverage: number | null;
};

type PedagogicalItemNode = {
  id: string;
  parent_id: string | null;
  item_type: string;
  display_order: number;
  matiere_id: string | null;
  coefficient: number | null;
  weight: number | null;
  include_in_general_average: boolean;
  is_active: boolean;
};

type EvaluationForCalculation = {
  id: string;
  pedagogical_item_id: string | null;
  note_max: number;
  poids: number | null;
  include_in_average: boolean | null;
  gradingScale: {
    grading_type: GradingType;
    base_score: number | null;
    use_for_calculation: boolean;
  } | null;
};

type AssessmentResultForCalculation = {
  assessment_id: string;
  student_id: string;
  raw_score: number | null;
  max_score: number | null;
  normalized_score: number | null;
  display_value: string | null;
  status: AssessmentResultStatus;
  scaleLevel?: {
    numeric_value: number | null;
  } | null;
};

type LegacyNoteForCalculation = {
  evaluation_id: string;
  eleve_id: string;
  score: number;
};

const IGNORED_RESULT_STATUSES = new Set<AssessmentResultStatus>([
  AssessmentResultStatus.JUSTIFIED_ABSENCE,
  AssessmentResultStatus.EXEMPTED,
  AssessmentResultStatus.NOT_EVALUATED,
]);

const ZERO_RESULT_STATUSES = new Set<AssessmentResultStatus>([
  AssessmentResultStatus.UNJUSTIFIED_ABSENCE,
  AssessmentResultStatus.NOT_SUBMITTED,
]);

export class ReportCalculationService {
  constructor(private readonly prisma: PrismaClient) {}

  private normalizeRoundingPrecision(value?: number | null) {
    if (!Number.isFinite(value)) return 2;
    const parsed = Math.trunc(Number(value));
    return Math.max(0, Math.min(4, parsed));
  }

  private normalizeMinimumRequiredResults(value?: number | null) {
    const parsed = Number(value ?? 1);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.trunc(parsed));
  }

  private normalizeBaseScore(value?: number | null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private roundValue(value: number, precision: number) {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
  }

  private formatDisplayValue(value: number | null, precision: number) {
    if (value === null || !Number.isFinite(value)) {
      return null;
    }

    const rounded = this.roundValue(value, precision);
    if (Number.isInteger(rounded)) {
      return String(rounded);
    }

    return rounded.toFixed(precision).replace(/\.?0+$/, "");
  }

  private normalizeAssessmentScore(args: {
    rawScore: number;
    maxScore: number;
    evaluation: EvaluationForCalculation;
    baseScore: number | null;
  }) {
    const baseScore =
      typeof args.evaluation.gradingScale?.base_score === "number" &&
      Number.isFinite(args.evaluation.gradingScale.base_score) &&
      args.evaluation.gradingScale.base_score > 0
        ? args.evaluation.gradingScale.base_score
        : args.baseScore !== null
          ? args.baseScore
        : args.maxScore;

    if (!Number.isFinite(baseScore) || baseScore <= 0) {
      return null;
    }

    return (args.rawScore / args.maxScore) * baseScore;
  }

  private resolveNumericContribution(args: {
    evaluation: EvaluationForCalculation;
    result?: AssessmentResultForCalculation | null;
    note?: LegacyNoteForCalculation | null;
    includeCodeGradesInGeneralAverage: boolean;
    baseScore: number | null;
  }) {
    const gradingType = args.evaluation.gradingScale?.grading_type ?? GradingType.POINTS;
    const useForCalculation = args.evaluation.gradingScale?.use_for_calculation ?? true;

    if (!useForCalculation) {
      return null;
    }

    const gradingIsCodeLike =
      gradingType === GradingType.LETTER ||
      gradingType === GradingType.LEVEL ||
      gradingType === GradingType.VALIDATION;

    if (gradingIsCodeLike && !args.includeCodeGradesInGeneralAverage) {
      return null;
    }

    if (args.result) {
      if (IGNORED_RESULT_STATUSES.has(args.result.status)) {
        return null;
      }

      if (ZERO_RESULT_STATUSES.has(args.result.status)) {
        return 0;
      }

      if (
        typeof args.result.normalized_score === "number" &&
        Number.isFinite(args.result.normalized_score)
      ) {
        return args.result.normalized_score;
      }

      if (
        gradingIsCodeLike &&
        typeof args.result.scaleLevel?.numeric_value === "number" &&
        Number.isFinite(args.result.scaleLevel.numeric_value)
      ) {
        return args.result.scaleLevel.numeric_value;
      }

      const rawScore = args.result.raw_score;
      const maxScore =
        typeof args.result.max_score === "number" && args.result.max_score > 0
          ? args.result.max_score
          : args.evaluation.note_max;

      if (
        typeof rawScore === "number" &&
        Number.isFinite(rawScore) &&
        Number.isFinite(maxScore) &&
        maxScore > 0
      ) {
        return this.normalizeAssessmentScore({
          rawScore,
          maxScore,
          evaluation: args.evaluation,
          baseScore: args.baseScore,
        });
      }

      return null;
    }

    if (args.note && Number.isFinite(args.note.score)) {
      const noteMax = args.evaluation.note_max;
      if (!Number.isFinite(noteMax) || noteMax <= 0) {
        return args.note.score;
      }

      return this.normalizeAssessmentScore({
        rawScore: args.note.score,
        maxScore: noteMax,
        evaluation: args.evaluation,
        baseScore: args.baseScore,
      });
    }

    return null;
  }

  private groupDirectResultsByStudentAndItem(args: {
    studentIds: string[];
    evaluations: EvaluationForCalculation[];
    assessmentResults: AssessmentResultForCalculation[];
    legacyNotes: LegacyNoteForCalculation[];
    calculationMode: ReportAverageCalculationMode;
    baseScore: number | null;
    includeCodeGradesInGeneralAverage: boolean;
    excludeNonEvaluatedItems: boolean;
    minimumRequiredResults: number;
    useWeights: boolean;
    roundingPrecision: number;
  }) {
    const resultByAssessmentAndStudent = new Map<string, AssessmentResultForCalculation>();
    const noteByAssessmentAndStudent = new Map<string, LegacyNoteForCalculation>();
    const studentDirectMap = new Map<string, Map<string, DirectItemAggregate>>();

    args.assessmentResults.forEach((result) => {
      resultByAssessmentAndStudent.set(
        `${result.assessment_id}::${result.student_id}`,
        result,
      );
    });

    args.legacyNotes.forEach((note) => {
      noteByAssessmentAndStudent.set(`${note.evaluation_id}::${note.eleve_id}`, note);
    });

    args.studentIds.forEach((studentId) => {
      const byItem = new Map<string, DirectItemAggregate>();

      args.evaluations.forEach((evaluation) => {
        if (!evaluation.pedagogical_item_id) return;

        const includeInAverage = evaluation.include_in_average ?? true;
        if (!includeInAverage) return;

        const result =
          resultByAssessmentAndStudent.get(`${evaluation.id}::${studentId}`) ?? null;
        const note =
          result === null
            ? noteByAssessmentAndStudent.get(`${evaluation.id}::${studentId}`) ?? null
            : null;

        const numericValue = this.resolveNumericContribution({
          evaluation,
          result,
          note,
          includeCodeGradesInGeneralAverage:
            args.includeCodeGradesInGeneralAverage,
          baseScore: args.baseScore,
        });

        const existing = byItem.get(evaluation.pedagogical_item_id) ?? {
          average: null,
          displayValue: null,
        };

        const current = (existing as DirectItemAggregate & {
          _sum?: number;
          _weight?: number;
          _count?: number;
          _displays?: string[];
        });

        const appliedWeight =
          args.calculationMode === ReportAverageCalculationMode.SIMPLE ||
          !args.useWeights
            ? 1
            : Number.isFinite(evaluation.poids ?? null) && (evaluation.poids ?? 0) > 0
              ? (evaluation.poids ?? 1)
              : 1;

        if (numericValue !== null && Number.isFinite(numericValue)) {
          current._sum = (current._sum ?? 0) + numericValue * appliedWeight;
          current._weight = (current._weight ?? 0) + appliedWeight;
          current._count = (current._count ?? 0) + 1;
        } else if (!args.excludeNonEvaluatedItems) {
          current._sum = current._sum ?? 0;
          current._weight = (current._weight ?? 0) + appliedWeight;
          current._count = (current._count ?? 0) + 1;
        }

        const directDisplay =
          result?.display_value?.trim() ??
          (note && Number.isFinite(note.score) && Number.isFinite(evaluation.note_max)
            ? `${note.score}/${evaluation.note_max}`
            : null);

        if (directDisplay) {
          current._displays = [...(current._displays ?? []), directDisplay];
        }

        byItem.set(evaluation.pedagogical_item_id, current);
      });

      const normalized = new Map<string, DirectItemAggregate>();
      byItem.forEach((value, itemId) => {
        const current = value as DirectItemAggregate & {
          _sum?: number;
          _weight?: number;
          _count?: number;
          _displays?: string[];
        };
        const average =
          typeof current._sum === "number" &&
          typeof current._weight === "number" &&
          current._weight > 0 &&
          (current._count ?? 0) >= args.minimumRequiredResults
            ? this.roundValue(current._sum / current._weight, args.roundingPrecision)
            : null;
        const displayValue =
          average !== null
            ? this.formatDisplayValue(average, args.roundingPrecision)
            : current._displays?.find((item) => item.trim()) ?? null;

        normalized.set(itemId, {
          average,
          displayValue,
        });
      });

      studentDirectMap.set(studentId, normalized);
    });

    return studentDirectMap;
  }

  private buildChildrenMap(items: PedagogicalItemNode[]) {
    const byParent = new Map<string | null, PedagogicalItemNode[]>();

    items.forEach((item) => {
      const bucket = byParent.get(item.parent_id) ?? [];
      bucket.push(item);
      byParent.set(item.parent_id, bucket);
    });

    byParent.forEach((bucket) => {
      bucket.sort((left, right) => {
        if (left.display_order !== right.display_order) {
          return left.display_order - right.display_order;
        }
        return left.id.localeCompare(right.id);
      });
    });

    return byParent;
  }

  private collectSimpleValues(args: {
    itemId: string;
    childrenMap: Map<string | null, PedagogicalItemNode[]>;
    directAverages: Map<string, DirectItemAggregate>;
  }): Array<{ average: number; displayValue: string | null }> {
    const values: Array<{ average: number; displayValue: string | null }> = [];
    const direct = args.directAverages.get(args.itemId);
    if (typeof direct?.average === "number" && Number.isFinite(direct.average)) {
      values.push({
        average: direct.average,
        displayValue: direct.displayValue,
      });
    }

    const children = args.childrenMap.get(args.itemId) ?? [];
    children.forEach((child) => {
      values.push(
        ...this.collectSimpleValues({
          itemId: child.id,
          childrenMap: args.childrenMap,
          directAverages: args.directAverages,
        }),
      );
    });

    return values;
  }

  private computeHierarchicalAverage(args: {
    item: PedagogicalItemNode;
    childrenMap: Map<string | null, PedagogicalItemNode[]>;
    directAverages: Map<string, DirectItemAggregate>;
    cache: Map<string, DirectItemAggregate>;
    roundingPrecision: number;
    excludeNonEvaluatedItems: boolean;
    minimumRequiredResults: number;
    useWeights: boolean;
  }): DirectItemAggregate {
    const cached = args.cache.get(args.item.id);
    if (cached) return cached;

    const children = args.childrenMap.get(args.item.id) ?? [];
    const childValues = children
      .map((child) =>
        this.computeHierarchicalAverage({
          ...args,
          item: child,
        }),
      )
      .map((value, index) => ({
        ...value,
        weight:
          !args.useWeights
            ? 1
            :
          Number.isFinite(children[index].weight ?? null) && (children[index].weight ?? 0) > 0
            ? (children[index].weight ?? 1)
            : 1,
      }))
      .filter((value) =>
        args.excludeNonEvaluatedItems
          ? typeof value.average === "number" && Number.isFinite(value.average)
          : true,
      );

    let result: DirectItemAggregate;

    if (childValues.length > 0 && childValues.length >= args.minimumRequiredResults) {
      const weightedSum = childValues.reduce(
        (sum, value) => sum + ((value.average ?? 0) * value.weight),
        0,
      );
      const totalWeight = childValues.reduce((sum, value) => sum + value.weight, 0);
      const average =
        totalWeight > 0
          ? this.roundValue(weightedSum / totalWeight, args.roundingPrecision)
          : null;
      result = {
        average,
        displayValue: this.formatDisplayValue(average, args.roundingPrecision),
      };
    } else {
      result = args.directAverages.get(args.item.id) ?? {
        average: null,
        displayValue: null,
      };
    }

    args.cache.set(args.item.id, result);
    return result;
  }

  private computeStudentItemValues(args: {
    items: PedagogicalItemNode[];
    studentDirectMap: Map<string, Map<string, DirectItemAggregate>>;
    calculationMode: ReportAverageCalculationMode;
    roundingPrecision: number;
    excludeNonEvaluatedItems: boolean;
    minimumRequiredResults: number;
    useWeights: boolean;
  }) {
    const childrenMap = this.buildChildrenMap(args.items);
    const result = new Map<string, Map<string, DirectItemAggregate>>();

    args.studentDirectMap.forEach((directAverages, studentId) => {
      const byItem = new Map<string, DirectItemAggregate>();

      if (args.calculationMode === ReportAverageCalculationMode.SIMPLE) {
        args.items.forEach((item) => {
          const values = this.collectSimpleValues({
            itemId: item.id,
            childrenMap,
            directAverages,
          });
          if (values.length === 0) {
            const direct = directAverages.get(item.id) ?? {
              average: null,
              displayValue: null,
            };
            byItem.set(item.id, direct);
            return;
          }

          if (values.length < args.minimumRequiredResults) {
            byItem.set(item.id, {
              average: null,
              displayValue: null,
            });
            return;
          }

          const average = this.roundValue(
            values.reduce((sum, value) => sum + value.average, 0) / values.length,
            args.roundingPrecision,
          );
          byItem.set(item.id, {
            average,
            displayValue: this.formatDisplayValue(average, args.roundingPrecision),
          });
        });
      } else {
        const cache = new Map<string, DirectItemAggregate>();
        args.items.forEach((item) => {
          byItem.set(
            item.id,
            this.computeHierarchicalAverage({
              item,
              childrenMap,
              directAverages,
              cache,
              roundingPrecision: args.roundingPrecision,
              excludeNonEvaluatedItems: args.excludeNonEvaluatedItems,
              minimumRequiredResults: args.minimumRequiredResults,
              useWeights: args.useWeights,
            }),
          );
        });
      }

      result.set(studentId, byItem);
    });

    return result;
  }

  private computeClassAverages(args: {
    items: PedagogicalItemNode[];
    studentItemValues: Map<string, Map<string, DirectItemAggregate>>;
    roundingPrecision: number;
  }) {
    const classAverages = new Map<string, number | null>();

    args.items.forEach((item) => {
      const values = [...args.studentItemValues.values()]
        .map((studentMap) => studentMap.get(item.id)?.average ?? null)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

      if (values.length === 0) {
        classAverages.set(item.id, null);
        return;
      }

      const average = this.roundValue(
        values.reduce((sum, value) => sum + value, 0) / values.length,
        args.roundingPrecision,
      );
      classAverages.set(item.id, average);
    });

    return classAverages;
  }

  private computeGeneralAverages(args: {
    items: PedagogicalItemNode[];
    studentItemValues: Map<string, Map<string, DirectItemAggregate>>;
    roundingPrecision: number;
    useCoefficients: boolean;
    programmeCoefficientByMatiereId: Map<string, number>;
  }) {
    const subjectItems = args.items.filter(
      (item) =>
        item.item_type === "SUBJECT" &&
        item.include_in_general_average,
    );
    const rootItems = (subjectItems.length > 0 ? subjectItems : args.items).filter(
      (item) =>
        (subjectItems.length > 0 || item.parent_id === null) &&
        item.include_in_general_average,
    );

    const getCoefficient = (item: PedagogicalItemNode) => {
      if (!args.useCoefficients) return 1;
      const ownCoefficient =
        typeof item.coefficient === "number" && Number.isFinite(item.coefficient) && item.coefficient > 0
          ? item.coefficient
          : null;
      const programmeCoefficient =
        item.matiere_id && args.programmeCoefficientByMatiereId.has(item.matiere_id)
          ? args.programmeCoefficientByMatiereId.get(item.matiere_id) ?? null
          : null;
      return ownCoefficient ?? programmeCoefficient ?? 1;
    };

    const studentGeneralAverages: StudentGeneralAverage[] = [...args.studentItemValues.entries()]
      .map(([studentId, itemValues]) => {
        const values = rootItems
          .map((item) => ({
            average: itemValues.get(item.id)?.average ?? null,
            coefficient: getCoefficient(item),
          }))
          .filter(
            (value): value is { average: number; coefficient: number } =>
              typeof value.average === "number" && Number.isFinite(value.average),
          );

        if (values.length === 0) {
          return {
            student_id: studentId,
            average: null,
          };
        }

        return {
          student_id: studentId,
          average: this.roundValue(
            args.useCoefficients
              ? values.reduce((sum, value) => sum + value.average * value.coefficient, 0) /
                  values.reduce((sum, value) => sum + value.coefficient, 0)
              : values.reduce((sum, value) => sum + value.average, 0) / values.length,
            args.roundingPrecision,
          ),
        };
      });

    const validGeneralAverages = studentGeneralAverages
      .map((item) => item.average)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    const classGeneralAverage =
      validGeneralAverages.length > 0
        ? this.roundValue(
            validGeneralAverages.reduce((sum, value) => sum + value, 0) /
              validGeneralAverages.length,
            args.roundingPrecision,
          )
        : null;

    return {
      studentGeneralAverages,
      classGeneralAverage,
    };
  }

  async calculateAndPersist(request: CalculationRequest): Promise<CalculationResult> {
    const calculationMode =
      request.calculationMode ?? ReportAverageCalculationMode.HIERARCHICAL;
    const roundingPrecision = this.normalizeRoundingPrecision(
      request.roundingPrecision,
    );
    const baseScore = this.normalizeBaseScore(request.baseScore);
    const includeCodeGradesInGeneralAverage = Boolean(
      request.includeCodeGradesInGeneralAverage,
    );
    const excludeNonEvaluatedItems = request.excludeNonEvaluatedItems ?? true;
    const minimumRequiredResults = this.normalizeMinimumRequiredResults(
      request.minimumRequiredResults,
    );
    const useWeights =
      request.useWeights ?? calculationMode === ReportAverageCalculationMode.WEIGHTED;
    const useCoefficients =
      request.useCoefficients ??
      calculationMode === ReportAverageCalculationMode.COEFFICIENT_BASED;

    const activeYear = await getRequiredActiveAcademicYear(this.prisma, request.tenantId);

    const [classe, periode] = await Promise.all([
      this.prisma.classe.findFirst({
        where: {
          id: request.classeId,
          etablissement_id: request.tenantId,
          annee_scolaire_id: activeYear.id,
        },
        select: {
          id: true,
          niveau_scolaire_id: true,
          annee_scolaire_id: true,
        },
      }),
      this.prisma.periode.findFirst({
        where: {
          id: request.periodeId,
          annee_scolaire_id: activeYear.id,
        },
        select: {
          id: true,
          annee_scolaire_id: true,
        },
      }),
    ]);

    if (!classe) {
      throw new Error("La classe selectionnee n'appartient pas a l'annee scolaire courante.");
    }

    if (!periode) {
      throw new Error("La periode selectionnee n'appartient pas a l'annee scolaire courante.");
    }

    const inscriptions = await this.prisma.inscription.findMany({
      where: {
        classe_id: classe.id,
        annee_scolaire_id: activeYear.id,
        statut: { in: [...ACTIVE_ACADEMIC_ENROLLMENT_STATUSES] },
      },
      select: {
        eleve_id: true,
      },
      orderBy: [{ created_at: "asc" }],
    });

    const studentIds = [...new Set(inscriptions.map((item) => item.eleve_id))];
    if (studentIds.length === 0) {
      throw new Error("Aucun eleve actif n'est inscrit dans cette classe.");
    }

    const items = await this.prisma.pedagogicalItem.findMany({
      where: {
        etablissement_id: request.tenantId,
        annee_scolaire_id: activeYear.id,
        niveau_scolaire_id: classe.niveau_scolaire_id,
        is_active: true,
      },
      select: {
        id: true,
        parent_id: true,
        item_type: true,
        display_order: true,
        matiere_id: true,
        coefficient: true,
        weight: true,
        include_in_general_average: true,
        is_active: true,
      },
      orderBy: [{ display_order: "asc" }, { nom: "asc" }],
    });

    if (items.length === 0) {
      throw new Error("Aucun element pedagogique actif n'est defini pour ce niveau.");
    }

    const subjectMatiereIds = [
      ...new Set(
        items
          .filter((item) => item.item_type === "SUBJECT" && item.matiere_id)
          .map((item) => item.matiere_id!)
      ),
    ];
    const programmeLines =
      subjectMatiereIds.length > 0
        ? await this.prisma.programmeMatiere.findMany({
            where: {
              matiere_id: { in: subjectMatiereIds },
              programme: {
                etablissement_id: request.tenantId,
                annee_scolaire_id: activeYear.id,
                niveau_scolaire_id: classe.niveau_scolaire_id,
              },
            },
            select: {
              matiere_id: true,
              coefficient: true,
              programme: {
                select: {
                  est_actif: true,
                },
              },
            },
            orderBy: [{ created_at: "asc" }],
          })
        : [];
    const programmeCoefficientByMatiereId = new Map<string, number>();
    programmeLines
      .sort((left, right) => Number(right.programme.est_actif) - Number(left.programme.est_actif))
      .forEach((line) => {
        if (
          !programmeCoefficientByMatiereId.has(line.matiere_id) &&
          typeof line.coefficient === "number" &&
          Number.isFinite(line.coefficient) &&
          line.coefficient > 0
        ) {
          programmeCoefficientByMatiereId.set(line.matiere_id, line.coefficient);
        }
      });

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        periode_id: periode.id,
        cours: {
          classe_id: classe.id,
          annee_scolaire_id: activeYear.id,
        },
        pedagogical_item_id: {
          not: null,
        },
      },
      select: {
        id: true,
        pedagogical_item_id: true,
        note_max: true,
        poids: true,
        include_in_average: true,
        gradingScale: {
          select: {
            grading_type: true,
            base_score: true,
            use_for_calculation: true,
          },
        },
      },
    });

    const evaluationIds = evaluations.map((item) => item.id);

    const [assessmentResults, legacyNotes] = await Promise.all([
      evaluationIds.length > 0
        ? this.prisma.assessmentResult.findMany({
            where: {
              assessment_id: { in: evaluationIds },
              student_id: { in: studentIds },
            },
            select: {
              assessment_id: true,
              student_id: true,
              raw_score: true,
              max_score: true,
              normalized_score: true,
              display_value: true,
              status: true,
              scaleLevel: {
                select: {
                  numeric_value: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      evaluationIds.length > 0
        ? this.prisma.note.findMany({
            where: {
              evaluation_id: { in: evaluationIds },
              eleve_id: { in: studentIds },
            },
            select: {
              evaluation_id: true,
              eleve_id: true,
              score: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const studentDirectMap = this.groupDirectResultsByStudentAndItem({
      studentIds,
      evaluations: evaluations as EvaluationForCalculation[],
      assessmentResults: assessmentResults as AssessmentResultForCalculation[],
      legacyNotes: legacyNotes as LegacyNoteForCalculation[],
      calculationMode,
      baseScore,
      includeCodeGradesInGeneralAverage,
      excludeNonEvaluatedItems,
      minimumRequiredResults,
      useWeights,
      roundingPrecision,
    });

    const studentItemValues = this.computeStudentItemValues({
      items: items as PedagogicalItemNode[],
      studentDirectMap,
      calculationMode,
      roundingPrecision,
      excludeNonEvaluatedItems,
      minimumRequiredResults,
      useWeights:
        useWeights || calculationMode === ReportAverageCalculationMode.WEIGHTED,
    });

    const classAverages = this.computeClassAverages({
      items: items as PedagogicalItemNode[],
      studentItemValues,
      roundingPrecision,
    });

    const { studentGeneralAverages, classGeneralAverage } = this.computeGeneralAverages({
      items: items as PedagogicalItemNode[],
      studentItemValues,
      roundingPrecision,
      useCoefficients:
        useCoefficients || calculationMode === ReportAverageCalculationMode.COEFFICIENT_BASED,
      programmeCoefficientByMatiereId,
    });

    const calculatedAt = new Date();
    const rowsToPersist: PersistedAverageRow[] = [];

    studentItemValues.forEach((itemValues, studentId) => {
      itemValues.forEach((value, itemId) => {
        const classAverage = classAverages.get(itemId) ?? null;
        if (value.average === null && classAverage === null && !value.displayValue) {
          return;
        }

        rowsToPersist.push({
          etablissement_id: request.tenantId,
          annee_scolaire_id: activeYear.id,
          periode_id: periode.id,
          classe_id: classe.id,
          eleve_id: studentId,
          pedagogical_item_id: itemId,
          student_average: value.average,
          class_average: classAverage,
          display_value:
            value.average !== null
              ? this.formatDisplayValue(value.average, roundingPrecision)
              : value.displayValue,
          calculation_mode: calculationMode,
          rounding_precision: roundingPrecision,
          status: "CALCULATED",
          calculated_at: calculatedAt,
        });
      });
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.pedagogicalItemAverage.deleteMany({
        where: {
          etablissement_id: request.tenantId,
          annee_scolaire_id: activeYear.id,
          periode_id: periode.id,
          classe_id: classe.id,
          eleve_id: { in: studentIds },
        },
      });

      if (rowsToPersist.length > 0) {
        await tx.pedagogicalItemAverage.createMany({
          data: rowsToPersist,
        });
      }
    });

    return {
      classeId: classe.id,
      periodeId: periode.id,
      academicYearId: activeYear.id,
      calculationMode,
      roundingPrecision,
      baseScore,
      includeCodeGradesInGeneralAverage,
      excludeNonEvaluatedItems,
      minimumRequiredResults,
      useWeights,
      useCoefficients,
      studentsCount: studentIds.length,
      itemsCount: items.length,
      savedRowsCount: rowsToPersist.length,
      studentGeneralAverages,
      classGeneralAverage,
    };
  }
}

export default ReportCalculationService;
