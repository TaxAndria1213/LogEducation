import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
import type { Emprunt, RessourceBibliotheque } from "../types/models";
import { getRessourceBibliothequeDisplayLabel } from "./ressourceBibliotheque.service";

type QueryParams = Record<string, unknown>;

export type EmpruntBibliothequeWithRelations = Emprunt & {
  ressource?: RessourceBibliotheque | null;
  eleve?: {
    id: string;
    code_eleve?: string | null;
    utilisateur?: {
      profil?: {
        prenom?: string | null;
        nom?: string | null;
      } | null;
    } | null;
  } | null;
  personnel?: {
    id: string;
    matricule?: string | null;
    utilisateur?: {
      profil?: {
        prenom?: string | null;
        nom?: string | null;
      } | null;
    } | null;
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

function getPersonLabel(
  profil?: { prenom?: string | null; nom?: string | null } | null,
  fallback?: string | null,
) {
  const label = [profil?.prenom, profil?.nom].filter(Boolean).join(" ").trim();
  return label || fallback || "Emprunteur";
}

export function getBorrowerLabel(record?: Partial<EmpruntBibliothequeWithRelations> | null) {
  if (!record) return "Emprunteur non renseigne";
  if (record.eleve) {
    return getPersonLabel(record.eleve.utilisateur?.profil, record.eleve.code_eleve ?? "Eleve");
  }
  if (record.personnel) {
    return getPersonLabel(
      record.personnel.utilisateur?.profil,
      record.personnel.matricule ?? "Personnel",
    );
  }
  return "Emprunteur non renseigne";
}

export function getEmpruntDisplayLabel(record?: Partial<EmpruntBibliothequeWithRelations> | null) {
  if (!record) return "Emprunt";
  return `${getRessourceBibliothequeDisplayLabel(record.ressource)} - ${getBorrowerLabel(record)}`;
}

export function getEmpruntStatus(record?: Partial<EmpruntBibliothequeWithRelations> | null) {
  if (!record) return "EMPRUNTE";
  if (record.retourne_le) return "RETOURNE";
  if (record.du_le) {
    const dueDate = new Date(record.du_le);
    const now = new Date();
    if (!Number.isNaN(dueDate.getTime()) && dueDate.getTime() < now.getTime()) {
      return "EN_RETARD";
    }
  }
  return (record.statut ?? "EMPRUNTE").toUpperCase();
}

export function getEmpruntStatusLabel(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "RETOURNE":
      return "Retourne";
    case "EN_RETARD":
      return "En retard";
    case "EMPRUNTE":
    default:
      return "Emprunte";
  }
}

export function getEmpruntSecondaryLabel(record?: Partial<EmpruntBibliothequeWithRelations> | null) {
  if (!record) return "";
  return [
    record.emprunte_le ? `Emprunte le ${new Date(record.emprunte_le).toLocaleDateString("fr-FR")}` : "",
    record.du_le ? `Retour prevu ${new Date(record.du_le).toLocaleDateString("fr-FR")}` : "",
    getEmpruntStatusLabel(getEmpruntStatus(record)),
  ]
    .filter(Boolean)
    .join(" - ");
}

class EmpruntBibliothequeService extends Service {
  constructor() {
    super("emprunt");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ emprunte_le: "desc" }, { created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  async markAsReturned(id: string, payload: { retourne_le?: string | Date } = {}) {
    return Http.post(["/api", this.url, id, "return"].join("/"), payload);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { ressource: { is: { etablissement_id: etablissementId } } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default EmpruntBibliothequeService;
