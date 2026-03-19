import { Application, NextFunction, Request, Response as R, Router } from "express";
import { EmploiDuTemps, Prisma } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import EmploiDuTempsModel from "../models/emploi_du_temps.model";
import { prisma } from "../../../service/prisma";

type PlanningPolicyMode = "recurrent" | "specific_week";

type EmploiDuTempsPayload = Omit<EmploiDuTemps, "id" | "created_at" | "updated_at">;

type ReplaceClassePlanningBody = {
    classe_id?: string;
    entries?: Array<Partial<EmploiDuTemps>>;
    existing_entry_ids?: string[];
};

type ClasseWithYear = Prisma.ClasseGetPayload<{
    include: {
        annee: true;
    };
}>;

function toDayStart(value: Date | string | null | undefined): Date | null {
    const date = parseDateValue(value);
    if (!date) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

function toDayEnd(value: Date | string | null | undefined): Date | null {
    const date = parseDateValue(value);
    if (!date) return null;
    date.setHours(23, 59, 59, 999);
    return date;
}

function parseDateValue(value: unknown): Date | null {
    if (!value) return null;

    if (value instanceof Date) {
        return new Date(value.getTime());
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

        if (dateOnlyMatch) {
            const [, year, month, day] = dateOnlyMatch;
            return new Date(Number(year), Number(month) - 1, Number(day));
        }

        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed;
    }

    if (typeof value === "number") {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed;
    }

    return null;
}

function isExactWindow(
    leftStart: Date | string | null | undefined,
    leftEnd: Date | string | null | undefined,
    rightStart: Date | string | null | undefined,
    rightEnd: Date | string | null | undefined,
): boolean {
    const startA = toDayStart(leftStart);
    const endA = toDayEnd(leftEnd);
    const startB = toDayStart(rightStart);
    const endB = toDayEnd(rightEnd);

    if (!startA || !endA || !startB || !endB) return false;
    return startA.getTime() === startB.getTime() && endA.getTime() === endB.getTime();
}

function isWeekWindow(
    startValue: Date | string | null | undefined,
    endValue: Date | string | null | undefined,
): boolean {
    const start = toDayStart(startValue);
    const end = toDayEnd(endValue);

    if (!start || !end) return false;

    const expectedEnd = new Date(start);
    expectedEnd.setDate(expectedEnd.getDate() + 6);
    expectedEnd.setHours(23, 59, 59, 999);

    return start.getDay() === 1 && end.getTime() === expectedEnd.getTime();
}

function getWeekStart(value: Date): Date {
    const date = new Date(value.getTime());
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diffToMonday);
    return date;
}

function getWeekEnd(value: Date): Date {
    const date = getWeekStart(value);
    date.setDate(date.getDate() + 6);
    date.setHours(23, 59, 59, 999);
    return date;
}

function isBoundaryWeekWindow(
    startValue: Date | string | null | undefined,
    endValue: Date | string | null | undefined,
    yearStartValue: Date | string | null | undefined,
    yearEndValue: Date | string | null | undefined,
): boolean {
    const start = toDayStart(startValue);
    const end = toDayEnd(endValue);
    const yearStart = toDayStart(yearStartValue);
    const yearEnd = toDayEnd(yearEndValue);

    if (!start || !end || !yearStart || !yearEnd) return false;

    const selectedWeekStart = getWeekStart(start);
    const selectedWeekEnd = getWeekEnd(start);

    if (selectedWeekStart.getTime() > yearEnd.getTime() || selectedWeekEnd.getTime() < yearStart.getTime()) {
        return false;
    }

    const clippedStart = selectedWeekStart.getTime() < yearStart.getTime() ? yearStart : selectedWeekStart;
    const clippedEnd = selectedWeekEnd.getTime() > yearEnd.getTime() ? yearEnd : selectedWeekEnd;

    return start.getTime() === clippedStart.getTime() && end.getTime() === clippedEnd.getTime();
}

function toOptionalString(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

function buildPlanningKey(entry: Pick<EmploiDuTempsPayload, "jour_semaine" | "creneau_horaire_id" | "effectif_du" | "effectif_au">): string {
    return [
        entry.jour_semaine,
        entry.creneau_horaire_id,
        toDayStart(entry.effectif_du)?.toISOString() ?? "none",
        toDayEnd(entry.effectif_au)?.toISOString() ?? "none",
    ].join("::");
}

class EmploiDuTempsApp {
    public app: Application;
    public router: Router;
    private emploiDuTemps: EmploiDuTempsModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.emploiDuTemps = new EmploiDuTempsModel();
        this.routes();
    }

    public routes(): Router {
        this.router.post("/", this.create.bind(this));
        this.router.post("/replace-classe-planning", this.replaceClassePlanning.bind(this));
        this.router.get("/", this.getAll.bind(this));
        this.router.get("/:id", this.getOne.bind(this));
        this.router.delete("/:id", this.delete.bind(this));
        this.router.put("/:id", this.update.bind(this));
        return this.router;
    }

    private respondValidationError(res: R, error: unknown): void {
        const normalizedError = error instanceof Error ? error : new Error("Requete invalide.");
        Response.error(res, normalizedError.message, 400, normalizedError);
    }

    private async getClasseWithYear(classeId: string) {
        const classe = await prisma.classe.findUnique({
            where: { id: classeId },
            include: {
                annee: true,
            },
        });

        if (!classe) {
            throw new Error("Classe introuvable pour determiner la politique d'emploi du temps.");
        }

        return classe;
    }

    private async resolvePlanningPolicyMode(
        classeId: string,
    ): Promise<{
        classe: ClasseWithYear;
        lockedMode: PlanningPolicyMode | null;
    }> {
        const classe = await this.getClasseWithYear(classeId);

        const firstYearEntry = await prisma.emploiDuTemps.findFirst({
            where: {
                classe_id: classe.id,
                effectif_du: {
                    lte: toDayEnd(classe.annee.date_fin) ?? classe.annee.date_fin,
                },
                effectif_au: {
                    gte: toDayStart(classe.annee.date_debut) ?? classe.annee.date_debut,
                },
            },
            orderBy: {
                created_at: "asc",
            },
        });

        if (!firstYearEntry) {
            return {
                classe,
                lockedMode: null,
            };
        }

        return {
            classe,
            lockedMode: this.getPlanningModeForWindow(firstYearEntry, classe),
        };
    }

    private getPlanningModeForWindow(
        data: Pick<EmploiDuTempsPayload, "effectif_du" | "effectif_au">,
        classe: ClasseWithYear,
    ): PlanningPolicyMode {
        return isExactWindow(
            data.effectif_du,
            data.effectif_au,
            classe.annee.date_debut,
            classe.annee.date_fin,
        )
            ? "recurrent"
            : "specific_week";
    }

    private async validatePlanningPolicy(data: EmploiDuTempsPayload, classe?: ClasseWithYear): Promise<void> {
        const resolved = classe
            ? {
                classe,
                lockedMode: (await this.resolvePlanningPolicyMode(data.classe_id)).lockedMode,
            }
            : await this.resolvePlanningPolicyMode(data.classe_id);

        const nextMode = this.getPlanningModeForWindow(data, resolved.classe);

        if (resolved.lockedMode && resolved.lockedMode !== nextMode) {
            throw new Error(
                resolved.lockedMode === "recurrent"
                    ? "Le mode Annuel est deja choisi pour cette classe. Le mode Semaine est bloque."
                    : "Le mode Semaine est deja choisi pour cette classe. Le mode Annuel est bloque.",
            );
        }
    }

    private async validateWindow(
        data: EmploiDuTempsPayload,
        classe: ClasseWithYear,
    ): Promise<void> {
        const start = toDayStart(data.effectif_du);
        const end = toDayEnd(data.effectif_au);
        const yearStart = toDayStart(classe.annee.date_debut);
        const yearEnd = toDayEnd(classe.annee.date_fin);

        if (!start || !end) {
            throw new Error("Les dates d'effet du planning sont obligatoires.");
        }

        if (end <= start) {
            throw new Error("La date de fin du planning doit etre strictement apres la date de debut.");
        }

        if (!yearStart || !yearEnd) {
            throw new Error("L'annee scolaire de la classe est invalide.");
        }

        if (start < yearStart || end > yearEnd) {
            throw new Error("Les dates du planning doivent rester dans les bornes de l'annee scolaire de la classe.");
        }

        if (
            !isExactWindow(start, end, yearStart, yearEnd) &&
            !isWeekWindow(start, end) &&
            !isBoundaryWeekWindow(start, end, yearStart, yearEnd)
        ) {
            throw new Error("Un planning specifique doit couvrir la semaine choisie, avec un recadrage autorise au debut ou a la fin de l'annee scolaire.");
        }
    }

    private async normalizeEntry(
        body: Partial<EmploiDuTemps>,
        options?: {
            currentId?: string;
            ignoredEntryIds?: string[];
            classe?: ClasseWithYear;
            skipPolicyValidation?: boolean;
        },
    ): Promise<EmploiDuTempsPayload> {
        const classeId = toOptionalString(body.classe_id);
        if (!classeId) {
            throw new Error("La classe est obligatoire pour enregistrer une ligne d'emploi du temps.");
        }

        const jourSemaine =
            typeof body.jour_semaine === "number"
                ? body.jour_semaine
                : Number.parseInt(String(body.jour_semaine ?? ""), 10);
        if (!Number.isInteger(jourSemaine) || jourSemaine < 1 || jourSemaine > 7) {
            throw new Error("Le jour de semaine doit etre un entier compris entre 1 et 7.");
        }

        const creneauHoraireId = toOptionalString(body.creneau_horaire_id);
        if (!creneauHoraireId) {
            throw new Error("Le creneau horaire est obligatoire.");
        }

        const classe = options?.classe ?? await this.getClasseWithYear(classeId);
        await this.validateWindow({
            classe_id: classe.id,
            cours_id: null,
            matiere_id: null,
            enseignant_id: null,
            salle_id: null,
            jour_semaine: jourSemaine,
            creneau_horaire_id: creneauHoraireId,
            effectif_du: parseDateValue(body.effectif_du),
            effectif_au: parseDateValue(body.effectif_au),
        }, classe);

        const creneau = await prisma.creneauHoraire.findUnique({
            where: { id: creneauHoraireId },
        });

        if (!creneau || creneau.etablissement_id !== classe.etablissement_id) {
            throw new Error("Le creneau horaire selectionne ne correspond pas a l'etablissement de la classe.");
        }

        const coursId = toOptionalString(body.cours_id);
        const salleId = toOptionalString(body.salle_id);

        let matiereId: string | null = null;
        let enseignantId: string | null = null;

        if (!coursId && (toOptionalString(body.matiere_id) || toOptionalString(body.enseignant_id))) {
            throw new Error("La matiere et l'enseignant sont determines automatiquement a partir du cours.");
        }

        if (coursId) {
            const cours = await prisma.cours.findUnique({
                where: { id: coursId },
                include: {
                    classe: true,
                },
            });

            if (!cours) {
                throw new Error("Le cours selectionne est introuvable.");
            }

            if (cours.classe_id !== classe.id) {
                throw new Error("Le cours selectionne n'appartient pas a la classe choisie.");
            }

            if (cours.annee_scolaire_id !== classe.annee_scolaire_id) {
                throw new Error("Le cours selectionne n'appartient pas a l'annee scolaire active de la classe.");
            }

            matiereId = cours.matiere_id;
            enseignantId = cours.enseignant_id;
        }

        if (!coursId && salleId) {
            throw new Error("Une salle ne peut etre renseignee que lorsqu'un cours est selectionne.");
        }

        if (salleId) {
            const salle = await prisma.salle.findUnique({
                where: { id: salleId },
                include: {
                    site: true,
                },
            });

            if (!salle || salle.site?.etablissement_id !== classe.etablissement_id) {
                throw new Error("La salle selectionnee ne correspond pas a l'etablissement de la classe.");
            }
        }

        const normalized: EmploiDuTempsPayload = {
            classe_id: classe.id,
            cours_id: coursId,
            matiere_id: matiereId,
            enseignant_id: enseignantId,
            salle_id: salleId,
            jour_semaine: jourSemaine,
            creneau_horaire_id: creneauHoraireId,
            effectif_du: toDayStart(body.effectif_du) ?? null,
            effectif_au: toDayEnd(body.effectif_au) ?? null,
        };

        if (!options?.skipPolicyValidation) {
            await this.validatePlanningPolicy(normalized, classe);
        }

        await this.assertNoPlanningConflicts(normalized, {
            currentId: options?.currentId,
            ignoredEntryIds: options?.ignoredEntryIds,
            classe,
        });

        return normalized;
    }

    private async assertNoPlanningConflicts(
        data: EmploiDuTempsPayload,
        options?: {
            currentId?: string;
            ignoredEntryIds?: string[];
            classe?: ClasseWithYear;
        },
    ): Promise<void> {
        const conditions: Prisma.EmploiDuTempsWhereInput[] = [
            {
                jour_semaine: data.jour_semaine,
                creneau_horaire_id: data.creneau_horaire_id,
                effectif_du: {
                    lte: toDayEnd(data.effectif_au) ?? undefined,
                },
                effectif_au: {
                    gte: toDayStart(data.effectif_du) ?? undefined,
                },
            },
        ];

        if (options?.currentId) {
            conditions.push({ id: { not: options.currentId } });
        }

        if (options?.ignoredEntryIds?.length) {
            conditions.push({ id: { notIn: options.ignoredEntryIds } });
        }

        const overlappingEntries = await prisma.emploiDuTemps.findMany({
            where: {
                AND: conditions,
            },
            include: {
                classe: true,
            },
        });

        for (const entry of overlappingEntries) {
            if (entry.classe_id === data.classe_id) {
                throw new Error(
                    `La classe ${entry.classe?.nom ?? ""} possede deja une ligne sur ce jour et ce creneau pour une periode qui se chevauche.`,
                );
            }

            if (data.enseignant_id && entry.enseignant_id === data.enseignant_id) {
                throw new Error(
                    `L'enseignant selectionne est deja affecte a ${entry.classe?.nom ?? "une autre classe"} sur ce jour et ce creneau.`,
                );
            }

            if (data.salle_id && entry.salle_id === data.salle_id) {
                throw new Error(
                    `La salle selectionnee est deja utilisee par ${entry.classe?.nom ?? "une autre classe"} sur ce jour et ce creneau.`,
                );
            }
        }
    }

    private assertNoDuplicateEntries(entries: EmploiDuTempsPayload[]): void {
        const seen = new Set<string>();

        for (const entry of entries) {
            const key = buildPlanningKey(entry);
            if (seen.has(key)) {
                throw new Error("Le lot de planning contient au moins deux lignes identiques sur le meme jour et le meme creneau.");
            }
            seen.add(key);
        }
    }

    private async create(req: Request, res: R): Promise<void> {
        try {
            const data = await this.normalizeEntry(req.body as Partial<EmploiDuTemps>);
            const result = await this.emploiDuTemps.create(data);
            Response.success(res, "Emploi du temps created.", result);
        } catch (error) {
            this.respondValidationError(res, error);
        }
    }

    private async replaceClassePlanning(req: Request, res: R): Promise<void> {
        try {
            const body = req.body as ReplaceClassePlanningBody;
            const classeId = toOptionalString(body.classe_id);

            if (!classeId) {
                return Response.error(
                    res,
                    "La classe cible est obligatoire pour remplacer un planning.",
                    400,
                    new Error("Invalid classe_id"),
                );
            }

            const existingEntryIds = Array.isArray(body.existing_entry_ids)
                ? body.existing_entry_ids
                    .map((item) => toOptionalString(item))
                    .filter((item): item is string => Boolean(item))
                : [];

            const classe = await this.getClasseWithYear(classeId);

            const existingEntries = existingEntryIds.length
                ? await prisma.emploiDuTemps.findMany({
                    where: {
                        id: { in: existingEntryIds },
                    },
                })
                : [];

            if (existingEntries.length !== existingEntryIds.length) {
                return Response.error(
                    res,
                    "Certaines lignes a remplacer sont introuvables.",
                    400,
                    new Error("Unknown planning entries"),
                );
            }

            if (existingEntries.some((entry) => entry.classe_id !== classe.id)) {
                return Response.error(
                    res,
                    "Toutes les lignes a remplacer doivent appartenir a la classe cible.",
                    400,
                    new Error("Mismatched classe_id"),
                );
            }

            const rawEntries = Array.isArray(body.entries) ? body.entries : [];
            const normalizedEntries = await Promise.all(
                rawEntries.map((entry) =>
                    this.normalizeEntry(entry, {
                        ignoredEntryIds: existingEntryIds,
                        classe,
                    }),
                ),
            );

            if (normalizedEntries.some((entry) => entry.classe_id !== classe.id)) {
                return Response.error(
                    res,
                    "Toutes les nouvelles lignes doivent appartenir a la meme classe.",
                    400,
                    new Error("Mixed classe_id"),
                );
            }

            this.assertNoDuplicateEntries(normalizedEntries);

            const operations: Prisma.PrismaPromise<unknown>[] = [];
            if (existingEntryIds.length) {
                operations.push(
                    prisma.emploiDuTemps.deleteMany({
                        where: {
                            id: { in: existingEntryIds },
                        },
                    }),
                );
            }

            for (const entry of normalizedEntries) {
                operations.push(
                    prisma.emploiDuTemps.create({
                        data: entry,
                    }),
                );
            }

            const results = operations.length ? await prisma.$transaction(operations) : [];
            const createdEntries = results.slice(existingEntryIds.length ? 1 : 0) as EmploiDuTemps[];

            Response.success(res, "Classe planning replaced.", {
                classe_id: classe.id,
                deleted_count: existingEntryIds.length,
                created_count: createdEntries.length,
                entries: createdEntries,
            });
        } catch (error) {
            this.respondValidationError(res, error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.emploiDuTemps);
            Response.success(res, "Emploi du temps list.", result);
        } catch (error) {
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id;
            const result = await this.emploiDuTemps.findUnique(id);
            Response.success(res, "Emploi du temps detail.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id;
            const result = await this.emploiDuTemps.delete(id);
            Response.success(res, "Emploi du temps deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R): Promise<void> {
        try {
            const id = req.params.id;
            const existing = await this.emploiDuTemps.findUnique<EmploiDuTemps>(id);
            if (!existing) {
                Response.error(res, "Emploi du temps introuvable.", 404, new Error("Not found"));
                return;
            }

            const data = await this.normalizeEntry(
                { ...existing, ...(req.body as Partial<EmploiDuTemps>) },
                { currentId: id },
            );
            const result = await this.emploiDuTemps.update(id, data);
            Response.success(res, "Emploi du temps updated.", result);
        } catch (error) {
            this.respondValidationError(res, error);
        }
    }
}

export default EmploiDuTempsApp;
