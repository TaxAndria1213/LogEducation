import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
import type {
  Classe,
  Cours,
  CreneauHoraire,
  EmploiDuTemps,
  Enseignant,
  Matiere,
  Personnel,
  Profil,
  Salle,
  Site,
  Utilisateur,
} from "../types/models";

type QueryParams = Record<string, unknown>;

type TeacherWithProfile = Enseignant & {
  personnel?: (Personnel & {
    utilisateur?: (Utilisateur & {
      profil?: Profil | null;
    }) | null;
  }) | null;
};

export type EmploiDuTempsWithRelations = EmploiDuTemps & {
  classe?: (Classe & {
    niveau?: {
      id: string;
      nom: string;
    } | null;
    site?: Site | null;
  }) | null;
  cours?: (Cours & {
    classe?: (Classe & {
      niveau?: {
        id: string;
        nom: string;
      } | null;
      site?: Site | null;
    }) | null;
    matiere?: Matiere | null;
  }) | null;
  matiere?: Matiere | null;
  enseignant?: TeacherWithProfile | null;
  salle?: (Salle & {
    site?: Site | null;
  }) | null;
  creneau?: CreneauHoraire | null;
};

export const EMPLOI_DU_TEMPS_INCLUDE_SPEC = {
  classe: {
    include: {
      niveau: true,
      site: true,
    },
  },
  cours: {
    include: {
      classe: {
        include: {
          niveau: true,
          site: true,
        },
      },
      matiere: true,
    },
  },
  matiere: true,
  enseignant: {
    include: {
      personnel: {
        include: {
          utilisateur: {
            include: {
              profil: true,
            },
          },
        },
      },
    },
  },
  salle: {
    include: {
      site: true,
    },
  },
  creneau: true,
} as const;

export const EMPLOI_DU_TEMPS_ORDER_BY = [
  { jour_semaine: "asc" },
  { creneau: { ordre: "asc" } },
  { creneau: { heure_debut: "asc" } },
] as const;

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

class EmploiDuTempsService extends Service {
  constructor() {
    super("emploi-du-temps");
  }

  async getClassePlanning(classe_id: string) {
    return this.getAll({
      take: 5000,
      where: JSON.stringify({ classe_id }),
      includeSpec: JSON.stringify(EMPLOI_DU_TEMPS_INCLUDE_SPEC),
      orderBy: JSON.stringify(EMPLOI_DU_TEMPS_ORDER_BY),
    });
  }

  async getForEtablissement(
    etablissementId: string,
    params: QueryParams = {},
  ) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);

    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      includeSpec:
        typeof params.includeSpec === "string"
          ? params.includeSpec
          : JSON.stringify(params.includeSpec ?? EMPLOI_DU_TEMPS_INCLUDE_SPEC),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? EMPLOI_DU_TEMPS_ORDER_BY),
    } as Record<string, string | number | Date | boolean>);
  }

  async replaceClassePlanning(
    classe_id: string,
    entries: Array<Omit<EmploiDuTemps, "id" | "created_at" | "updated_at">>,
    options?: {
      existingEntries?: EmploiDuTemps[];
    },
  ) {
    let existingEntryIds = (options?.existingEntries ?? []).map((item) => item.id);

    if (!options?.existingEntries) {
      const existing = await this.getClassePlanning(classe_id);

      if (!existing?.status.success) {
        return {
          status: { success: false, message: "Impossible de charger le planning existant." },
          data: null,
        };
      }

      existingEntryIds = (existing.data?.data ?? []).map((item: EmploiDuTemps) => item.id);
    }

    return Http.post(["/api", this.url, "replace-classe-planning"].join("/"), {
      classe_id,
      entries,
      existing_entry_ids: existingEntryIds,
    });
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = {
      classe: {
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

export default EmploiDuTempsService;
