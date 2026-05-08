import { Http } from "../app/api/Http";
import Service from "../app/api/Service";
import type { PedagogicalItem, PedagogicalItemType } from "../types/models";

type QueryParams = Record<string, unknown>;

export type PedagogicalItemWithRelations = PedagogicalItem & {
  parent?: {
    id: string;
    nom: string;
  } | null;
  matiere?: {
    id: string;
    nom: string;
  } | null;
  niveau?: {
    id: string;
    nom: string;
  } | null;
  enfants?: PedagogicalItemWithRelations[];
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

export function getPedagogicalItemTypeLabel(type?: PedagogicalItemType | string | null) {
  switch (type) {
    case "GROUP":
      return "Groupe";
    case "DOMAIN":
      return "Domaine";
    case "SUBDOMAIN":
      return "Sous-domaine";
    case "COMPETENCY":
      return "Competence";
    case "OBJECTIVE":
      return "Objectif";
    default:
      return "Matiere";
  }
}

export function getPedagogicalItemDisplayLabel(
  item?: Partial<PedagogicalItemWithRelations> | null,
) {
  if (!item) return "Element pedagogique";
  const parent = item.parent?.nom?.trim() ?? "";
  const nom = item.nom?.trim() ?? "";
  const type = getPedagogicalItemTypeLabel(item.item_type);

  if (parent && nom) return `${parent} > ${nom}`;
  if (nom) return `${nom} (${type})`;
  return type;
}

class PedagogicalItemService extends Service {
  constructor() {
    super("pedagogical-item");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);

    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(
              params.orderBy ?? [{ display_order: "asc" }, { nom: "asc" }],
            ),
    } as Record<string, string | number | Date | boolean>);
  }

  async getTree(params: Record<string, string | number | boolean | null | undefined> = {}) {
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
    );
    return Http.get(
      ["/api", this.url, "tree"].join("/"),
      filteredParams as Record<string, string | number | Date | boolean>,
    );
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

export default PedagogicalItemService;
