import Service from "../app/api/Service";
import type { IncidentDisciplinaire } from "../types/models";
import { getEleveDisplayLabel, type EleveWithRelations } from "./note.service";

type QueryParams = Record<string, unknown>;

export type IncidentDisciplinaireWithRelations = IncidentDisciplinaire & {
  eleve?: EleveWithRelations | null;
  sanctions?: Array<{
    id: string;
    type_action?: string | null;
    debut?: Date | string | null;
    fin?: Date | string | null;
  }>;
};

function parseObjectParam(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value === "object") return value as Record<string, unknown>;
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

export function getIncidentStatusMeta(statut?: string | null) {
  switch ((statut ?? "").toUpperCase()) {
    case "RESOLU":
      return { label: "Resolue", tone: "bg-emerald-100 text-emerald-700" };
    case "CLOS":
      return { label: "Cloture", tone: "bg-slate-200 text-slate-700" };
    case "EN_COURS":
      return { label: "En cours", tone: "bg-amber-100 text-amber-700" };
    default:
      return { label: "Ouvert", tone: "bg-rose-100 text-rose-700" };
    }
}

export function getIncidentSeverityLabel(gravite?: number | null) {
  if (gravite == null) return "Gravite non renseignee";
  return `Gravite ${gravite}/5`;
}

export function getIncidentDisplayLabel(record?: Partial<IncidentDisciplinaireWithRelations> | null) {
  if (!record) return "Incident non renseigne";
  return getEleveDisplayLabel(record.eleve);
}

export function getIncidentSecondaryLabel(record?: Partial<IncidentDisciplinaireWithRelations> | null) {
  if (!record) return "";
  const description = record.description?.trim() ?? "";
  const shortDescription =
    description.length > 90 ? `${description.slice(0, 87)}...` : description;
  return [getIncidentSeverityLabel(record.gravite), shortDescription]
    .filter(Boolean)
    .join(" • ");
}

class IncidentDisciplinaireService extends Service {
  constructor() {
    super("incident-disciplinaire");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ date: "desc" }, { created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { eleve: { etablissement_id: etablissementId } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default IncidentDisciplinaireService;
