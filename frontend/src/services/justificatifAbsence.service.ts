import Service from "../app/api/Service";
import type { JustificatifAbsence } from "../types/models";
import { getEleveDisplayLabel, type EleveWithRelations } from "./note.service";
import { getMotifAbsenceDisplayLabel } from "./motifAbsence.service";

type QueryParams = Record<string, unknown>;

export type JustificatifAbsenceWithRelations = JustificatifAbsence & {
  eleve?: EleveWithRelations | null;
  motif?: {
    id: string;
    nom: string;
    est_excuse_par_defaut: boolean;
  } | null;
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

export function getJustificatifStatusMeta(statut?: string | null) {
  switch ((statut ?? "").toUpperCase()) {
    case "APPROUVE":
      return { label: "Approuve", tone: "bg-emerald-100 text-emerald-700" };
    case "REFUSE":
      return { label: "Refuse", tone: "bg-rose-100 text-rose-700" };
    default:
      return { label: "En attente", tone: "bg-amber-100 text-amber-700" };
  }
}

export function getJustificatifDisplayLabel(record?: Partial<JustificatifAbsenceWithRelations> | null) {
  if (!record) return "Justificatif non renseigne";
  return getEleveDisplayLabel(record.eleve);
}

export function getJustificatifSecondaryLabel(record?: Partial<JustificatifAbsenceWithRelations> | null) {
  if (!record) return "";
  const motif = getMotifAbsenceDisplayLabel(record.motif);
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const start = record.date_debut ? formatter.format(new Date(record.date_debut)) : "";
  const end = record.date_fin ? formatter.format(new Date(record.date_fin)) : "";
  return [motif, start && end ? `${start} - ${end}` : ""].filter(Boolean).join(" • ");
}

class JustificatifAbsenceService extends Service {
  constructor() {
    super("justificatif-absence");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy: typeof params.orderBy === "string" ? params.orderBy : JSON.stringify(params.orderBy ?? [{ date_debut: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { eleve: { etablissement_id: etablissementId } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default JustificatifAbsenceService;
