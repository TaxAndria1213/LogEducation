import Service from "../app/api/Service";
import type { PresenceEleve } from "../types/models";
import { getEleveDisplayLabel, type EleveWithRelations } from "./note.service";
import {
  getSessionAppelDisplayLabel,
  type SessionAppelWithRelations,
} from "./sessionAppel.service";

type QueryParams = Record<string, unknown>;

export type PresenceEleveWithRelations = PresenceEleve & {
  session?: SessionAppelWithRelations | null;
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

export function getPresenceStatusMeta(statut?: string | null) {
  switch ((statut ?? "").toUpperCase()) {
    case "PRESENT":
      return { label: "Present", tone: "bg-emerald-100 text-emerald-700" };
    case "ABSENT":
      return { label: "Absent", tone: "bg-rose-100 text-rose-700" };
    case "RETARD":
      return { label: "Retard", tone: "bg-amber-100 text-amber-700" };
    case "EXCUSE":
      return { label: "Excuse", tone: "bg-sky-100 text-sky-700" };
    default:
      return { label: "Non defini", tone: "bg-slate-100 text-slate-700" };
  }
}

export function getPresenceEleveDisplayLabel(record?: Partial<PresenceEleveWithRelations> | null) {
  if (!record) return "Presence non renseignee";
  return getEleveDisplayLabel(record.eleve);
}

export function getPresenceEleveSecondaryLabel(record?: Partial<PresenceEleveWithRelations> | null) {
  if (!record) return "";
  const session = getSessionAppelDisplayLabel(record.session);
  const minutes = typeof record.minutes_retard === "number" && record.minutes_retard > 0
    ? `${record.minutes_retard} min`
    : "";
  return [session, minutes].filter(Boolean).join(" • ");
}

class PresenceEleveService extends Service {
  constructor() {
    super("presence-eleve");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy: typeof params.orderBy === "string" ? params.orderBy : JSON.stringify(params.orderBy ?? [{ created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { session: { classe: { etablissement_id: etablissementId } } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default PresenceEleveService;
