import Service from "../app/api/Service";
import type { AnneeScolaire, Classe, Cours, Enseignant } from "../types/models";
import type { MatiereWithRelations } from "./matiere.service";
import { getMatiereDisplayLabel } from "./matiere.service";

type QueryParams = Record<string, unknown>;

export type ClasseWithRelations = Classe & {
  niveau?: {
    id: string;
    nom: string;
  } | null;
  site?: {
    id: string;
    nom: string;
  } | null;
};

export type EnseignantWithRelations = Enseignant & {
  personnel?: {
    id: string;
    code_personnel?: string | null;
    poste?: string | null;
    utilisateur?: {
      profil?: {
        prenom?: string | null;
        nom?: string | null;
      } | null;
    } | null;
  } | null;
  departement?: {
    id: string;
    nom: string;
  } | null;
};

export type CoursWithRelations = Cours & {
  annee?: Pick<AnneeScolaire, "id" | "nom" | "est_active"> | null;
  classe?: ClasseWithRelations | null;
  matiere?: MatiereWithRelations | null;
  enseignant?: EnseignantWithRelations | null;
  evaluations?: Array<{ id: string }>;
  emploiDuTemps?: Array<{ id: string }>;
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

export function getTeacherDisplayLabel(teacher?: Partial<EnseignantWithRelations> | null) {
  const prenom = teacher?.personnel?.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = teacher?.personnel?.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = [prenom, nom].filter(Boolean).join(" ").trim();
  const code = teacher?.personnel?.code_personnel?.trim() ?? "";
  const poste = teacher?.personnel?.poste?.trim() ?? "";

  if (code && fullName) return `${code} - ${fullName}`;
  if (fullName) return fullName;
  if (code && poste) return `${code} - ${poste}`;
  if (code) return code;
  if (poste) return poste;
  return "Enseignant non renseigne";
}

export function getClasseDisplayLabel(classe?: Partial<ClasseWithRelations> | null) {
  if (!classe) return "Classe non renseignee";

  const nom = classe.nom?.trim() ?? "";
  const niveau = classe.niveau?.nom?.trim() ?? "";
  const site = classe.site?.nom?.trim() ?? "";
  const suffix = [niveau, site].filter(Boolean).join(" • ");

  if (!nom && !suffix) return "Classe non renseignee";
  return suffix ? `${nom || "Classe"} (${suffix})` : nom || "Classe non renseignee";
}

export function getCoursDisplayLabel(cours?: Partial<CoursWithRelations> | null) {
  if (!cours) return "Cours non renseigne";

  const matiere = getMatiereDisplayLabel(cours.matiere);
  const classe = getClasseDisplayLabel(cours.classe);

  if (!cours.matiere && !cours.classe) {
    return "Cours non renseigne";
  }

  if (!cours.classe) return matiere;
  if (!cours.matiere) return classe;
  return `${matiere} - ${classe}`;
}

export function getCoursSecondaryLabel(cours?: Partial<CoursWithRelations> | null) {
  if (!cours) return "";

  const teacher = getTeacherDisplayLabel(cours.enseignant);
  const year = cours.annee?.nom?.trim() ?? "";
  const coefficient =
    typeof cours.coefficient_override === "number"
      ? `Coef. ${cours.coefficient_override}`
      : "";

  return [teacher, year, coefficient].filter(Boolean).join(" • ");
}

class CoursService extends Service {
  constructor() {
    super("cours");
  }

  async getForEtablissement(
    etablissementId: string,
    params: QueryParams = {},
  ) {
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

    if (!parsedWhere || Object.keys(parsedWhere).length === 0) {
      return { etablissement_id: etablissementId };
    }

    return {
      AND: [parsedWhere, { etablissement_id: etablissementId }],
    };
  }
}

export default CoursService;
