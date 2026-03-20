import Service from "../app/api/Service";
import type { MotifAbsence } from "../types/models";

type QueryParams = Record<string, unknown>;

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

export function getMotifAbsenceDisplayLabel(motif?: Partial<MotifAbsence> | null) {
  if (!motif) return "Motif non renseigne";
  return motif.nom?.trim() || "Motif non renseigne";
}

class MotifAbsenceService extends Service {
  constructor() {
    super("motif-absence");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy: typeof params.orderBy === "string" ? params.orderBy : JSON.stringify(params.orderBy ?? [{ nom: "asc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { etablissement_id: etablissementId };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default MotifAbsenceService;
