import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
import type { EmploiDuTemps } from "../types/models";

class EmploiDuTempsService extends Service {
    constructor() {
        super("emploi-du-temps");
    }

    async getClassePlanning(classe_id: string) {
        return this.getAll({
            take: 5000,
            where: JSON.stringify({ classe_id }),
            includeSpec: JSON.stringify({
                classe: true,
                cours: {
                    include: {
                        classe: true,
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
            }),
            orderBy: JSON.stringify([
                { jour_semaine: "asc" },
                { creneau: { ordre: "asc" } },
                { creneau: { heure_debut: "asc" } },
            ]),
        });
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
}

export default EmploiDuTempsService;
