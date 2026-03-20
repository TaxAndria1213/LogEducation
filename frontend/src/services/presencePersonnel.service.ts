import Service from "../app/api/Service";
import type { Personnel, PresencePersonnel } from "../types/models";

type QueryParams = Record<string, unknown>;

export type PersonnelWithRelations = Personnel & {
  utilisateur?: {
    profil?: {
      prenom?: string | null;
      nom?: string | null;
    } | null;
  } | null;
};

export type PresencePersonnelWithRelations = PresencePersonnel & {
  personnel?: PersonnelWithRelations | null;
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

export function getPersonnelDisplayLabel(personnel?: Partial<PersonnelWithRelations> | null) {
  const prenom = personnel?.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = personnel?.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = [prenom, nom].filter(Boolean).join(" ").trim();
  const code = personnel?.code_personnel?.trim() ?? "";
  const poste = personnel?.poste?.trim() ?? "";

  if (code && fullName) return `${code} - ${fullName}`;
  if (fullName) return fullName;
  if (code && poste) return `${code} - ${poste}`;
  if (code) return code;
  if (poste) return poste;
  return "Personnel non renseigne";
}

export function getPresencePersonnelStatusMeta(statut?: string | null) {
  switch ((statut ?? "").toUpperCase()) {
    case "ABSENT":
      return { label: "Absent", tone: "bg-rose-100 text-rose-700" };
    case "RETARD":
      return { label: "Retard", tone: "bg-amber-100 text-amber-700" };
    case "CONGE":
      return { label: "Conge", tone: "bg-sky-100 text-sky-700" };
    default:
      return { label: "Present", tone: "bg-emerald-100 text-emerald-700" };
  }
}

class PresencePersonnelService extends Service {
  constructor() {
    super("presence-personnel");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy: typeof params.orderBy === "string" ? params.orderBy : JSON.stringify(params.orderBy ?? [{ date: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { personnel: { etablissement_id: etablissementId } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default PresencePersonnelService;
