import Service from "../app/api/Service";
import type { SanctionDisciplinaire } from "../types/models";
import {
  getIncidentDisplayLabel,
  type IncidentDisciplinaireWithRelations,
} from "./incidentDisciplinaire.service";

type QueryParams = Record<string, unknown>;

export type SanctionDisciplinaireWithRelations = SanctionDisciplinaire & {
  incident?: IncidentDisciplinaireWithRelations | null;
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

export function getSanctionDisplayLabel(record?: Partial<SanctionDisciplinaireWithRelations> | null) {
  if (!record) return "Sanction non renseignee";
  const incident = getIncidentDisplayLabel(record.incident);
  const type = record.type_action?.trim() ?? "Type non renseigne";
  return `${type} - ${incident}`;
}

export function getSanctionSecondaryLabel(record?: Partial<SanctionDisciplinaireWithRelations> | null) {
  if (!record) return "";
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const debut = record.debut ? formatter.format(new Date(record.debut)) : "";
  const fin = record.fin ? formatter.format(new Date(record.fin)) : "";
  const period = debut && fin ? `${debut} - ${fin}` : debut || fin;
  return [period, record.notes?.trim() ?? ""].filter(Boolean).join(" • ");
}

class SanctionDisciplinaireService extends Service {
  constructor() {
    super("sanction-disciplinaire");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
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
    const scope = { incident: { eleve: { etablissement_id: etablissementId } } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default SanctionDisciplinaireService;
