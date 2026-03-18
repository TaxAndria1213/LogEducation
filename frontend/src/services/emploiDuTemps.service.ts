import Service from "../app/api/Service";
import type { EmploiDuTemps } from "../types/models";

class EmploiDuTempsService extends Service {
    constructor() {
        super("emploi-du-temps");
    }

    async getClassePlanning(classe_id: string) {
        return this.getAll({
            take: 1000,
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
                { creneau_horaire_id: "asc" },
            ]),
        });
    }

    async replaceClassePlanning(classe_id: string, entries: Array<Omit<EmploiDuTemps, "id" | "created_at" | "updated_at">>) {
        const existing = await this.getClassePlanning(classe_id);

        if (!existing?.status.success) {
            return {
                status: { success: false, message: "Impossible de charger le planning existant." },
                data: [],
            };
        }

        const deleteResults = await Promise.all(
            existing.data.data.map((item: EmploiDuTemps) => this.delete(item.id)),
        );

        if (deleteResults.some((result) => !result?.status?.success)) {
            return {
                status: { success: false, message: "Impossible de nettoyer le planning existant." },
                data: deleteResults,
            };
        }

        if (!entries.length) return { status: { success: true }, data: [] };

        const results = await Promise.all(entries.map((entry) => this.create(entry)));

        if (results.some((result) => !result?.status?.success)) {
            return {
                status: { success: false, message: "Une partie du planning n'a pas pu etre creee." },
                data: results,
            };
        }

        return { status: { success: true }, data: results };
    }
}

export default EmploiDuTempsService;
