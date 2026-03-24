import Service from "../app/api/Service";
import type { Recompense } from "../types/models";
import { getEleveDisplayLabel, type EleveWithRelations } from "./note.service";

type QueryParams = Record<string, unknown>;

export type RecompenseWithRelations = Recompense & {
  eleve?: EleveWithRelations | null;
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

export function getRecompenseDisplayLabel(record?: Partial<RecompenseWithRelations> | null) {
  if (!record) return "Recompense non renseignee";
  return getEleveDisplayLabel(record.eleve);
}

export function getRecompenseSecondaryLabel(record?: Partial<RecompenseWithRelations> | null) {
  if (!record) return "";
  return [
    typeof record.points === "number" ? `${record.points} pts` : "",
    record.raison?.trim() ?? "",
  ]
    .filter(Boolean)
    .join(" • ");
}

class RecompenseService extends Service {
  constructor() {
    super("recompense");
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

export default RecompenseService;
