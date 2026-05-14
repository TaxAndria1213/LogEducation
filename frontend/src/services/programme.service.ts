import Service from "../app/api/Service";
import type {
  AnneeScolaire,
  Matiere,
  NiveauScolaire,
  Programme,
  GradingScale,
} from "../types/models";
import { getMatiereDisplayLabel } from "./matiere.service";

type QueryParams = Record<string, unknown>;

export type ProgrammeLine = {
  id?: string;
  matiere_id: string;
  heures_semaine: number | null;
  heures_annuelles?: number | null;
  seances_par_semaine?: number | null;
  duree_seance_par_defaut?: number | null;
  coefficient: number | null;
  est_obligatoire?: boolean;
  est_visible_bulletin?: boolean;
  inclure_moyenne_generale?: boolean;
  appreciation_obligatoire?: boolean;
  libelle_bulletin?: string | null;
  ordre_affichage_bulletin?: number | null;
  grading_scale_id?: string | null;
  mode_calcul?: string | null;
  statut?: string | null;
  matiere?: (Matiere & {
    departement?: {
      id: string;
      nom: string;
    } | null;
  }) | null;
  gradingScale?: Pick<GradingScale, "id" | "nom" | "grading_type"> | null;
};

export type ProgrammeWithRelations = Programme & {
  annee?: Pick<AnneeScolaire, "id" | "nom" | "est_active"> | null;
  niveau?: Pick<NiveauScolaire, "id" | "nom"> | null;
  matieres?: ProgrammeLine[];
  defaultGradingScale?: Pick<GradingScale, "id" | "nom" | "grading_type"> | null;
  impact?: ProgrammeImpactSummary | null;
};

export type ProgrammeImpactSummary = {
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

export type ProgrammeSensitiveChange = {
  entityType: "programme" | "programme_matiere";
  entityId?: string | null;
  action: string;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
};

export type ProgrammeImpactAnalysisResponse = {
  impact: ProgrammeImpactSummary;
  changes: ProgrammeSensitiveChange[];
  requiresConfirmation: boolean;
};

function parseObjectParam(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return typeof parsed === "object" && parsed !== null ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function getProgrammeDisplayLabel(
  programme?: Partial<ProgrammeWithRelations> | null,
) {
  if (!programme) return "Programme sans nom";

  const nom = programme.nom?.trim() ?? "";
  const niveau = programme.niveau?.nom?.trim() ?? "";
  const annee = programme.annee?.nom?.trim() ?? "";
  const suffix = [niveau, annee].filter(Boolean).join(" • ");

  return suffix ? `${nom} (${suffix})` : nom || "Programme sans nom";
}

export function getProgrammeMatiereSummary(
  lines?: ProgrammeLine[] | null,
  limit = 3,
) {
  if (!lines || lines.length === 0) return "Aucune matiere";

  const labels = lines
    .slice(0, limit)
    .map((line) => getMatiereDisplayLabel(line.matiere))
    .filter(Boolean);

  if (lines.length > limit) {
    labels.push(`+${lines.length - limit} autre(s)`);
  }

  return labels.join(", ");
}

class ProgrammeService extends Service {
  constructor() {
    super("programme");
  }

  async getForEtablissement(
    etablissementId: string,
    params: QueryParams = {},
  ) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);

    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);

    if (!parsedWhere || Object.keys(parsedWhere).length === 0) {
      return { etablissement_id: etablissementId };
    }

    return {
      AND: [parsedWhere, { etablissement_id: etablissementId }],
    };
  }

  async analyzeImpact(id: string, payload?: Record<string, unknown>) {
    return this.createSubAction(id, "analyze-impact", payload ?? {});
  }

  async changeStatus(id: string, payload: Record<string, unknown>) {
    return this.createSubAction(id, "change-status", payload);
  }

  async lock(id: string, payload: Record<string, unknown> = {}) {
    return this.createSubAction(id, "lock", payload);
  }

  async archive(id: string, payload: Record<string, unknown> = {}) {
    return this.createSubAction(id, "archive", payload);
  }

  async getChangeLogs(id: string) {
    return this.getSubAction(id, "change-logs");
  }

  private async createSubAction(
    id: string,
    action: string,
    payload: Record<string, unknown>,
  ) {
    return this.rawPost(`/${id}/${action}`, payload);
  }

  private async getSubAction(id: string, action: string) {
    return this.rawGet(`/${id}/${action}`);
  }

  private async rawPost(path: string, payload: Record<string, unknown>) {
    const { Http } = await import("../app/api/Http");
    return Http.post(`/api/${this.url}${path}`, payload);
  }

  private async rawGet(path: string) {
    const { Http } = await import("../app/api/Http");
    return Http.get(`/api/${this.url}${path}`, {});
  }
}

export default ProgrammeService;
