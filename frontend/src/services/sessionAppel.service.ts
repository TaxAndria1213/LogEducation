import Service from "../app/api/Service";
import type { Classe, CreneauHoraire, PresenceEleve, SessionAppel } from "../types/models";
import { getClasseDisplayLabel, type EnseignantWithRelations } from "./cours.service";

type QueryParams = Record<string, unknown>;

export type SessionAppelWithRelations = SessionAppel & {
  classe?: (Classe & {
    niveau?: { id: string; nom: string } | null;
    site?: { id: string; nom: string } | null;
    annee?: { id: string; nom: string; date_debut: Date | string; date_fin: Date | string } | null;
  }) | null;
  emploi?: {
    id: string;
    heure_debut?: string | null;
    heure_fin?: string | null;
    cours?: {
      id: string;
      matiere?: { id: string; nom?: string | null } | null;
    } | null;
  } | null;
  creneau?: CreneauHoraire | null;
  prisPar?: EnseignantWithRelations | null;
  presences?: Array<PresenceEleve & {
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
  }>;
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

export function getSessionAppelDisplayLabel(session?: Partial<SessionAppelWithRelations> | null) {
  if (!session) return "Session d'appel non renseignee";

  const classe = getClasseDisplayLabel(session.classe);
  const creneau = session.emploi?.heure_debut && session.emploi?.heure_fin
    ? `${session.emploi.heure_debut} - ${session.emploi.heure_fin}`
    : session.creneau?.nom?.trim() ?? "Creneau";
  const date = session.date ? new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(session.date)) : "Date non renseignee";

  return `${classe} - ${creneau} - ${date}`;
}

export function getSessionAppelSecondaryLabel(session?: Partial<SessionAppelWithRelations> | null) {
  if (!session) return "";
  const stats = session.presences ?? [];
  const total = stats.length;
  const absents = stats.filter((item) => item.statut === "ABSENT").length;
  const retards = stats.filter((item) => item.statut === "RETARD").length;
  return [`${total} eleve(s)`, absents ? `${absents} absent(s)` : "", retards ? `${retards} retard(s)` : ""]
    .filter(Boolean)
    .join(" • ");
}

class SessionAppelService extends Service {
  constructor() {
    super("session-appel");
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
    const scope = { classe: { etablissement_id: etablissementId } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default SessionAppelService;
