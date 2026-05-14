import { Application, NextFunction, Request, Response as R, Router } from "express";
import {
  PedagogicalCalculationMode,
  Prisma,
  PrismaClient,
  StatutProgramme,
  StatutProgrammeMatiere,
  type Programme,
  type ProgrammeMatiere,
} from "@prisma/client";
import Response from "../../../common/app/response";
import ProgrammeModel from "../models/programme.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import {
  ACTIVE_ACADEMIC_ENROLLMENT_STATUSES,
  getRequestUserId,
  getRequiredActiveAcademicYear,
} from "../../pedagogie_shared/utils/academicScope";
import {
  extractRoleNamesFromUser,
  hasSystemAdminRoleNames,
} from "../../../service/sessionPolicy";

type ProgrammeMatierePayload = {
  matiere_id: string;
  heures_semaine: number | null;
  heures_annuelles: number | null;
  seances_par_semaine: number | null;
  duree_seance_par_defaut: number | null;
  coefficient: number | null;
  est_obligatoire: boolean;
  est_visible_bulletin: boolean;
  inclure_moyenne_generale: boolean;
  appreciation_obligatoire: boolean;
  libelle_bulletin: string | null;
  ordre_affichage_bulletin: number | null;
  grading_scale_id: string | null;
  mode_calcul: PedagogicalCalculationMode;
  statut: StatutProgrammeMatiere;
};

type ProgrammePayload = {
  etablissement_id: string;
  annee_scolaire_id: string;
  niveau_scolaire_id: string;
  code: string | null;
  nom: string;
  description: string | null;
  statut: StatutProgramme;
  date_debut: Date | null;
  date_fin: Date | null;
  est_actif: boolean;
  ordre_affichage: number;
  default_grading_scale_id: string | null;
  reason: string | null;
  confirm_sensitive_changes: boolean;
  recalculate_draft_report_cards: boolean;
  regenerate_unpublished_bulletins: boolean;
  sync_existing_courses_mode: string | null;
  matieres: ProgrammeMatierePayload[];
};

type ImpactSummary = {
  classesCount: number;
  generatedCoursesCount: number;
  teachersCount: number;
  studentsCount: number;
  evaluationsCount: number;
  notesCount: number;
  assessmentResultsCount: number;
  draftReportCardsCount: number;
  validatedReportCardsCount: number;
  publishedReportCardsCount: number;
  usedSubjectIds: string[];
};

type ProgrammeWithLines = Programme & {
  matieres: ProgrammeMatiere[];
};

type SensitiveChange = {
  entityType: "programme" | "programme_matiere";
  entityId?: string | null;
  action: string;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
};

const PROGRAMME_STATUSES = new Set<StatutProgramme>([
  StatutProgramme.DRAFT,
  StatutProgramme.ACTIVE,
  StatutProgramme.IN_REVISION,
  StatutProgramme.LOCKED,
  StatutProgramme.ARCHIVED,
]);

const PROGRAMME_MATIERE_STATUSES = new Set<StatutProgrammeMatiere>([
  StatutProgrammeMatiere.ACTIVE,
  StatutProgrammeMatiere.INACTIVE,
  StatutProgrammeMatiere.DISABLED,
]);

const CALCULATION_MODES = new Set<PedagogicalCalculationMode>([
  PedagogicalCalculationMode.NONE,
  PedagogicalCalculationMode.SIMPLE_AVERAGE,
  PedagogicalCalculationMode.WEIGHTED_AVERAGE,
  PedagogicalCalculationMode.SUM,
  PedagogicalCalculationMode.MANUAL,
]);

const SENSITIVE_PROGRAMME_FIELDS = new Set([
  "code",
  "statut",
  "annee_scolaire_id",
  "niveau_scolaire_id",
  "default_grading_scale_id",
  "date_debut",
  "date_fin",
  "est_actif",
]);

const SENSITIVE_PROGRAMME_MATIERE_FIELDS = new Set([
  "coefficient",
  "heures_semaine",
  "heures_annuelles",
  "seances_par_semaine",
  "duree_seance_par_defaut",
  "est_visible_bulletin",
  "inclure_moyenne_generale",
  "grading_scale_id",
  "mode_calcul",
  "statut",
]);

function parseNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized : null;
}

function parseRequiredString(value: unknown, message: string) {
  const normalized = parseNullableString(value);
  if (!normalized) {
    throw new Error(message);
  }
  return normalized;
}

function parseNullableInt(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${label} doit etre un entier superieur ou egal a zero.`);
  }
  return number;
}

function parseNullableFloat(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} doit etre superieur ou egal a zero.`);
  }
  return number;
}

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function parseDate(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} est invalide.`);
  }
  return date;
}

function normalizeProgrammeStatus(value: unknown, fallback: StatutProgramme) {
  const normalized = parseNullableString(value)?.toUpperCase();
  if (!normalized) return fallback;
  if (!PROGRAMME_STATUSES.has(normalized as StatutProgramme)) {
    throw new Error("Le statut du programme est invalide.");
  }
  return normalized as StatutProgramme;
}

function normalizeProgrammeMatiereStatus(
  value: unknown,
  fallback: StatutProgrammeMatiere,
) {
  const normalized = parseNullableString(value)?.toUpperCase();
  if (!normalized) return fallback;
  if (!PROGRAMME_MATIERE_STATUSES.has(normalized as StatutProgrammeMatiere)) {
    throw new Error("Le statut de la matiere de programme est invalide.");
  }
  return normalized as StatutProgrammeMatiere;
}

function normalizeCalculationMode(
  value: unknown,
  fallback: PedagogicalCalculationMode,
) {
  const normalized = parseNullableString(value)?.toUpperCase();
  if (!normalized) return fallback;
  if (!CALCULATION_MODES.has(normalized as PedagogicalCalculationMode)) {
    throw new Error("Le mode de calcul selectionne est invalide.");
  }
  return normalized as PedagogicalCalculationMode;
}

function stringifyComparableDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function areValuesEqual(left: unknown, right: unknown) {
  if (left instanceof Date || right instanceof Date) {
    return stringifyComparableDate(left as Date | string | null | undefined) ===
      stringifyComparableDate(right as Date | string | null | undefined);
  }
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function getPublishedBulletinWhere(classIds: string[]) {
  return {
    classe_id: { in: classIds },
    OR: [
      { publie_le: { not: null } },
      { statut: { in: ["PUBLISHED", "PUBLIE"] } },
    ],
  };
}

function getValidatedBulletinWhere(classIds: string[]) {
  return {
    classe_id: { in: classIds },
    statut: { in: ["VALIDATED", "VALIDE"] },
    publie_le: null,
  };
}

function toNullableJsonInput(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

class ProgrammeApp {
  public app: Application;
  public router: Router;
  private programme: ProgrammeModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.programme = new ProgrammeModel();
    this.prisma = prisma;
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.get("/:id/change-logs", this.getChangeLogs.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));
    this.router.patch("/:id", this.update.bind(this));
    this.router.post("/:id/analyze-impact", this.analyzeImpact.bind(this));
    this.router.post("/:id/change-status", this.changeStatus.bind(this));
    this.router.post("/:id/lock", this.lock.bind(this));
    this.router.post("/:id/archive", this.archive.bind(this));
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

  private isSystemAdmin(req: Request) {
    const user = (req as Request & { user?: unknown }).user as
      | Parameters<typeof extractRoleNamesFromUser>[0]
      | undefined;
    if (!user) return false;
    return hasSystemAdminRoleNames(extractRoleNamesFromUser(user));
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

  private normalizeProgrammeMatiereLines(raw: unknown): ProgrammeMatierePayload[] {
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error("Le programme doit contenir au moins une matiere.");
    }

    const normalizedLines = raw.map((entry) => {
      const source = typeof entry === "object" && entry !== null ? entry : {};
      const matiere_id = parseRequiredString(
        (source as { matiere_id?: unknown }).matiere_id,
        "Chaque ligne de programme doit referencer une matiere.",
      );

      return {
        matiere_id,
        heures_semaine: parseNullableInt(
          (source as { heures_semaine?: unknown }).heures_semaine,
          "Le volume horaire hebdomadaire",
        ),
        heures_annuelles: parseNullableInt(
          (source as { heures_annuelles?: unknown }).heures_annuelles,
          "Le volume horaire annuel",
        ),
        seances_par_semaine: parseNullableInt(
          (source as { seances_par_semaine?: unknown }).seances_par_semaine,
          "Le nombre de seances par semaine",
        ),
        duree_seance_par_defaut: parseNullableInt(
          (source as { duree_seance_par_defaut?: unknown }).duree_seance_par_defaut,
          "La duree de seance par defaut",
        ),
        coefficient: parseNullableFloat(
          (source as { coefficient?: unknown }).coefficient,
          "Le coefficient",
        ),
        est_obligatoire: parseBoolean(
          (source as { est_obligatoire?: unknown }).est_obligatoire,
          true,
        ),
        est_visible_bulletin: parseBoolean(
          (source as { est_visible_bulletin?: unknown }).est_visible_bulletin,
          true,
        ),
        inclure_moyenne_generale: parseBoolean(
          (source as { inclure_moyenne_generale?: unknown }).inclure_moyenne_generale,
          true,
        ),
        appreciation_obligatoire: parseBoolean(
          (source as { appreciation_obligatoire?: unknown }).appreciation_obligatoire,
          false,
        ),
        libelle_bulletin: parseNullableString(
          (source as { libelle_bulletin?: unknown }).libelle_bulletin,
        ),
        ordre_affichage_bulletin: parseNullableInt(
          (source as { ordre_affichage_bulletin?: unknown }).ordre_affichage_bulletin,
          "L'ordre d'affichage bulletin",
        ),
        grading_scale_id: parseNullableString(
          (source as { grading_scale_id?: unknown }).grading_scale_id,
        ),
        mode_calcul: normalizeCalculationMode(
          (source as { mode_calcul?: unknown }).mode_calcul,
          PedagogicalCalculationMode.WEIGHTED_AVERAGE,
        ),
        statut: normalizeProgrammeMatiereStatus(
          (source as { statut?: unknown }).statut,
          StatutProgrammeMatiere.ACTIVE,
        ),
      };
    });

    const ids = normalizedLines.map((line) => line.matiere_id);
    if (new Set(ids).size !== ids.length) {
      throw new Error("Cette matiere existe deja dans ce programme.");
    }

    return normalizedLines;
  }

  private normalizePayload(
    raw: Record<string, unknown>,
    tenantId: string,
    activeYearId: string,
    existing?: ProgrammeWithLines | null,
  ): ProgrammePayload {
    const nom = parseRequiredString(
      raw.nom ?? existing?.nom,
      "Le nom du programme est requis.",
    );
    const annee_scolaire_id = parseRequiredString(
      raw.annee_scolaire_id ?? existing?.annee_scolaire_id ?? activeYearId,
      "L'annee scolaire du programme est requise.",
    );
    const niveau_scolaire_id = parseRequiredString(
      raw.niveau_scolaire_id ?? existing?.niveau_scolaire_id,
      "Le niveau scolaire du programme est requis.",
    );
    const matieres =
      raw.matieres !== undefined
        ? this.normalizeProgrammeMatiereLines(raw.matieres)
        : existing?.matieres?.map((line) => ({
            matiere_id: line.matiere_id,
            heures_semaine: line.heures_semaine ?? null,
            heures_annuelles: line.heures_annuelles ?? null,
            seances_par_semaine: line.seances_par_semaine ?? null,
            duree_seance_par_defaut: line.duree_seance_par_defaut ?? null,
            coefficient: line.coefficient ?? null,
            est_obligatoire: line.est_obligatoire,
            est_visible_bulletin: line.est_visible_bulletin,
            inclure_moyenne_generale: line.inclure_moyenne_generale,
            appreciation_obligatoire: line.appreciation_obligatoire,
            libelle_bulletin: line.libelle_bulletin ?? null,
            ordre_affichage_bulletin: line.ordre_affichage_bulletin ?? null,
            grading_scale_id: line.grading_scale_id ?? null,
            mode_calcul: line.mode_calcul,
            statut: line.statut,
          })) ?? [];

    if (annee_scolaire_id !== activeYearId) {
      throw new Error("Le programme doit appartenir a l'annee scolaire courante.");
    }

    const date_debut = parseDate(raw.date_debut ?? existing?.date_debut, "La date de debut");
    const date_fin = parseDate(raw.date_fin ?? existing?.date_fin, "La date de fin");

    if (date_debut && date_fin && date_fin.getTime() < date_debut.getTime()) {
      throw new Error("La date de fin du programme doit etre posterieure a la date de debut.");
    }

    return {
      etablissement_id: tenantId,
      annee_scolaire_id,
      niveau_scolaire_id,
      code: parseNullableString(raw.code ?? existing?.code),
      nom,
      description: parseNullableString(raw.description ?? existing?.description),
      statut: normalizeProgrammeStatus(raw.statut ?? existing?.statut, existing?.statut ?? StatutProgramme.DRAFT),
      date_debut,
      date_fin,
      est_actif: parseBoolean(raw.est_actif ?? existing?.est_actif, existing?.est_actif ?? false),
      ordre_affichage:
        parseNullableInt(
          raw.ordre_affichage ?? existing?.ordre_affichage ?? 0,
          "L'ordre d'affichage",
        ) ?? 0,
      default_grading_scale_id: parseNullableString(
        raw.default_grading_scale_id ?? existing?.default_grading_scale_id,
      ),
      reason: parseNullableString(raw.reason),
      confirm_sensitive_changes: parseBoolean(raw.confirm_sensitive_changes, false),
      recalculate_draft_report_cards: parseBoolean(
        raw.recalculate_draft_report_cards,
        false,
      ),
      regenerate_unpublished_bulletins: parseBoolean(
        raw.regenerate_unpublished_bulletins,
        false,
      ),
      sync_existing_courses_mode: parseNullableString(raw.sync_existing_courses_mode),
      matieres,
    };
  }

  private async validateReferences(payload: ProgrammePayload): Promise<void> {
    const gradingScaleIds = uniqueStrings([
      payload.default_grading_scale_id,
      ...payload.matieres.map((line) => line.grading_scale_id),
    ]);

    const [annee, niveau, matieres, gradingScales] = await Promise.all([
      this.prisma.anneeScolaire.findFirst({
        where: {
          id: payload.annee_scolaire_id,
          etablissement_id: payload.etablissement_id,
          est_active: true,
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
      gradingScaleIds.length > 0
        ? this.prisma.gradingScale.findMany({
            where: {
              id: { in: gradingScaleIds },
              etablissement_id: payload.etablissement_id,
              annee_scolaire_id: payload.annee_scolaire_id,
            },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    if (!annee) {
      throw new Error("Aucune année scolaire courante n’est définie.");
    }

    if (!niveau) {
      throw new Error("Le niveau scolaire selectionne n'appartient pas a l'etablissement actif.");
    }

    if (matieres.length !== payload.matieres.length) {
      throw new Error("La matiere selectionnee est invalide.");
    }

    if (gradingScales.length !== gradingScaleIds.length) {
      throw new Error("L'echelle de notation selectionnee est invalide.");
    }
  }

  private async ensureUniqueProgramme(payload: ProgrammePayload, excludeId?: string) {
    const [sameName, sameCode] = await Promise.all([
      this.prisma.programme.findFirst({
        where: {
          etablissement_id: payload.etablissement_id,
          annee_scolaire_id: payload.annee_scolaire_id,
          niveau_scolaire_id: payload.niveau_scolaire_id,
          nom: payload.nom,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      }),
      payload.code
        ? this.prisma.programme.findFirst({
            where: {
              etablissement_id: payload.etablissement_id,
              annee_scolaire_id: payload.annee_scolaire_id,
              code: payload.code,
              ...(excludeId ? { id: { not: excludeId } } : {}),
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (sameName) {
      throw new Error(
        "Un programme portant ce nom existe deja pour cette annee scolaire et ce niveau.",
      );
    }

    if (sameCode) {
      throw new Error("Le code du programme doit etre unique pour l'annee scolaire.");
    }
  }

  private programmeInclude() {
    return {
      annee: true,
      niveau: true,
      defaultGradingScale: true,
      matieres: {
        include: {
          matiere: {
            include: {
              departement: true,
            },
          },
          gradingScale: true,
        },
        orderBy: [
          { ordre_affichage_bulletin: "asc" as const },
          { created_at: "asc" as const },
        ],
      },
    };
  }

  private async getScopedProgramme(id: string, tenantId: string) {
    return this.prisma.programme.findFirst({
      where: {
        id,
        etablissement_id: tenantId,
      },
      include: this.programmeInclude(),
    }) as Promise<ProgrammeWithLines | null>;
  }

  private async analyzeProgrammeImpact(
    tenantId: string,
    programme: Pick<ProgrammePayload, "annee_scolaire_id" | "niveau_scolaire_id" | "matieres">,
  ): Promise<ImpactSummary> {
    const subjectIds = uniqueStrings(programme.matieres.map((line) => line.matiere_id));

    const classes = await this.prisma.classe.findMany({
      where: {
        etablissement_id: tenantId,
        annee_scolaire_id: programme.annee_scolaire_id,
        niveau_scolaire_id: programme.niveau_scolaire_id,
      },
      select: { id: true },
    });

    const classIds = classes.map((item) => item.id);
    const studentsCount =
      classIds.length > 0
        ? await this.prisma.inscription.count({
            where: {
              annee_scolaire_id: programme.annee_scolaire_id,
              classe_id: { in: classIds },
              statut: { in: [...ACTIVE_ACADEMIC_ENROLLMENT_STATUSES] },
            },
          })
        : 0;

    const courseRecords =
      classIds.length > 0 && subjectIds.length > 0
        ? await this.prisma.cours.findMany({
            where: {
              etablissement_id: tenantId,
              annee_scolaire_id: programme.annee_scolaire_id,
              classe_id: { in: classIds },
              matiere_id: { in: subjectIds },
            },
            select: {
              id: true,
              enseignant_id: true,
              matiere_id: true,
            },
          })
        : [];

    const courseIds = courseRecords.map((item) => item.id);
    const teacherIds = uniqueStrings(courseRecords.map((item) => item.enseignant_id));
    const usedSubjectIds = uniqueStrings(courseRecords.map((item) => item.matiere_id));

    const [evaluationsCount, notesCount, assessmentResultsCount, totalBulletinsCount, validatedReportCardsCount, publishedReportCardsCount] =
      await Promise.all([
        courseIds.length > 0
          ? this.prisma.evaluation.count({
              where: {
                cours_id: { in: courseIds },
              },
            })
          : Promise.resolve(0),
        courseIds.length > 0
          ? this.prisma.note.count({
              where: {
                evaluation: {
                  cours_id: { in: courseIds },
                },
              },
            })
          : Promise.resolve(0),
        courseIds.length > 0
          ? this.prisma.assessmentResult.count({
              where: {
                assessment: {
                  cours_id: { in: courseIds },
                },
              },
            })
          : Promise.resolve(0),
        classIds.length > 0
          ? this.prisma.bulletin.count({
              where: {
                classe_id: { in: classIds },
              },
            })
          : Promise.resolve(0),
        classIds.length > 0
          ? this.prisma.bulletin.count({
              where: getValidatedBulletinWhere(classIds),
            })
          : Promise.resolve(0),
        classIds.length > 0
          ? this.prisma.bulletin.count({
              where: getPublishedBulletinWhere(classIds),
            })
          : Promise.resolve(0),
      ]);

    const draftReportCardsCount = Math.max(
      0,
      totalBulletinsCount - validatedReportCardsCount - publishedReportCardsCount,
    );

    return {
      classesCount: classIds.length,
      generatedCoursesCount: courseIds.length,
      teachersCount: teacherIds.length,
      studentsCount,
      evaluationsCount,
      notesCount,
      assessmentResultsCount,
      draftReportCardsCount,
      validatedReportCardsCount,
      publishedReportCardsCount,
      usedSubjectIds,
    };
  }

  private buildSensitiveChanges(
    existing: ProgrammeWithLines,
    payload: ProgrammePayload,
  ): SensitiveChange[] {
    const changes: SensitiveChange[] = [];

    const programmeFieldEntries: Array<[keyof ProgrammePayload, unknown, unknown]> = [
      ["code", existing.code, payload.code],
      ["nom", existing.nom, payload.nom],
      ["description", existing.description, payload.description],
      ["statut", existing.statut, payload.statut],
      ["annee_scolaire_id", existing.annee_scolaire_id, payload.annee_scolaire_id],
      ["niveau_scolaire_id", existing.niveau_scolaire_id, payload.niveau_scolaire_id],
      ["date_debut", existing.date_debut, payload.date_debut],
      ["date_fin", existing.date_fin, payload.date_fin],
      ["est_actif", existing.est_actif, payload.est_actif],
      ["ordre_affichage", existing.ordre_affichage, payload.ordre_affichage],
      [
        "default_grading_scale_id",
        existing.default_grading_scale_id,
        payload.default_grading_scale_id,
      ],
    ];

    for (const [fieldName, oldValue, newValue] of programmeFieldEntries) {
      if (!areValuesEqual(oldValue, newValue)) {
        changes.push({
          entityType: "programme",
          entityId: existing.id,
          action: SENSITIVE_PROGRAMME_FIELDS.has(fieldName)
            ? "SENSITIVE_FIELD_UPDATED"
            : "FIELD_UPDATED",
          fieldName,
          oldValue,
          newValue,
        });
      }
    }

    const existingLinesBySubject = new Map(
      existing.matieres.map((line) => [line.matiere_id, line] as const),
    );
    const incomingLinesBySubject = new Map(
      payload.matieres.map((line) => [line.matiere_id, line] as const),
    );

    for (const [subjectId, oldLine] of existingLinesBySubject.entries()) {
      const nextLine = incomingLinesBySubject.get(subjectId);
      if (!nextLine) {
        changes.push({
          entityType: "programme_matiere",
          entityId: oldLine.id,
          action: "SUBJECT_REMOVED",
          fieldName: "matiere_id",
          oldValue: oldLine.matiere_id,
          newValue: null,
        });
        continue;
      }

      const lineComparisons: Array<[keyof ProgrammeMatierePayload, unknown, unknown]> = [
        ["heures_semaine", oldLine.heures_semaine, nextLine.heures_semaine],
        ["heures_annuelles", oldLine.heures_annuelles, nextLine.heures_annuelles],
        ["seances_par_semaine", oldLine.seances_par_semaine, nextLine.seances_par_semaine],
        [
          "duree_seance_par_defaut",
          oldLine.duree_seance_par_defaut,
          nextLine.duree_seance_par_defaut,
        ],
        ["coefficient", oldLine.coefficient, nextLine.coefficient],
        ["est_obligatoire", oldLine.est_obligatoire, nextLine.est_obligatoire],
        ["est_visible_bulletin", oldLine.est_visible_bulletin, nextLine.est_visible_bulletin],
        [
          "inclure_moyenne_generale",
          oldLine.inclure_moyenne_generale,
          nextLine.inclure_moyenne_generale,
        ],
        [
          "appreciation_obligatoire",
          oldLine.appreciation_obligatoire,
          nextLine.appreciation_obligatoire,
        ],
        ["libelle_bulletin", oldLine.libelle_bulletin, nextLine.libelle_bulletin],
        [
          "ordre_affichage_bulletin",
          oldLine.ordre_affichage_bulletin,
          nextLine.ordre_affichage_bulletin,
        ],
        ["grading_scale_id", oldLine.grading_scale_id, nextLine.grading_scale_id],
        ["mode_calcul", oldLine.mode_calcul, nextLine.mode_calcul],
        ["statut", oldLine.statut, nextLine.statut],
      ];

      for (const [fieldName, oldValue, newValue] of lineComparisons) {
        if (!areValuesEqual(oldValue, newValue)) {
          changes.push({
            entityType: "programme_matiere",
            entityId: oldLine.id,
            action: SENSITIVE_PROGRAMME_MATIERE_FIELDS.has(fieldName)
              ? "SENSITIVE_SUBJECT_FIELD_UPDATED"
              : "SUBJECT_FIELD_UPDATED",
            fieldName,
            oldValue,
            newValue,
          });
        }
      }
    }

    for (const [subjectId, line] of incomingLinesBySubject.entries()) {
      if (!existingLinesBySubject.has(subjectId)) {
        changes.push({
          entityType: "programme_matiere",
          action: "SUBJECT_ADDED",
          fieldName: "matiere_id",
          oldValue: null,
          newValue: line.matiere_id,
        });
      }
    }

    return changes;
  }

  private async createChangeLogs(args: {
    tx: PrismaClient;
    programmeId: string;
    actorId: string | null;
    reason: string | null;
    impactSummary: ImpactSummary | null;
    changes: SensitiveChange[];
  }) {
    for (const change of args.changes) {
      await (args.tx as unknown as typeof this.prisma).programmeChangeLog.create({
        data: {
          programme_id: args.programmeId,
          entity_type: change.entityType,
          entity_id: change.entityId ?? null,
          action: change.action,
          field_name: change.fieldName ?? null,
          old_value_json: toNullableJsonInput(change.oldValue),
          new_value_json: toNullableJsonInput(change.newValue),
          reason: args.reason,
          impact_summary_json: toNullableJsonInput(args.impactSummary),
          changed_by_utilisateur_id: args.actorId,
        },
      });
    }
  }

  private async enforceUpdateRules(args: {
    req: Request;
    existing: ProgrammeWithLines;
    payload: ProgrammePayload;
    impact: ImpactSummary;
    changes: SensitiveChange[];
  }) {
    const { req, existing, payload, impact, changes } = args;

    if (existing.statut === StatutProgramme.ARCHIVED) {
      throw new Error("Ce programme est archive et disponible uniquement en lecture.");
    }

    if (existing.statut === StatutProgramme.LOCKED && !this.isSystemAdmin(req)) {
      throw new Error("Ce programme est verrouille et ne peut pas etre modifie.");
    }

    const sensitiveChanges = changes.filter(
      (change) =>
        change.action.startsWith("SENSITIVE_") ||
        change.action === "SUBJECT_REMOVED" ||
        change.action === "SUBJECT_ADDED",
    );

    const isProgramUsed =
      impact.generatedCoursesCount > 0 ||
      impact.evaluationsCount > 0 ||
      impact.notesCount > 0 ||
      impact.assessmentResultsCount > 0 ||
      impact.validatedReportCardsCount > 0 ||
      impact.publishedReportCardsCount > 0;

    if (
      payload.annee_scolaire_id !== existing.annee_scolaire_id &&
      isProgramUsed
    ) {
      throw new Error("L'annee scolaire ne peut pas etre modifiee si le programme est deja utilise.");
    }

    if (
      payload.niveau_scolaire_id !== existing.niveau_scolaire_id &&
      isProgramUsed
    ) {
      throw new Error(
        "Le niveau ne peut pas etre modifie si des cours, evaluations ou bulletins existent.",
      );
    }

    const removedSubjects = changes
      .filter((change) => change.action === "SUBJECT_REMOVED")
      .map((change) => String(change.oldValue ?? ""));

    if (
      removedSubjects.some((subjectId) => impact.usedSubjectIds.includes(subjectId))
    ) {
      throw new Error(
        "Impossible de supprimer cette matiere car des cours ou notes existent. Desactive-la plutot.",
      );
    }

    if (impact.publishedReportCardsCount > 0 && sensitiveChanges.length > 0) {
      throw new Error("Impossible de modifier automatiquement des bulletins deja publies.");
    }

    if (
      impact.validatedReportCardsCount > 0 &&
      sensitiveChanges.length > 0 &&
      !this.isSystemAdmin(req)
    ) {
      throw new Error(
        "Cette modification impacte des bulletins valides et necessite une permission speciale.",
      );
    }

    if (sensitiveChanges.length > 0) {
      if (!payload.confirm_sensitive_changes) {
        throw new Error(
          "Cette modification necessite une confirmation car elle impacte des cours existants.",
        );
      }

      if (!payload.reason) {
        throw new Error("Veuillez indiquer un motif pour cette modification.");
      }
    }
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const payload = this.normalizePayload(req.body as Record<string, unknown>, tenantId, activeYear.id);
      const actorId = getRequestUserId(req);

      await this.validateReferences(payload);
      await this.ensureUniqueProgramme(payload);

      const result = await this.prisma.$transaction(async (tx) => {
        const programme = await tx.programme.create({
          data: {
            etablissement_id: payload.etablissement_id,
            annee_scolaire_id: payload.annee_scolaire_id,
            niveau_scolaire_id: payload.niveau_scolaire_id,
            code: payload.code,
            nom: payload.nom,
            description: payload.description,
            statut: payload.statut,
            date_debut: payload.date_debut,
            date_fin: payload.date_fin,
            est_actif: payload.est_actif,
            ordre_affichage: payload.ordre_affichage,
            default_grading_scale_id: payload.default_grading_scale_id,
            created_by_utilisateur_id: actorId,
            updated_by_utilisateur_id: actorId,
          },
        });

        await tx.programmeMatiere.createMany({
          data: payload.matieres.map((line) => ({
            programme_id: programme.id,
            matiere_id: line.matiere_id,
            heures_semaine: line.heures_semaine,
            heures_annuelles: line.heures_annuelles,
            seances_par_semaine: line.seances_par_semaine,
            duree_seance_par_defaut: line.duree_seance_par_defaut,
            coefficient: line.coefficient,
            est_obligatoire: line.est_obligatoire,
            est_visible_bulletin: line.est_visible_bulletin,
            inclure_moyenne_generale: line.inclure_moyenne_generale,
            appreciation_obligatoire: line.appreciation_obligatoire,
            libelle_bulletin: line.libelle_bulletin,
            ordre_affichage_bulletin: line.ordre_affichage_bulletin,
            grading_scale_id: line.grading_scale_id,
            mode_calcul: line.mode_calcul,
            statut: line.statut,
          })),
        });

        const created = await tx.programme.findUnique({
          where: { id: programme.id },
          include: this.programmeInclude(),
        });

        if (created) {
          await this.createChangeLogs({
            tx: tx as unknown as PrismaClient,
            programmeId: created.id,
            actorId,
            reason: payload.reason,
            impactSummary: null,
            changes: [
              {
                entityType: "programme",
                entityId: created.id,
                action: "PROGRAMME_CREATED",
                newValue: {
                  nom: created.nom,
                  code: created.code,
                  statut: created.statut,
                },
              },
            ],
          });
        }

        return created;
      });

      Response.success(res, "Programme modifie avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation du programme",
        400,
        error as Error,
      );
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedWhere = this.buildScopedWhere(where, tenantId);

      const finalWhere =
        scopedWhere.AND && Array.isArray(scopedWhere.AND)
          ? { AND: [...scopedWhere.AND, { annee_scolaire_id: activeYear.id }] }
          : { AND: [scopedWhere, { annee_scolaire_id: activeYear.id }] };

      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(finalWhere),
        orderBy:
          req.query.orderBy ?? JSON.stringify([{ ordre_affichage: "asc" }, { created_at: "desc" }]),
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
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;

      const result = await this.getScopedProgramme(id, tenantId);

      if (!result) {
        throw new Error("Programme introuvable pour cet etablissement.");
      }

      const impact = await this.analyzeProgrammeImpact(tenantId, {
        annee_scolaire_id: result.annee_scolaire_id,
        niveau_scolaire_id: result.niveau_scolaire_id,
        matieres: result.matieres.map((line) => ({
          matiere_id: line.matiere_id,
          heures_semaine: line.heures_semaine ?? null,
          heures_annuelles: line.heures_annuelles ?? null,
          seances_par_semaine: line.seances_par_semaine ?? null,
          duree_seance_par_defaut: line.duree_seance_par_defaut ?? null,
          coefficient: line.coefficient ?? null,
          est_obligatoire: line.est_obligatoire,
          est_visible_bulletin: line.est_visible_bulletin,
          inclure_moyenne_generale: line.inclure_moyenne_generale,
          appreciation_obligatoire: line.appreciation_obligatoire,
          libelle_bulletin: line.libelle_bulletin ?? null,
          ordre_affichage_bulletin: line.ordre_affichage_bulletin ?? null,
          grading_scale_id: line.grading_scale_id ?? null,
          mode_calcul: line.mode_calcul,
          statut: line.statut,
        })),
      });

      Response.success(res, "Detail du programme.", {
        ...result,
        impact,
      });
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation du programme",
        404,
        error as Error,
      );
    }
  }

  private async analyzeImpact(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const existing = await this.getScopedProgramme(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Programme introuvable pour cet etablissement.");
      }

      const payload = this.normalizePayload(
        req.body as Record<string, unknown>,
        tenantId,
        activeYear.id,
        existing,
      );
      await this.validateReferences(payload);

      const impact = await this.analyzeProgrammeImpact(tenantId, payload);
      const changes = this.buildSensitiveChanges(existing, payload);

      Response.success(res, "Analyse d'impact du programme.", {
        impact,
        changes,
        requiresConfirmation: changes.some(
          (change) =>
            change.action.startsWith("SENSITIVE_") ||
            change.action === "SUBJECT_REMOVED" ||
            change.action === "SUBJECT_ADDED",
        ),
      });
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de l'analyse d'impact du programme",
        400,
        error as Error,
      );
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

      if (existing.statut === StatutProgramme.ARCHIVED) {
        throw new Error("Ce programme est archive et disponible uniquement en lecture.");
      }

      if (existing.statut === StatutProgramme.LOCKED && !this.isSystemAdmin(req)) {
        throw new Error("Ce programme est verrouille et ne peut pas etre modifie.");
      }

      const impact = await this.analyzeProgrammeImpact(tenantId, {
        annee_scolaire_id: existing.annee_scolaire_id,
        niveau_scolaire_id: existing.niveau_scolaire_id,
        matieres: existing.matieres.map((line) => ({
          matiere_id: line.matiere_id,
          heures_semaine: line.heures_semaine ?? null,
          heures_annuelles: line.heures_annuelles ?? null,
          seances_par_semaine: line.seances_par_semaine ?? null,
          duree_seance_par_defaut: line.duree_seance_par_defaut ?? null,
          coefficient: line.coefficient ?? null,
          est_obligatoire: line.est_obligatoire,
          est_visible_bulletin: line.est_visible_bulletin,
          inclure_moyenne_generale: line.inclure_moyenne_generale,
          appreciation_obligatoire: line.appreciation_obligatoire,
          libelle_bulletin: line.libelle_bulletin ?? null,
          ordre_affichage_bulletin: line.ordre_affichage_bulletin ?? null,
          grading_scale_id: line.grading_scale_id ?? null,
          mode_calcul: line.mode_calcul,
          statut: line.statut,
        })),
      });

      if (
        impact.generatedCoursesCount > 0 ||
        impact.evaluationsCount > 0 ||
        impact.notesCount > 0 ||
        impact.assessmentResultsCount > 0 ||
        impact.validatedReportCardsCount > 0 ||
        impact.publishedReportCardsCount > 0
      ) {
        throw new Error(
          "Impossible de supprimer cette matiere car des cours ou notes existent.",
        );
      }

      const actorId = getRequestUserId(req);

      const result = await this.prisma.$transaction(async (tx) => {
        await this.createChangeLogs({
          tx: tx as unknown as PrismaClient,
          programmeId: id,
          actorId,
          reason: parseNullableString(req.body?.reason),
          impactSummary: impact,
          changes: [
            {
              entityType: "programme",
              entityId: id,
              action: "PROGRAMME_DELETED",
              oldValue: {
                nom: existing.nom,
                code: existing.code,
              },
            },
          ],
        });

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
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const id = req.params.id;
      const existing = await this.getScopedProgramme(id, tenantId);

      if (!existing) {
        throw new Error("Programme introuvable pour cet etablissement.");
      }

      const payload = this.normalizePayload(
        req.body as Record<string, unknown>,
        tenantId,
        activeYear.id,
        existing,
      );

      await this.validateReferences(payload);
      await this.ensureUniqueProgramme(payload, id);

      const impact = await this.analyzeProgrammeImpact(tenantId, payload);
      const changes = this.buildSensitiveChanges(existing, payload);
      await this.enforceUpdateRules({
        req,
        existing,
        payload,
        impact,
        changes,
      });

      const actorId = getRequestUserId(req);

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.programme.update({
          where: { id },
          data: {
            etablissement_id: payload.etablissement_id,
            annee_scolaire_id: payload.annee_scolaire_id,
            niveau_scolaire_id: payload.niveau_scolaire_id,
            code: payload.code,
            nom: payload.nom,
            description: payload.description,
            statut: payload.statut,
            date_debut: payload.date_debut,
            date_fin: payload.date_fin,
            est_actif: payload.est_actif,
            ordre_affichage: payload.ordre_affichage,
            default_grading_scale_id: payload.default_grading_scale_id,
            updated_by_utilisateur_id: actorId,
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
            heures_annuelles: line.heures_annuelles,
            seances_par_semaine: line.seances_par_semaine,
            duree_seance_par_defaut: line.duree_seance_par_defaut,
            coefficient: line.coefficient,
            est_obligatoire: line.est_obligatoire,
            est_visible_bulletin: line.est_visible_bulletin,
            inclure_moyenne_generale: line.inclure_moyenne_generale,
            appreciation_obligatoire: line.appreciation_obligatoire,
            libelle_bulletin: line.libelle_bulletin,
            ordre_affichage_bulletin: line.ordre_affichage_bulletin,
            grading_scale_id: line.grading_scale_id,
            mode_calcul: line.mode_calcul,
            statut: line.statut,
          })),
        });

        await this.createChangeLogs({
          tx: tx as unknown as PrismaClient,
          programmeId: id,
          actorId,
          reason: payload.reason,
          impactSummary: impact,
          changes,
        });

        return tx.programme.findUnique({
          where: { id },
          include: this.programmeInclude(),
        });
      });

      Response.success(res, "Programme modifie avec succes.", {
        ...result,
        impact,
      });
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour du programme",
        400,
        error as Error,
      );
    }
  }

  private async changeStatus(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedProgramme(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Programme introuvable pour cet etablissement.");
      }

      const nextStatus = normalizeProgrammeStatus(
        req.body?.statut,
        existing.statut,
      );
      const reason = parseNullableString(req.body?.reason);

      if (existing.statut === StatutProgramme.ARCHIVED) {
        throw new Error("Ce programme est archive et disponible uniquement en lecture.");
      }

      if (
        existing.statut === StatutProgramme.LOCKED &&
        nextStatus !== StatutProgramme.LOCKED &&
        !this.isSystemAdmin(req)
      ) {
        throw new Error("Ce programme est verrouille et ne peut pas etre modifie.");
      }

      if (nextStatus !== existing.statut && !reason) {
        throw new Error("Veuillez indiquer un motif pour cette modification.");
      }

      const actorId = getRequestUserId(req);

      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.programme.update({
          where: { id: existing.id },
          data: {
            statut: nextStatus,
            est_actif: nextStatus === StatutProgramme.ACTIVE ? true : existing.est_actif,
            verrouille_le:
              nextStatus === StatutProgramme.LOCKED ? new Date() : existing.verrouille_le,
            archive_le:
              nextStatus === StatutProgramme.ARCHIVED ? new Date() : existing.archive_le,
            updated_by_utilisateur_id: actorId,
          },
          include: this.programmeInclude(),
        });

        await this.createChangeLogs({
          tx: tx as unknown as PrismaClient,
          programmeId: existing.id,
          actorId,
          reason,
          impactSummary: null,
          changes: [
            {
              entityType: "programme",
              entityId: existing.id,
              action: "STATUS_CHANGED",
              fieldName: "statut",
              oldValue: existing.statut,
              newValue: nextStatus,
            },
          ],
        });

        return updated;
      });

      Response.success(res, "Programme modifie avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors du changement de statut du programme",
        400,
        error as Error,
      );
    }
  }

  private async lock(req: Request, res: R, next: NextFunction): Promise<void> {
    req.body = {
      ...(req.body ?? {}),
      statut: StatutProgramme.LOCKED,
    };
    await this.changeStatus(req, res, next);
  }

  private async archive(req: Request, res: R, next: NextFunction): Promise<void> {
    req.body = {
      ...(req.body ?? {}),
      statut: StatutProgramme.ARCHIVED,
    };
    await this.changeStatus(req, res, next);
  }

  private async getChangeLogs(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedProgramme(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Programme introuvable pour cet etablissement.");
      }

      const result = await this.prisma.programmeChangeLog.findMany({
        where: {
          programme_id: existing.id,
        },
        include: {
          changedBy: {
            include: {
              profil: true,
            },
          },
        },
        orderBy: {
          changed_at: "desc",
        },
      });

      Response.success(res, "Historique du programme.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation de l'historique du programme",
        400,
        error as Error,
      );
    }
  }
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

export default ProgrammeApp;
