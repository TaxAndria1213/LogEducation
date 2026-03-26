import Service from "../app/api/Service";
import type { Emprunt, RessourceBibliotheque } from "../types/models";

type QueryParams = Record<string, unknown>;

export type RessourceBibliothequeWithRelations = RessourceBibliotheque & {
  emprunts?: Emprunt[] | null;
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

export function getRessourceBibliothequeDisplayLabel(
  record?: Partial<RessourceBibliothequeWithRelations> | null,
) {
  if (!record) return "Ressource non renseignee";
  return record.titre?.trim() || "Ressource non renseignee";
}

export function getRessourceTypeLabel(type?: string | null) {
  switch ((type ?? "").toLowerCase()) {
    case "materiel":
      return "Materiel";
    case "livre":
    default:
      return "Livre";
  }
}

export function getRessourceBibliothequeSecondaryLabel(
  record?: Partial<RessourceBibliothequeWithRelations> | null,
) {
  if (!record) return "";
  return [
    record.code ? `Code: ${record.code}` : "",
    getRessourceTypeLabel(record.type),
    record.auteur ? `Auteur: ${record.auteur}` : "",
    record.editeur ? `Editeur: ${record.editeur}` : "",
    record.annee ? `Annee: ${record.annee}` : "",
  ]
    .filter(Boolean)
    .join(" - ");
}

export function getActiveLoansCount(record?: Partial<RessourceBibliothequeWithRelations> | null) {
  return (record?.emprunts ?? []).filter((loan) => !loan?.retourne_le).length;
}

export function getAvailableStock(record?: Partial<RessourceBibliothequeWithRelations> | null) {
  const stock = Number(record?.stock ?? 0);
  return Math.max(0, stock - getActiveLoansCount(record));
}

class RessourceBibliothequeService extends Service {
  constructor() {
    super("ressource-bibliotheque");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ titre: "asc" }, { created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { etablissement_id: etablissementId };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default RessourceBibliothequeService;
