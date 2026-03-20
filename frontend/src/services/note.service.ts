import Service from "../app/api/Service";
import type { Eleve, Note } from "../types/models";
import type { EvaluationWithRelations } from "./evaluation.service";
import { getEvaluationDisplayLabel } from "./evaluation.service";

type QueryParams = Record<string, unknown>;

export type EleveWithRelations = Eleve & {
  utilisateur?: {
    profil?: {
      prenom?: string | null;
      nom?: string | null;
    } | null;
  } | null;
  inscriptions?: Array<{
    id: string;
    classe_id: string;
    annee_scolaire_id: string;
    classe?: {
      id: string;
      nom?: string | null;
    } | null;
  }>;
};

export type NoteWithRelations = Note & {
  evaluation?: EvaluationWithRelations | null;
  eleve?: EleveWithRelations | null;
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

export function getEleveDisplayLabel(eleve?: Partial<EleveWithRelations> | null) {
  if (!eleve) return "Eleve non renseigne";

  const code = eleve.code_eleve?.trim() ?? "";
  const prenom = eleve.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = eleve.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = [prenom, nom].filter(Boolean).join(" ").trim();

  if (code && fullName) return `${code} - ${fullName}`;
  if (fullName) return fullName;
  if (code) return code;
  return "Eleve non renseigne";
}

export function getNotePercentage(note?: Partial<NoteWithRelations> | null) {
  if (!note) return null;
  const score = typeof note.score === "number" ? note.score : null;
  const noteMax = typeof note.evaluation?.note_max === "number" ? note.evaluation.note_max : null;

  if (score === null || noteMax === null || noteMax <= 0) return null;
  return Math.round((score / noteMax) * 1000) / 10;
}

export function getNoteDisplayLabel(note?: Partial<NoteWithRelations> | null) {
  if (!note) return "Note non renseignee";

  const eleve = getEleveDisplayLabel(note.eleve);
  const evaluation = getEvaluationDisplayLabel(note.evaluation);
  return `${eleve} - ${evaluation}`;
}

export function getNoteSecondaryLabel(note?: Partial<NoteWithRelations> | null) {
  if (!note) return "";

  const score = typeof note.score === "number" ? `${note.score}/${note.evaluation?.note_max ?? "-"}` : "";
  const percentage = getNotePercentage(note);
  const evaluation = note.evaluation?.cours?.classe?.nom?.trim() ?? "";

  return [score, percentage !== null ? `${percentage}%` : "", evaluation]
    .filter(Boolean)
    .join(" • ");
}

class NoteService extends Service {
  constructor() {
    super("note");
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
          : JSON.stringify(params.orderBy ?? [{ note_le: "desc" }, { created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);

    const scope = {
      eleve: {
        etablissement_id: etablissementId,
      },
    };

    if (!parsedWhere || Object.keys(parsedWhere).length === 0) {
      return scope;
    }

    return {
      AND: [parsedWhere, scope],
    };
  }
}

export default NoteService;
