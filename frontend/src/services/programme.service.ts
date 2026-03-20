import Service from "../app/api/Service";
import type {
  AnneeScolaire,
  Matiere,
  NiveauScolaire,
  Programme,
} from "../types/models";
import { getMatiereDisplayLabel } from "./matiere.service";

type QueryParams = Record<string, unknown>;

export type ProgrammeLine = {
  id?: string;
  matiere_id: string;
  heures_semaine: number | null;
  coefficient: number | null;
  matiere?: (Matiere & {
    departement?: {
      id: string;
      nom: string;
    } | null;
  }) | null;
};

export type ProgrammeWithRelations = Programme & {
  annee?: Pick<AnneeScolaire, "id" | "nom" | "est_active"> | null;
  niveau?: Pick<NiveauScolaire, "id" | "nom"> | null;
  matieres?: ProgrammeLine[];
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
}

export default ProgrammeService;
